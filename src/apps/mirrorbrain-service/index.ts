import { mkdir, readdir, unlink, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import { ValidationError } from './errors.js';
import {
  createFileSyncCheckpointStore,
  type SyncCheckpointStore,
} from '../../integrations/file-sync-checkpoint-store/index.js';
import {
  ingestCandidateMemoryToOpenViking,
  ingestMemoryEventToOpenViking,
  ingestKnowledgeArtifactToOpenViking,
  ingestMemoryNarrativeToOpenViking,
  ingestReviewedMemoryToOpenViking,
  ingestSkillArtifactToOpenViking,
  listMirrorBrainMemoryEventsFromOpenViking,
  listMirrorBrainKnowledgeArtifactsFromWorkspace,
  listMirrorBrainMemoryEventsFromWorkspace,
  listRawMirrorBrainMemoryEventsFromWorkspace,
  listMirrorBrainMemoryNarrativesFromOpenViking,
  listMirrorBrainCandidateMemoriesFromOpenViking,
  listMirrorBrainCandidateMemoriesFromWorkspace,
  listMirrorBrainSkillArtifactsFromWorkspace,
  type OpenVikingMemoryEventWriter,
} from '../../integrations/openviking-store/index.js';
import {
  loadMemoryEventsCache,
  saveMemoryEventsCache,
  initializeCacheFromOpenViking,
  updateCacheWithNewEvents,
  getEventsFromCache,
  type MemoryEventsCache,
} from '../../modules/memory-events-cache/index.js';
import {
  listKnowledge as listKnowledgeFromPluginApi,
  listSkillDrafts as listSkillDraftsFromPluginApi,
  queryMemory as queryMemoryFromPluginApi,
} from '../../integrations/openclaw-plugin-api/index.js';
import {
  runBrowserMemorySyncOnce,
  startBrowserMemorySyncPolling,
  type BrowserMemorySyncResult,
} from '../../workflows/browser-memory-sync/index.js';
import {
  fetchActivityWatchBuckets,
  resolveActivityWatchBrowserBucket,
} from '../../integrations/activitywatch-browser-source/index.js';
import {
  loadBrowserPageContentArtifactFromWorkspace,
} from '../../integrations/browser-page-content/index.js';
import {
  runShellMemorySyncOnce,
  type ShellMemorySyncResult,
} from '../../workflows/shell-memory-sync/index.js';
import { generateBrowserThemeNarratives } from '../../workflows/browser-theme-narratives/index.js';
import { generateShellProblemNarratives } from '../../workflows/shell-problem-narratives/index.js';
import {
  buildTopicKnowledgeCandidates,
  mergeDailyReviewIntoTopicKnowledge,
} from '../../workflows/topic-knowledge-merge/index.js';
import {
  analyzeKnowledgeWithConfiguredLLM,
  generateKnowledgeFromReviewedMemories as generateKnowledgeWithSourceContent,
} from '../../modules/knowledge-generation-llm/index.js';
import { buildKnowledgeRelationGraph } from '../../modules/knowledge-relation-network/index.js';
import { extractTags } from '../../modules/knowledge-compilation-engine/index.js';
import { buildSkillDraftFromReviewedMemories } from '../../workflows/skill-draft-builder/index.js';
import {
  createCandidateMemories,
  reviewCandidateMemory,
  suggestCandidateReviews,
} from '../../modules/memory-review/index.js';
import type {
  CandidateMemory,
  CandidateReviewSuggestion,
  KnowledgeArtifact,
  MemoryEvent,
  MemoryNarrative,
  MemoryQueryInput,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';

interface StartMirrorBrainServiceInput {
  config?: ReturnType<typeof getMirrorBrainConfig>;
  workspaceDir?: string;
  browserBucketId?: string;
  browserScopeId?: string;
  shellHistoryPath?: string;
  shellScopeId?: string;
}

interface StartMirrorBrainServiceDependencies {
  startBrowserSyncPolling?: typeof startBrowserMemorySyncPolling;
  createCheckpointStore?: (input: {
    workspaceDir: string;
  }) => SyncCheckpointStore;
  createMemoryEventWriter?: (input: {
    config: ReturnType<typeof getMirrorBrainConfig>;
    workspaceDir: string;
  }) => OpenVikingMemoryEventWriter;
  fetchActivityWatchBuckets?: typeof fetchActivityWatchBuckets;
  runBrowserMemorySyncOnce?: typeof runBrowserMemorySyncOnce;
  runShellMemorySyncOnce?: typeof runShellMemorySyncOnce;
  now?: () => string;
}

interface MirrorBrainRuntimeService {
  readonly status: 'running' | 'stopped';
  readonly config?: ReturnType<typeof getMirrorBrainConfig>;
  syncBrowserMemory(): Promise<BrowserMemorySyncResult>;
  syncShellMemory(): Promise<ShellMemorySyncResult>;
  stop(): void;
}

interface CreateMirrorBrainServiceInput {
  service: MirrorBrainRuntimeService;
  workspaceDir?: string;
}

type MemoryEventReadResult =
  | MemoryEvent[]
  | {
      items: MemoryEvent[];
      pagination: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    };

type ListMemoryEventsDependency = (
  input: { baseUrl: string },
  fetchImpl?: Parameters<typeof listMirrorBrainMemoryEventsFromOpenViking>[1],
) => Promise<MemoryEventReadResult>;

type CreateCandidateMemoriesDependency = (
  input: Parameters<typeof createCandidateMemories>[0],
) => CandidateMemory[] | Promise<CandidateMemory[]>;

interface CreateMirrorBrainServiceDependencies {
  queryMemory?: typeof queryMemoryFromPluginApi;
  listMemoryEvents?: ListMemoryEventsDependency;
  listWorkspaceMemoryEvents?: typeof listMirrorBrainMemoryEventsFromWorkspace;
  listRawWorkspaceMemoryEvents?: typeof listRawMirrorBrainMemoryEventsFromWorkspace;
  listMemoryNarratives?: typeof listMirrorBrainMemoryNarrativesFromOpenViking;
  listCandidateMemories?: typeof listMirrorBrainCandidateMemoriesFromOpenViking;
  listWorkspaceCandidateMemories?: typeof listMirrorBrainCandidateMemoriesFromWorkspace;
  listKnowledge?: typeof listKnowledgeFromPluginApi;
  listSkillDrafts?: typeof listSkillDraftsFromPluginApi;
  publishMemoryNarrative?: typeof ingestMemoryNarrativeToOpenViking;
  publishKnowledge?: typeof ingestKnowledgeArtifactToOpenViking;
  publishSkill?: typeof ingestSkillArtifactToOpenViking;
  publishCandidateMemory?: typeof ingestCandidateMemoryToOpenViking;
  publishReviewedMemory?: typeof ingestReviewedMemoryToOpenViking;
  undoReviewedMemory?: (reviewedMemoryId: string, workspaceDir: string) => Promise<void>;
  buildBrowserThemeNarratives?: typeof generateBrowserThemeNarratives;
  buildShellProblemNarratives?: typeof generateShellProblemNarratives;
  buildTopicKnowledgeCandidates?: typeof buildTopicKnowledgeCandidates;
  mergeTopicKnowledge?: typeof mergeDailyReviewIntoTopicKnowledge;
  generateKnowledge?: (input: {
    reviewedMemories: ReviewedMemory[];
    existingDraft?: KnowledgeArtifact;
  }) => KnowledgeArtifact | Promise<KnowledgeArtifact>;
  generateSkillDraft?: typeof buildSkillDraftFromReviewedMemories;
  reviewMemory?: typeof reviewCandidateMemory;
  createCandidateMemories?: CreateCandidateMemoriesDependency;
  suggestCandidateReviews?: typeof suggestCandidateReviews;
  loadBrowserPageContentArtifactFromWorkspace?: typeof loadBrowserPageContentArtifactFromWorkspace;
  analyzeKnowledge?: typeof analyzeKnowledgeWithConfiguredLLM;
}

function normalizeMemoryEventReadResult(result: MemoryEventReadResult): MemoryEvent[] {
  return Array.isArray(result) ? result : result.items;
}

function mergeArtifactsById<T extends { id: string }>(
  primary: T[],
  fallback: T[],
): T[] {
  const merged = new Map<string, T>();

  for (const item of primary) {
    merged.set(item.id, item);
  }

  for (const item of fallback) {
    merged.set(item.id, item);
  }

  return [...merged.values()];
}

type DeletedArtifactKind = 'knowledge' | 'skills';

function isUnsafeArtifactId(artifactId: string): boolean {
  return (
    artifactId.includes('..') ||
    artifactId.includes('/') ||
    artifactId.includes('\\')
  );
}

function validateKnowledgeArtifactId(artifactId: string): void {
  const validPrefix =
    artifactId.startsWith('knowledge-draft:') ||
    artifactId.startsWith('topic-knowledge:') ||
    artifactId.startsWith('topic-merge-candidate:');

  if (!validPrefix || isUnsafeArtifactId(artifactId)) {
    throw new ValidationError(`Invalid knowledge artifact ID format: ${artifactId}`);
  }
}

function validateSkillArtifactId(artifactId: string): void {
  if (!artifactId.startsWith('skill-draft:') || isUnsafeArtifactId(artifactId)) {
    throw new ValidationError(`Invalid skill artifact ID format: ${artifactId}`);
  }
}

const SYNC_IMPORTED_EVENT_PREVIEW_LIMIT = 50;

function createOpenVikingMemoryEventWriter(input: {
  config: ReturnType<typeof getMirrorBrainConfig>;
  workspaceDir: string;
}): OpenVikingMemoryEventWriter {
  return {
    async writeMemoryEvent(record) {
      await ingestMemoryEventToOpenViking({
        baseUrl: input.config.openViking.baseUrl,
        workspaceDir: input.workspaceDir,
        event: record.payload,
      });
    },
  };
}

function summarizeImportedEvents(
  sync: BrowserMemorySyncResult | ShellMemorySyncResult,
): BrowserMemorySyncResult | ShellMemorySyncResult {
  if (sync.importedEvents === undefined) {
    return sync;
  }

  return {
    ...sync,
    importedEvents: [...sync.importedEvents]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, SYNC_IMPORTED_EVENT_PREVIEW_LIMIT),
  };
}

export function startMirrorBrainService(
  input: StartMirrorBrainServiceInput = {},
  dependencies: StartMirrorBrainServiceDependencies = {},
): MirrorBrainRuntimeService & {
  config: ReturnType<typeof getMirrorBrainConfig>;
} {
  const config = input.config ?? getMirrorBrainConfig();
  const workspaceDir = input.workspaceDir ?? process.cwd();
  const configuredBrowserBucketId = input.browserBucketId;
  const browserScopeId = input.browserScopeId ?? 'scope-browser';
  const shellHistoryPath = input.shellHistoryPath;
  const shellScopeId = input.shellScopeId ?? 'scope-shell';
  const startPolling =
    dependencies.startBrowserSyncPolling ?? startBrowserMemorySyncPolling;
  const checkpointStore = (
    dependencies.createCheckpointStore ?? createFileSyncCheckpointStore
  )({
    workspaceDir,
  });
  const memoryEventWriter = (
    dependencies.createMemoryEventWriter ?? createOpenVikingMemoryEventWriter
  )({
    config,
    workspaceDir,
  });
  const executeBrowserMemorySyncOnce =
    dependencies.runBrowserMemorySyncOnce ?? runBrowserMemorySyncOnce;
  const executeShellMemorySyncOnce =
    dependencies.runShellMemorySyncOnce ?? runShellMemorySyncOnce;
  const loadActivityWatchBuckets =
    dependencies.fetchActivityWatchBuckets ?? fetchActivityWatchBuckets;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const resolveBrowserBucket = async () => {
    if (configuredBrowserBucketId !== undefined) {
      return {
        id: configuredBrowserBucketId,
        created: undefined,
      };
    }

    const buckets = await loadActivityWatchBuckets({
      baseUrl: config.activityWatch.baseUrl,
    });
    const bucketId = resolveActivityWatchBrowserBucket(buckets);

    if (bucketId === null) {
      throw new Error(
        'No ActivityWatch browser watcher bucket is available for this MirrorBrain runtime.',
      );
    }

    const bucket = buckets.find((item) => item.id === bucketId);

    return {
      id: bucketId,
      created: bucket?.created,
    };
  };
  const syncBrowserMemory = async () => {
    const bucket = await resolveBrowserBucket();

    return (
    executeBrowserMemorySyncOnce(
      {
        config,
        now: now(),
        bucketId: bucket.id,
        initialBackfillStartAt: bucket.created,
        scopeId: browserScopeId,
        workspaceDir,
      },
      {
        checkpointStore,
        writeMemoryEvent: memoryEventWriter.writeMemoryEvent,
      },
    ));
  };
  const syncShellMemory = () => {
    if (shellHistoryPath === undefined) {
      return Promise.reject(
        new Error('Shell history sync is not configured for this MirrorBrain runtime.'),
      );
    }

    return executeShellMemorySyncOnce(
      {
        config,
        now: now(),
        historyPath: shellHistoryPath,
        scopeId: shellScopeId,
      },
      {
        checkpointStore,
        writeMemoryEvent: memoryEventWriter.writeMemoryEvent,
      },
    );
  };
  const polling = startPolling(
    {
      config,
    },
    {
      runSyncOnce: syncBrowserMemory,
    },
  );
  let status: 'running' | 'stopped' = 'running';

  return {
    get status() {
      return status;
    },
    config,
    syncBrowserMemory,
    syncShellMemory,
    stop() {
      polling.stop();
      status = 'stopped';
    },
  };
}

export function createMirrorBrainService(
  input: CreateMirrorBrainServiceInput,
  dependencies: CreateMirrorBrainServiceDependencies = {},
) {
  const baseUrl =
    input.service.config?.openViking.baseUrl ?? getMirrorBrainConfig().openViking.baseUrl;
  const workspaceDir = input.workspaceDir ?? process.cwd();
  const queryMemory = dependencies.queryMemory ?? queryMemoryFromPluginApi;
  const listMemoryEvents =
    dependencies.listMemoryEvents ?? listMirrorBrainMemoryEventsFromOpenViking;
  const listWorkspaceMemoryEvents =
    dependencies.listWorkspaceMemoryEvents ?? listMirrorBrainMemoryEventsFromWorkspace;
  const listRawWorkspaceMemoryEvents =
    dependencies.listRawWorkspaceMemoryEvents ?? listRawMirrorBrainMemoryEventsFromWorkspace;
  const listMemoryNarratives =
    dependencies.listMemoryNarratives ?? listMirrorBrainMemoryNarrativesFromOpenViking;
  const listCandidateMemories =
    dependencies.listCandidateMemories ?? listMirrorBrainCandidateMemoriesFromOpenViking;
  const listWorkspaceCandidateMemories =
    dependencies.listWorkspaceCandidateMemories ?? listMirrorBrainCandidateMemoriesFromWorkspace;
  const listKnowledge = dependencies.listKnowledge ?? listKnowledgeFromPluginApi;
  const listSkillDrafts =
    dependencies.listSkillDrafts ?? listSkillDraftsFromPluginApi;
  const publishMemoryNarrative =
    dependencies.publishMemoryNarrative ?? ingestMemoryNarrativeToOpenViking;
  const publishKnowledge =
    dependencies.publishKnowledge ?? ingestKnowledgeArtifactToOpenViking;
  const publishSkill =
    dependencies.publishSkill ?? ingestSkillArtifactToOpenViking;
  const publishCandidateMemory =
    dependencies.publishCandidateMemory ?? ingestCandidateMemoryToOpenViking;
  const publishReviewedMemory =
    dependencies.publishReviewedMemory ?? ingestReviewedMemoryToOpenViking;
  const undoReviewedMemory =
    dependencies.undoReviewedMemory ??
    (async (reviewedMemoryId: string, workspaceDir: string) => {
      // Validate ID format to prevent path traversal
      if (!reviewedMemoryId.startsWith('reviewed:') ||
          reviewedMemoryId.includes('..') ||
          reviewedMemoryId.includes('/') ||
          reviewedMemoryId.includes('\\')) {
        throw new ValidationError(`Invalid reviewed memory ID format: ${reviewedMemoryId}`);
      }

      const reviewedFilePath = join(
        workspaceDir,
        'mirrorbrain',
        'reviewed-memories',
        `${reviewedMemoryId}.json`,
      );

      console.log(`[undoCandidateReview] Deleting reviewed memory file: ${reviewedFilePath}`);

      try {
        await unlink(reviewedFilePath);
        console.log(`[undoCandidateReview] Successfully deleted: ${reviewedMemoryId}`);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          console.log(`[undoCandidateReview] File already deleted: ${reviewedFilePath}`);
          return;
        }
        console.error(`[undoCandidateReview] Error deleting file: ${reviewedFilePath}`, error);
        throw error;
      }
    });
  const deleteCandidateMemory = async (candidateMemoryId: string): Promise<void> => {
    // Validate ID format to prevent path traversal
    if (!candidateMemoryId.startsWith('candidate:') ||
        candidateMemoryId.includes('..') ||
        candidateMemoryId.includes('/') ||
        candidateMemoryId.includes('\\')) {
      throw new ValidationError(`Invalid candidate memory ID format: ${candidateMemoryId}`);
    }

    const candidateFilePath = join(
      workspaceDir,
      'mirrorbrain',
      'candidate-memories',
      `${candidateMemoryId}.json`,
    );

    console.log(`[deleteCandidateMemory] Deleting candidate memory file: ${candidateFilePath}`);

    try {
      await unlink(candidateFilePath);
      console.log(`[deleteCandidateMemory] Successfully deleted: ${candidateMemoryId}`);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.log(`[deleteCandidateMemory] File already deleted: ${candidateFilePath}`);
        return;
      }
      console.error(`[deleteCandidateMemory] Error deleting file: ${candidateFilePath}`, error);
      throw error;
    }
  };
  const deleteKnowledgeArtifactById = async (artifactId: string): Promise<void> => {
    validateKnowledgeArtifactId(artifactId);
    await deleteWorkspaceArtifactFile('knowledge', artifactId);
    await recordDeletedArtifact('knowledge', artifactId);
  };
  const deleteKnowledgeArtifact = async (artifactId: string): Promise<void> => {
    const knowledgeArtifacts = await loadKnowledgeArtifacts();
    const artifact = knowledgeArtifacts.find((item) => item.id === artifactId);
    const sourceDraftIds =
      artifact?.draftState === 'published'
        ? artifact.derivedFromKnowledgeIds?.filter((id) => id.startsWith('knowledge-draft:')) ?? []
        : [];

    await Promise.all(
      Array.from(new Set([artifactId, ...sourceDraftIds])).map((id) =>
        deleteKnowledgeArtifactById(id),
      ),
    );
  };
  const deleteSkillArtifact = async (artifactId: string): Promise<void> => {
    validateSkillArtifactId(artifactId);
    await deleteWorkspaceArtifactFile('skill-drafts', artifactId);
    await recordDeletedArtifact('skills', artifactId);
  };
  const buildBrowserThemeNarratives =
    dependencies.buildBrowserThemeNarratives ?? generateBrowserThemeNarratives;
  const buildShellProblemNarratives =
    dependencies.buildShellProblemNarratives ?? generateShellProblemNarratives;
  const buildTopicCandidates =
    dependencies.buildTopicKnowledgeCandidates ?? buildTopicKnowledgeCandidates;
  const mergeTopicKnowledge =
    dependencies.mergeTopicKnowledge ?? mergeDailyReviewIntoTopicKnowledge;
  const loadBrowserPageArtifact =
    dependencies.loadBrowserPageContentArtifactFromWorkspace ??
    loadBrowserPageContentArtifactFromWorkspace;
  const analyzeKnowledge =
    dependencies.analyzeKnowledge ?? analyzeKnowledgeWithConfiguredLLM;
  const generateKnowledge =
    dependencies.generateKnowledge ??
    ((input: {
      reviewedMemories: ReviewedMemory[];
      existingDraft?: KnowledgeArtifact;
    }) =>
      generateKnowledgeWithSourceContent(input.reviewedMemories, {
        existingDraft: input.existingDraft,
        workspaceDir,
        getMemoryEvent: async (eventId) => {
          const memoryEvents = await listRawWorkspaceMemoryEvents({
            workspaceDir,
          });

          return memoryEvents.find((event) => event.id === eventId) ?? null;
        },
        loadBrowserPageContentArtifactFromWorkspace: loadBrowserPageArtifact,
        analyzeWithLLM: analyzeKnowledge,
      }));
  const generateSkillDraft =
    dependencies.generateSkillDraft ?? buildSkillDraftFromReviewedMemories;
  const reviewMemory = dependencies.reviewMemory ?? reviewCandidateMemory;
  const buildCandidateMemories =
    dependencies.createCandidateMemories ?? createCandidateMemories;
  const analyzeCandidateReviews =
    dependencies.suggestCandidateReviews ?? suggestCandidateReviews;
  const getDeletedArtifactFilePath = (
    kind: DeletedArtifactKind,
    artifactId: string,
  ): string =>
    join(
      workspaceDir,
      'mirrorbrain',
      'deleted-artifacts',
      kind,
      `${encodeURIComponent(artifactId)}.json`,
    );
  const loadDeletedArtifactIds = async (
    kind: DeletedArtifactKind,
  ): Promise<Set<string>> => {
    const deletedArtifactsDir = join(
      workspaceDir,
      'mirrorbrain',
      'deleted-artifacts',
      kind,
    );
    let files: string[];

    try {
      files = await readdir(deletedArtifactsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new Set();
      }

      throw error;
    }

    return new Set(
      files
        .filter((file) => file.endsWith('.json'))
        .map((file) => decodeURIComponent(file.replace(/\.json$/u, ''))),
    );
  };
  const recordDeletedArtifact = async (
    kind: DeletedArtifactKind,
    artifactId: string,
  ): Promise<void> => {
    const deletedArtifactPath = getDeletedArtifactFilePath(kind, artifactId);
    const deletedArtifactsDir = join(
      workspaceDir,
      'mirrorbrain',
      'deleted-artifacts',
      kind,
    );

    await mkdir(deletedArtifactsDir, { recursive: true });
    await writeFile(
      deletedArtifactPath,
      JSON.stringify(
        {
          artifactId,
          deletedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  };
  const clearDeletedArtifact = async (
    kind: DeletedArtifactKind,
    artifactId: string,
  ): Promise<void> => {
    await rm(getDeletedArtifactFilePath(kind, artifactId), { force: true });
  };
  const deleteWorkspaceArtifactFile = async (
    directoryName: 'knowledge' | 'skill-drafts',
    artifactId: string,
  ): Promise<void> => {
    const artifactFilePath = join(
      workspaceDir,
      'mirrorbrain',
      directoryName,
      `${artifactId}.md`,
    );

    try {
      await unlink(artifactFilePath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }

      throw error;
    }
  };
  const loadKnowledgeArtifacts = async (): Promise<KnowledgeArtifact[]> => {
    const [openVikingKnowledge, workspaceKnowledge, deletedKnowledgeIds] = await Promise.all([
      listKnowledge({
        baseUrl,
      }).catch(() => [] as KnowledgeArtifact[]),
      listMirrorBrainKnowledgeArtifactsFromWorkspace({
        workspaceDir,
      }).catch(() => [] as KnowledgeArtifact[]),
      loadDeletedArtifactIds('knowledge'),
    ]);

    return mergeArtifactsById(
      openVikingKnowledge.filter((artifact) => !deletedKnowledgeIds.has(artifact.id)),
      workspaceKnowledge.filter((artifact) => !deletedKnowledgeIds.has(artifact.id)),
    );
  };
  const loadSkillArtifacts = async (): Promise<SkillArtifact[]> => {
    const [openVikingSkills, workspaceSkills, deletedSkillIds] = await Promise.all([
      listSkillDrafts({
        baseUrl,
      }).catch(() => [] as SkillArtifact[]),
      listMirrorBrainSkillArtifactsFromWorkspace({
        workspaceDir,
      }).catch(() => [] as SkillArtifact[]),
      loadDeletedArtifactIds('skills'),
    ]);

    return mergeArtifactsById(
      openVikingSkills.filter((artifact) => !deletedSkillIds.has(artifact.id)),
      workspaceSkills.filter((artifact) => !deletedSkillIds.has(artifact.id)),
    );
  };
  const publishMemoryNarratives = async (artifacts: MemoryNarrative[]) => {
    await Promise.all(
      artifacts.map((artifact) =>
        publishMemoryNarrative({
          baseUrl,
          workspaceDir,
          artifact,
        }),
      ),
    );
  };
  const buildRelationTags = (artifact: KnowledgeArtifact): string[] => {
    if (artifact.tags !== undefined && artifact.tags.length > 0) {
      return Array.from(new Set(artifact.tags));
    }

    return extractTags(
      [
        artifact.topicKey,
        artifact.title,
        artifact.summary,
        artifact.body,
      ]
        .filter((value): value is string => typeof value === 'string')
        .filter((value) => value.length > 0)
        .join('\n'),
    );
  };
  const refreshKnowledgeRelations = async (
    updatedArtifacts: KnowledgeArtifact[],
  ): Promise<KnowledgeArtifact[]> => {
    const existingArtifacts = await loadKnowledgeArtifacts();
    const mergedById = new Map<string, KnowledgeArtifact>();

    for (const artifact of existingArtifacts) {
      mergedById.set(artifact.id, artifact);
    }

    for (const artifact of updatedArtifacts) {
      mergedById.set(artifact.id, artifact);
    }

    const artifacts = [...mergedById.values()];
    const relationInput = artifacts.map((artifact) => ({
      ...artifact,
      tags: buildRelationTags(artifact),
    }));
    const graph = buildKnowledgeRelationGraph(relationInput);
    const relatedArtifacts = artifacts.map((artifact) => {
      const relatedKnowledgeIds = graph.get(artifact.id) ?? [];

      if (relatedKnowledgeIds.length > 0) {
        return {
          ...artifact,
          relatedKnowledgeIds,
        };
      }

      if (artifact.relatedKnowledgeIds !== undefined) {
        return {
          ...artifact,
          relatedKnowledgeIds,
        };
      }

      return artifact;
    });

    const updatedIds = updatedArtifacts.map((artifact) => artifact.id);
    const updatedIdSet = new Set(updatedIds);
    const publishOrder = [
      ...updatedIds
        .map((id) => relatedArtifacts.find((artifact) => artifact.id === id))
        .filter((artifact): artifact is KnowledgeArtifact => artifact !== undefined),
      ...relatedArtifacts.filter((artifact) => !updatedIdSet.has(artifact.id)),
    ];

    const criticalArtifacts = publishOrder.filter((artifact) =>
      updatedIdSet.has(artifact.id),
    );
    const relationOnlyArtifacts = publishOrder.filter(
      (artifact) => !updatedIdSet.has(artifact.id),
    );

    await Promise.all(
      criticalArtifacts.map((artifact) =>
        publishKnowledge({
          baseUrl,
          workspaceDir,
          artifact,
        }),
      ),
    );
    void Promise.all(
      relationOnlyArtifacts.map((artifact) =>
        publishKnowledge({
          baseUrl,
          workspaceDir,
          artifact,
        }),
      ),
    ).catch((error) => {
      console.error(
        `[knowledge-relations] Failed to refresh related knowledge artifacts: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return relatedArtifacts.filter((artifact) =>
      updatedArtifacts.some((updated) => updated.id === artifact.id),
    );
  };
  const listOpenVikingMemoryEventArray = async (
    input: { baseUrl: string },
  ): Promise<MemoryEvent[]> =>
    normalizeMemoryEventReadResult(await listMemoryEvents(input));
  const loadOrInitializeCache = async (): Promise<MemoryEventsCache> => {
    if (
      dependencies.listMemoryEvents !== undefined ||
      dependencies.listWorkspaceMemoryEvents !== undefined
    ) {
      return initializeCacheFromOpenViking(
        workspaceDir,
        baseUrl,
        {
          listWorkspaceMemoryEvents: listWorkspaceMemoryEvents,
          listOpenVikingMemoryEvents: listOpenVikingMemoryEventArray,
        },
      );
    }

    let cache = await loadMemoryEventsCache(workspaceDir);

    if (cache === null) {
      cache = await initializeCacheFromOpenViking(
        workspaceDir,
        baseUrl,
        {
          listWorkspaceMemoryEvents: listWorkspaceMemoryEvents,
          listOpenVikingMemoryEvents: listOpenVikingMemoryEventArray,
        },
      );
    }

    return cache;
  };
  const loadMemoryEvents = async (): Promise<MemoryEvent[]> => {
    try {
      return await listOpenVikingMemoryEventArray({ baseUrl });
    } catch {
      return listWorkspaceMemoryEvents({
        workspaceDir,
      });
    }
  };
  const loadCandidateMemories = async (): Promise<CandidateMemory[]> => {
    try {
      const result = await listCandidateMemories({ baseUrl });

      // Fallback to workspace if OpenViking returns empty
      if (result.length === 0) {
        return listWorkspaceCandidateMemories({
          workspaceDir,
        });
      }

      return result;
    } catch {
      return listWorkspaceCandidateMemories({
        workspaceDir,
      });
    }
  };
  const refreshMemoryNarratives = async (
    buildNarratives: (input: { memoryEvents: MemoryEvent[] }) => MemoryNarrative[],
  ) => {
    const memoryEvents = await loadMemoryEvents();

    await publishMemoryNarratives(
      buildNarratives({
        memoryEvents,
      }),
    );
  };
  const scheduleMemoryNarrativeRefresh = (
    sync: { importedCount: number },
    buildNarratives: (input: { memoryEvents: MemoryEvent[] }) => MemoryNarrative[],
  ) => {
    if (sync.importedCount === 0) {
      return;
    }

    void refreshMemoryNarratives(buildNarratives).catch(() => undefined);
  };
  const mergeTopicKnowledgeCandidate = async (
    mergeCandidate: KnowledgeArtifact,
    mergedAt?: string,
  ): Promise<ReturnType<typeof mergeDailyReviewIntoTopicKnowledge>> => {
    const knowledgeArtifacts = await loadKnowledgeArtifacts();
    const result = mergeTopicKnowledge({
      candidate: mergeCandidate,
      existingKnowledgeArtifacts: knowledgeArtifacts,
      mergedAt: mergedAt ?? mergeCandidate.updatedAt,
    });

    const updatedArtifacts = result.supersededArtifact
      ? [result.supersededArtifact, result.artifact]
      : [result.artifact];
    const refreshedArtifacts = await refreshKnowledgeRelations(updatedArtifacts);
    const refreshedById = new Map(
      refreshedArtifacts.map((artifact) => [artifact.id, artifact]),
    );

    return {
      ...result,
      artifact: refreshedById.get(result.artifact.id) ?? result.artifact,
      supersededArtifact:
        result.supersededArtifact === undefined
          ? undefined
          : refreshedById.get(result.supersededArtifact.id) ?? result.supersededArtifact,
    };
  };
  const listTopicKnowledgeArtifacts = async (): Promise<KnowledgeArtifact[]> => {
    const knowledgeArtifacts = await loadKnowledgeArtifacts();

    return knowledgeArtifacts.filter(
      (artifact) => artifact.artifactType === 'topic-knowledge',
    );
  };

  return {
    service: input.service,
    syncBrowserMemory: async () => {
      const sync = await input.service.syncBrowserMemory();
      scheduleMemoryNarrativeRefresh(sync, buildBrowserThemeNarratives);

      if (sync.importedEvents && sync.importedEvents.length > 0) {
        void updateCacheWithNewEvents(workspaceDir, baseUrl, sync.importedEvents, 'browser').catch(
          () => undefined,
        );
      }

      return summarizeImportedEvents(sync) as BrowserMemorySyncResult;
    },
    syncShellMemory: async () => {
      const sync = await input.service.syncShellMemory();
      scheduleMemoryNarrativeRefresh(sync, buildShellProblemNarratives);

      if (sync.importedEvents && sync.importedEvents.length > 0) {
        void updateCacheWithNewEvents(workspaceDir, baseUrl, sync.importedEvents, 'shell').catch(
          () => undefined,
        );
      }

      return summarizeImportedEvents(sync) as ShellMemorySyncResult;
    },
    listMemoryEvents: async (input?: { page?: number; pageSize?: number }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 10;
      const cache = await loadOrInitializeCache();
      const { events, total, totalPages } = getEventsFromCache(cache, page, pageSize);

      return {
        items: events,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
        },
      };
    },
    listMemoryNarratives: () =>
      listMemoryNarratives({
        baseUrl,
      }),
    queryMemory: (input: MemoryQueryInput) =>
      queryMemory({
        baseUrl,
        query: input.query,
        timeRange: input.timeRange,
        sourceTypes: input.sourceTypes,
      }),
    listKnowledge: loadKnowledgeArtifacts,
    listKnowledgeTopics: async () => {
      const topicKnowledgeArtifacts = await listTopicKnowledgeArtifacts();
      const currentBestByTopicKey = new Map<string, KnowledgeArtifact>();

      for (const artifact of topicKnowledgeArtifacts) {
        if (artifact.topicKey === null) {
          continue;
        }

        const current = currentBestByTopicKey.get(artifact.topicKey ?? '');

        if (
          current === undefined ||
          artifact.isCurrentBest ||
          (current.isCurrentBest === false && (artifact.version ?? 0) > (current.version ?? 0))
        ) {
          currentBestByTopicKey.set(artifact.topicKey ?? '', artifact);
        }
      }

      return Array.from(currentBestByTopicKey.entries())
        .map(([topicKey, artifact]) => ({
          topicKey,
          title: artifact.title ?? artifact.id,
          summary: artifact.summary ?? '',
          currentBestKnowledgeId: artifact.id,
          updatedAt: artifact.updatedAt,
          recencyLabel: artifact.recencyLabel ?? '',
        }))
        .sort((left, right) =>
          (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''),
        );
    },
    getKnowledgeTopic: async (topicKey: string) => {
      const topicKnowledgeArtifacts = await listTopicKnowledgeArtifacts();

      return (
        topicKnowledgeArtifacts
          .filter((artifact) => artifact.topicKey === topicKey)
          .sort((left, right) => {
            if (left.isCurrentBest !== right.isCurrentBest) {
              return left.isCurrentBest ? -1 : 1;
            }

            return (right.version ?? 0) - (left.version ?? 0);
          })[0] ?? null
      );
    },
    listKnowledgeHistory: async (topicKey: string) => {
      const topicKnowledgeArtifacts = await listTopicKnowledgeArtifacts();

      return topicKnowledgeArtifacts
        .filter((artifact) => artifact.topicKey === topicKey)
        .sort((left, right) => (right.version ?? 0) - (left.version ?? 0));
    },
    buildTopicKnowledgeCandidates: async (): Promise<KnowledgeArtifact[]> => {
      const knowledgeArtifacts = await loadKnowledgeArtifacts();

      return buildTopicCandidates({
        knowledgeDrafts: knowledgeArtifacts,
      });
    },
    mergeTopicKnowledgeCandidate,
    mergeDailyReviewIntoTopicKnowledge: async (
      draftOrCandidate: KnowledgeArtifact,
      mergedAt?: string,
    ): Promise<ReturnType<typeof mergeDailyReviewIntoTopicKnowledge>> => {
      const mergeCandidate =
        draftOrCandidate.artifactType === 'topic-merge-candidate'
          ? draftOrCandidate
          : buildTopicCandidates({
              knowledgeDrafts: [draftOrCandidate],
            })[0] ?? draftOrCandidate;

      return mergeTopicKnowledgeCandidate(mergeCandidate, mergedAt);
    },
    listSkillDrafts: loadSkillArtifacts,
    publishKnowledge: async (artifact: Parameters<typeof ingestKnowledgeArtifactToOpenViking>[0]['artifact']) => {
      await clearDeletedArtifact('knowledge', artifact.id);
      await refreshKnowledgeRelations([artifact]);
    },
    publishSkillDraft: (artifact: Parameters<typeof ingestSkillArtifactToOpenViking>[0]['artifact']) =>
      clearDeletedArtifact('skills', artifact.id).then(() =>
        publishSkill({
          baseUrl,
          workspaceDir,
          artifact,
        }),
      ),
    deleteKnowledgeArtifact,
    deleteSkillArtifact,
    generateKnowledgeFromReviewedMemories: async (
      reviewedMemories: ReviewedMemory[],
    ): Promise<KnowledgeArtifact> => {
      const artifact = await generateKnowledge({
        reviewedMemories,
      });

      await clearDeletedArtifact('knowledge', artifact.id);
      const [refreshedArtifact] = await refreshKnowledgeRelations([artifact]);

      return refreshedArtifact ?? artifact;
    },
    generateSkillDraftFromReviewedMemories: async (
      reviewedMemories: ReviewedMemory[],
    ): Promise<SkillArtifact> => {
      const artifact = generateSkillDraft(reviewedMemories);

      await clearDeletedArtifact('skills', artifact.id);
      await publishSkill({
        baseUrl,
        workspaceDir,
        artifact,
      });

      return artifact;
    },
    regenerateKnowledgeDraft: async (
      existingDraft: KnowledgeArtifact,
      reviewedMemories: ReviewedMemory[],
    ): Promise<KnowledgeArtifact> => {
      // Use existing draft as context for refinement
      const artifact = await generateKnowledge({
        reviewedMemories,
        existingDraft,
      });

      await clearDeletedArtifact('knowledge', artifact.id);
      const [refreshedArtifact] = await refreshKnowledgeRelations([artifact]);

      return refreshedArtifact ?? artifact;
    },
    approveKnowledgeDraft: async (
      draftId: string,
      draftSnapshot?: KnowledgeArtifact,
    ): Promise<{
      publishedArtifact: KnowledgeArtifact;
      assignedTopic: { topicKey: string; title: string };
    }> => {
      if (draftSnapshot !== undefined && draftSnapshot.id !== draftId) {
        throw new Error(
          `Knowledge draft id mismatch: expected ${draftId}, received ${draftSnapshot.id}`,
        );
      }

      const knowledgeArtifacts = await loadKnowledgeArtifacts();
      const draft =
        knowledgeArtifacts.find((artifact) => artifact.id === draftId) ??
        draftSnapshot;

      if (draft === undefined) {
        throw new Error(`Knowledge draft not found: ${draftId}`);
      }

      const mergeCandidate =
        draft.artifactType === 'topic-merge-candidate'
          ? draft
          : buildTopicCandidates({
              knowledgeDrafts: [draft],
            })[0] ?? draft;
      const result = await mergeTopicKnowledgeCandidate(
        mergeCandidate,
        new Date().toISOString(),
      );
      const publishedArtifact = result.artifact;
      const topicKey = publishedArtifact.topicKey ?? draft.topicKey ?? 'untitled-topic';
      const title = publishedArtifact.title ?? draft.title ?? 'Untitled Knowledge';
      await Promise.all(
        (publishedArtifact.derivedFromKnowledgeIds ?? [])
          .filter((id) => id.startsWith('knowledge-draft:'))
          .map((id) => deleteKnowledgeArtifactById(id)),
      );

      return {
        publishedArtifact,
        assignedTopic: {
          topicKey,
          title,
        },
      };
    },
    reviewCandidateMemory: async (
      candidate: CandidateMemory,
      review: Parameters<typeof reviewCandidateMemory>[1],
    ): Promise<ReviewedMemory> => {
      const artifact = await reviewMemory(candidate, review);

      await publishReviewedMemory({
        baseUrl,
        workspaceDir,
        artifact,
      });

      // If discard decision, delete the candidate memory file
      if (review.decision === 'discard') {
        const candidateFilePath = join(
          workspaceDir,
          'mirrorbrain',
          'candidate-memories',
          `${candidate.id}.json`,
        );

        try {
          await unlink(candidateFilePath);
        } catch {
          // Ignore deletion errors - candidate may not exist as file
        }
      }

      return artifact;
    },
    undoCandidateReview: async (reviewedMemoryId: string): Promise<void> => {
      await undoReviewedMemory(reviewedMemoryId, workspaceDir);
    },
    deleteCandidateMemory,
    createDailyCandidateMemories: async (
      reviewDate: string,
      reviewTimeZone?: string,
    ): Promise<CandidateMemory[]> => {
      // Query existing candidates first
      const existingCandidates = await loadCandidateMemories();
      const candidatesForDate = existingCandidates.filter(
        (candidate) => candidate.reviewDate === reviewDate,
      );

      // If candidates already exist, return them directly
      if (candidatesForDate.length > 0) {
        return candidatesForDate;
      }

      // Otherwise, generate new candidates
      await input.service.syncBrowserMemory();

      const memoryEvents = await listRawWorkspaceMemoryEvents({
        workspaceDir,
      });
      const enrichedMemoryEvents = await Promise.all(
        memoryEvents.map(async (event) => {
          if (event.sourceType !== 'activitywatch-browser') {
            return event;
          }

          const url =
            typeof event.content.url === 'string' ? event.content.url : null;

          if (url === null) {
            return event;
          }

          const pageArtifact = await loadBrowserPageArtifact({
            workspaceDir,
            url,
          });

          if (pageArtifact === null) {
            return event;
          }

          return {
            ...event,
            content: {
              ...event.content,
              pageTitle: pageArtifact.title,
              pageText: pageArtifact.text,
            },
          };
        }),
      );
      const artifacts = await buildCandidateMemories({
        reviewDate,
        reviewTimeZone,
        memoryEvents: enrichedMemoryEvents,
      });

      for (const artifact of artifacts) {
        await publishCandidateMemory({
          baseUrl,
          workspaceDir,
          artifact,
        });
      }

      return artifacts;
    },
    suggestCandidateReviews: async (
      candidates: CandidateMemory[],
    ): Promise<CandidateReviewSuggestion[]> =>
      analyzeCandidateReviews(candidates),
    listCandidateMemoriesByDate: async (
      reviewDate: string,
    ): Promise<CandidateMemory[]> => {
      const allCandidates = await loadCandidateMemories();

      return allCandidates.filter((candidate) => candidate.reviewDate === reviewDate);
    },
    createCandidateMemory: async (
      memoryEvents: MemoryEvent[],
    ): Promise<CandidateMemory> => {
      const [artifact] = await buildCandidateMemories({
        reviewDate: memoryEvents[0]?.timestamp.slice(0, 10) ?? '',
        memoryEvents,
      });

      if (!artifact) {
        throw new Error('No candidate memory could be created.');
      }

      await publishCandidateMemory({
        baseUrl,
        workspaceDir,
        artifact,
      });

      return artifact;
    },
  };
}
