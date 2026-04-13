import { getMirrorBrainConfig } from '../../shared/config/index.js';
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
  listMirrorBrainMemoryNarrativesFromOpenViking,
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

interface CreateMirrorBrainServiceDependencies {
  queryMemory?: typeof queryMemoryFromPluginApi;
  listMemoryEvents?: typeof listMirrorBrainMemoryEventsFromOpenViking;
  listMemoryNarratives?: typeof listMirrorBrainMemoryNarrativesFromOpenViking;
  listKnowledge?: typeof listKnowledgeFromPluginApi;
  listSkillDrafts?: typeof listSkillDraftsFromPluginApi;
  publishMemoryNarrative?: typeof ingestMemoryNarrativeToOpenViking;
  publishKnowledge?: typeof ingestKnowledgeArtifactToOpenViking;
  publishSkill?: typeof ingestSkillArtifactToOpenViking;
  publishCandidateMemory?: typeof ingestCandidateMemoryToOpenViking;
  publishReviewedMemory?: typeof ingestReviewedMemoryToOpenViking;
  buildBrowserThemeNarratives?: typeof generateBrowserThemeNarratives;
  buildShellProblemNarratives?: typeof generateShellProblemNarratives;
  buildTopicKnowledgeCandidates?: typeof buildTopicKnowledgeCandidates;
  mergeTopicKnowledge?: typeof mergeDailyReviewIntoTopicKnowledge;
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
  const listMemoryNarratives =
    dependencies.listMemoryNarratives ?? listMirrorBrainMemoryNarrativesFromOpenViking;
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
  const buildBrowserThemeNarratives =
    dependencies.buildBrowserThemeNarratives ?? generateBrowserThemeNarratives;
  const buildShellProblemNarratives =
    dependencies.buildShellProblemNarratives ?? generateShellProblemNarratives;
  const buildTopicCandidates =
    dependencies.buildTopicKnowledgeCandidates ?? buildTopicKnowledgeCandidates;
  const mergeTopicKnowledge =
    dependencies.mergeTopicKnowledge ?? mergeDailyReviewIntoTopicKnowledge;
  const generateKnowledge = dependencies.generateKnowledge ?? runDailyReview;
  const generateSkillDraft =
    dependencies.generateSkillDraft ?? buildSkillDraftFromReviewedMemories;
  const reviewMemory = dependencies.reviewMemory ?? reviewCandidateMemory;
  const buildCandidateMemories =
    dependencies.createCandidateMemories ?? createCandidateMemories;
  const analyzeCandidateReviews =
    dependencies.suggestCandidateReviews ?? suggestCandidateReviews;
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
  const refreshMemoryNarratives = async (
    buildNarratives: (input: { memoryEvents: MemoryEvent[] }) => MemoryNarrative[],
  ) => {
    const memoryEvents = await listMemoryEvents({ baseUrl });

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
    const knowledgeArtifacts = await listKnowledge({
      baseUrl,
    });
    const result = mergeTopicKnowledge({
      candidate: mergeCandidate,
      existingKnowledgeArtifacts: knowledgeArtifacts,
      mergedAt: mergedAt ?? mergeCandidate.updatedAt,
    });

    if (result.supersededArtifact) {
      await publishKnowledge({
        baseUrl,
        workspaceDir,
        artifact: result.supersededArtifact,
      });
    }

    await publishKnowledge({
      baseUrl,
      workspaceDir,
      artifact: result.artifact,
    });

    return result;
  };
  const listTopicKnowledgeArtifacts = async (): Promise<KnowledgeArtifact[]> => {
    const knowledgeArtifacts = await listKnowledge({
      baseUrl,
    });

    return knowledgeArtifacts.filter(
      (artifact) => artifact.artifactType === 'topic-knowledge',
    );
  };

  return {
    service: input.service,
    syncBrowserMemory: async () => {
      const sync = await input.service.syncBrowserMemory();
      scheduleMemoryNarrativeRefresh(sync, buildBrowserThemeNarratives);

      return sync;
    },
    syncShellMemory: async () => {
      const sync = await input.service.syncShellMemory();
      scheduleMemoryNarrativeRefresh(sync, buildShellProblemNarratives);

      return sync;
    },
    listMemoryEvents: () =>
      listMemoryEvents({
        baseUrl,
      }),
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
    listKnowledge: () =>
      listKnowledge({
        baseUrl,
      }),
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
      const knowledgeArtifacts = await listKnowledge({
        baseUrl,
      });

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
      const memoryEvents = await listMemoryEvents({ baseUrl });
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
