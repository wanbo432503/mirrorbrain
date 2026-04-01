import { getMirrorBrainConfig } from '../../shared/config/index.js';
import {
  createFileSyncCheckpointStore,
  type SyncCheckpointStore,
} from '../../integrations/file-sync-checkpoint-store/index.js';
import {
  ingestCandidateMemoryToOpenViking,
  ingestMemoryEventToOpenViking,
  ingestKnowledgeArtifactToOpenViking,
  ingestReviewedMemoryToOpenViking,
  ingestSkillArtifactToOpenViking,
  type OpenVikingMemoryEventWriter,
} from '../../integrations/openviking-store/index.js';
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
import { runDailyReview } from '../../workflows/daily-review/index.js';
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
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';

interface StartMirrorBrainServiceInput {
  config?: ReturnType<typeof getMirrorBrainConfig>;
  workspaceDir?: string;
  browserBucketId?: string;
  browserScopeId?: string;
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
  runBrowserMemorySyncOnce?: typeof runBrowserMemorySyncOnce;
  now?: () => string;
}

interface MirrorBrainRuntimeService {
  readonly status: 'running' | 'stopped';
  readonly config?: ReturnType<typeof getMirrorBrainConfig>;
  syncBrowserMemory(): Promise<BrowserMemorySyncResult>;
  stop(): void;
}

interface CreateMirrorBrainServiceInput {
  service: MirrorBrainRuntimeService;
  workspaceDir?: string;
}

interface CreateMirrorBrainServiceDependencies {
  queryMemory?: typeof queryMemoryFromPluginApi;
  listKnowledge?: typeof listKnowledgeFromPluginApi;
  listSkillDrafts?: typeof listSkillDraftsFromPluginApi;
  publishKnowledge?: typeof ingestKnowledgeArtifactToOpenViking;
  publishSkill?: typeof ingestSkillArtifactToOpenViking;
  publishCandidateMemory?: typeof ingestCandidateMemoryToOpenViking;
  publishReviewedMemory?: typeof ingestReviewedMemoryToOpenViking;
  generateKnowledge?: typeof runDailyReview;
  generateSkillDraft?: typeof buildSkillDraftFromReviewedMemories;
  reviewMemory?: typeof reviewCandidateMemory;
  createCandidateMemories?: typeof createCandidateMemories;
  suggestCandidateReviews?: typeof suggestCandidateReviews;
}

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

export function startMirrorBrainService(
  input: StartMirrorBrainServiceInput = {},
  dependencies: StartMirrorBrainServiceDependencies = {},
): MirrorBrainRuntimeService & {
  config: ReturnType<typeof getMirrorBrainConfig>;
} {
  const config = input.config ?? getMirrorBrainConfig();
  const workspaceDir = input.workspaceDir ?? process.cwd();
  const browserBucketId = input.browserBucketId ?? 'aw-watcher-web-chrome';
  const browserScopeId = input.browserScopeId ?? 'scope-browser';
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
  const now = dependencies.now ?? (() => new Date().toISOString());
  const syncBrowserMemory = () =>
    executeBrowserMemorySyncOnce(
      {
        config,
        now: now(),
        bucketId: browserBucketId,
        scopeId: browserScopeId,
      },
      {
        checkpointStore,
        writeMemoryEvent: memoryEventWriter.writeMemoryEvent,
      },
    );
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
  const listKnowledge = dependencies.listKnowledge ?? listKnowledgeFromPluginApi;
  const listSkillDrafts =
    dependencies.listSkillDrafts ?? listSkillDraftsFromPluginApi;
  const publishKnowledge =
    dependencies.publishKnowledge ?? ingestKnowledgeArtifactToOpenViking;
  const publishSkill =
    dependencies.publishSkill ?? ingestSkillArtifactToOpenViking;
  const publishCandidateMemory =
    dependencies.publishCandidateMemory ?? ingestCandidateMemoryToOpenViking;
  const publishReviewedMemory =
    dependencies.publishReviewedMemory ?? ingestReviewedMemoryToOpenViking;
  const generateKnowledge = dependencies.generateKnowledge ?? runDailyReview;
  const generateSkillDraft =
    dependencies.generateSkillDraft ?? buildSkillDraftFromReviewedMemories;
  const reviewMemory = dependencies.reviewMemory ?? reviewCandidateMemory;
  const buildCandidateMemories =
    dependencies.createCandidateMemories ?? createCandidateMemories;
  const analyzeCandidateReviews =
    dependencies.suggestCandidateReviews ?? suggestCandidateReviews;

  return {
    service: input.service,
    syncBrowserMemory: () => input.service.syncBrowserMemory(),
    queryMemory: () =>
      queryMemory({
        baseUrl,
      }),
    listKnowledge: () =>
      listKnowledge({
        baseUrl,
      }),
    listSkillDrafts: () =>
      listSkillDrafts({
        baseUrl,
      }),
    publishKnowledge: (artifact: Parameters<typeof ingestKnowledgeArtifactToOpenViking>[0]['artifact']) =>
      publishKnowledge({
        baseUrl,
        workspaceDir,
        artifact,
      }),
    publishSkillDraft: (artifact: Parameters<typeof ingestSkillArtifactToOpenViking>[0]['artifact']) =>
      publishSkill({
        baseUrl,
        workspaceDir,
        artifact,
      }),
    generateKnowledgeFromReviewedMemories: async (
      reviewedMemories: ReviewedMemory[],
    ): Promise<KnowledgeArtifact> => {
      const artifact = generateKnowledge({
        reviewedMemories,
      });

      await publishKnowledge({
        baseUrl,
        workspaceDir,
        artifact,
      });

      return artifact;
    },
    generateSkillDraftFromReviewedMemories: async (
      reviewedMemories: ReviewedMemory[],
    ): Promise<SkillArtifact> => {
      const artifact = generateSkillDraft(reviewedMemories);

      await publishSkill({
        baseUrl,
        workspaceDir,
        artifact,
      });

      return artifact;
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

      return artifact;
    },
    createDailyCandidateMemories: async (
      reviewDate: string,
      reviewTimeZone?: string,
    ): Promise<CandidateMemory[]> => {
      const memoryEvents = await queryMemory({
        baseUrl,
      });
      const artifacts = await buildCandidateMemories({
        reviewDate,
        reviewTimeZone,
        memoryEvents,
      });

      await Promise.all(
        artifacts.map((artifact) =>
          publishCandidateMemory({
            baseUrl,
            workspaceDir,
            artifact,
          }),
        ),
      );

      return artifacts;
    },
    suggestCandidateReviews: async (
      candidates: CandidateMemory[],
    ): Promise<CandidateReviewSuggestion[]> =>
      analyzeCandidateReviews(candidates),
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
