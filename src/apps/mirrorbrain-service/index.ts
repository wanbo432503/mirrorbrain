import { mkdir, readFile, readdir, unlink, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import { ValidationError } from './errors.js';
import {
  createFileSyncCheckpointStore,
  type SyncCheckpointStore,
} from '../../integrations/file-sync-checkpoint-store/index.js';
import {
  createFileSourceLedgerStateStore,
  type SourceAuditEventFilter,
  type SourceInstanceConfig,
  type SourceInstanceSummary,
  type SourceLedgerStateStore,
} from '../../integrations/source-ledger-state-store/index.js';
import {
  createFileResourceConfigurationStore,
  type ResourceConfigurationStore,
} from '../../integrations/resource-configuration-store/index.js';
import {
  createQmdWorkspaceMemoryEventRecord,
  createQmdWorkspaceMemoryEventWriter,
  ingestCandidateMemoryToQmdWorkspace,
  ingestMemoryNarrativeToQmdWorkspace,
  ingestReviewedMemoryToQmdWorkspace,
  ingestSkillArtifactToQmdWorkspace,
  listMirrorBrainCandidateMemoriesFromQmdWorkspace,
  listMirrorBrainMemoryEventsFromQmdFiles,
  listMirrorBrainMemoryEventsFromQmdWorkspace,
  listMirrorBrainMemoryNarrativesFromQmdWorkspace,
  listMirrorBrainReviewedMemoriesFromQmdWorkspace,
  listMirrorBrainSkillArtifactsFromQmdWorkspace,
  listRawMirrorBrainMemoryEventsFromQmdFiles,
  listRawMirrorBrainMemoryEventsFromQmdWorkspace,
  type QmdWorkspaceMemoryEventWriter,
} from '../../integrations/qmd-workspace-store/index.js';
import {
  loadMemoryEventsCache,
  saveMemoryEventsCache,
  initializeCacheFromQmdWorkspace,
  updateCacheWithNewEvents,
  getEventsFromCache,
  type MemoryEventsCache,
  type MemoryEventSourceFilter,
} from '../../modules/memory-events-cache/index.js';
import {
  queryMemory as queryMemoryFromAgentApi,
} from '../../integrations/agent-memory-api/index.js';
import {
  runBrowserMemorySyncOnce,
  startBrowserMemorySyncPolling,
  type BrowserPageContentCaptureAuthorizationDependency,
  type BrowserMemorySyncResult,
} from '../../workflows/browser-memory-sync/index.js';
import {
  captureActivityWatchBrowserLedgerRecords,
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
  importChangedSourceLedgers,
  startSourceLedgerImportPolling,
  type SourceLedgerImportResult,
} from '../../workflows/source-ledger-import/index.js';
import {
  startBuiltInSourceLedgerRecorderSupervisor,
  type SourceRecorderSupervisor,
  type SupervisedSourceInstance,
} from '../../workflows/source-recorder-supervisor/index.js';
import {
  appendCapturedSourceRecordsToLedger,
  type CapturedSourceRecordResult,
} from '../../integrations/source-ledger-recorders/index.js';
import {
  analyzeWorkSessionCandidates,
  type AnalysisWindowPreset,
  type WorkSessionAnalysisResult,
} from '../../workflows/work-session-analysis/index.js';
import { buildSkillDraftFromReviewedMemories } from '../../workflows/skill-draft-builder/index.js';
import {
  createCandidateMemories,
  reviewCandidateMemory,
  suggestCandidateReviews,
} from '../../modules/memory-review/index.js';
import {
  createAuthorizationScope,
  createMemorySourceAuthorizationPolicy,
} from '../../modules/authorization-scope-policy/index.js';
import {
  reviewWorkSessionCandidate as reviewPhase4WorkSessionCandidate,
  type ProjectAssignment,
  type ReviewWorkSessionCandidateResult,
  type ReviewedWorkSession,
} from '../../modules/project-work-session/index.js';
import {
  createKnowledgeArticleDraft as createPhase4KnowledgeArticleDraft,
  createKnowledgeArticleRevisionDraft as createPhase4KnowledgeArticleRevisionDraft,
  publishKnowledgeArticleDraft as publishPhase4KnowledgeArticleDraft,
  type CreateKnowledgeArticleDraftInput,
  type KnowledgeArticle,
  type KnowledgeArticleDraft,
  type PublishKnowledgeArticleDraftResult,
  type TopicAssignment,
} from '../../modules/knowledge-article/index.js';
import { decideKnowledgeArticlePublishOperation } from '../../modules/knowledge-article-publish-decision/index.js';
import {
  generateKnowledgeArticlePreview as generatePhase4KnowledgeArticlePreview,
  type GenerateKnowledgeArticlePreviewInput as GeneratePhase4KnowledgeArticlePreviewInput,
  type KnowledgeArticlePreview,
} from '../../modules/knowledge-article-preview/index.js';
import { analyzeKnowledgeWithConfiguredLLM } from '../../modules/knowledge-generation-llm/index.js';
import {
  mergeResourceConfigurationUpdate,
  redactResourceConfiguration,
  type ResourceConfiguration,
  type ResourceConfigurationUpdate,
} from '../../modules/resource-configuration/index.js';
import { reviseKnowledgeArticleContent } from '../../modules/knowledge-article-revision/index.js';
import { createFileKnowledgeArticleStore } from '../../integrations/knowledge-article-store/index.js';
import type {
  AuthorizationScope,
  CandidateMemory,
  CandidateReviewSuggestion,
  MemoryEvent,
  MemoryNarrative,
  MemoryQueryInput,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';
import type { WorkSessionCandidate } from '../../workflows/work-session-analysis/index.js';

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
  startSourceLedgerImportPolling?: typeof startSourceLedgerImportPolling;
  createCheckpointStore?: (input: {
    workspaceDir: string;
  }) => SyncCheckpointStore;
  createMemoryEventWriter?: (input: {
    config: ReturnType<typeof getMirrorBrainConfig>;
    workspaceDir: string;
  }) => QmdWorkspaceMemoryEventWriter;
  createSourceLedgerStateStore?: (input: {
    workspaceDir: string;
  }) => SourceLedgerStateStore;
  importSourceLedgers?: typeof importChangedSourceLedgers;
  startSourceRecorderSupervisor?: typeof startBuiltInSourceLedgerRecorderSupervisor;
  captureSourceRecord?(
    source: SupervisedSourceInstance,
  ): Promise<CapturedSourceRecordResult>;
  fetchActivityWatchBuckets?: typeof fetchActivityWatchBuckets;
  runBrowserMemorySyncOnce?: typeof runBrowserMemorySyncOnce;
  runShellMemorySyncOnce?: typeof runShellMemorySyncOnce;
  getAuthorizationScope?: (scopeId: string) => Promise<AuthorizationScope | null>;
  authorizePageContentCapture?: BrowserPageContentCaptureAuthorizationDependency;
  now?: () => string;
}

interface MirrorBrainRuntimeService {
  readonly status: 'running' | 'stopped';
  readonly config?: ReturnType<typeof getMirrorBrainConfig>;
  syncBrowserMemory(): Promise<BrowserMemorySyncResult>;
  syncShellMemory(): Promise<ShellMemorySyncResult>;
  stop(): void;
}

const DEFAULT_SUPERVISED_SOURCE_INSTANCES: SupervisedSourceInstance[] = [
  { sourceKind: 'browser', sourceInstanceId: 'chrome-main', enabled: true },
  {
    sourceKind: 'file-activity',
    sourceInstanceId: 'filesystem-main',
    enabled: true,
  },
  { sourceKind: 'screenshot', sourceInstanceId: 'desktop-main', enabled: true },
  {
    sourceKind: 'audio-recording',
    sourceInstanceId: 'recording-main',
    enabled: true,
  },
  { sourceKind: 'shell', sourceInstanceId: 'shell-main', enabled: true },
  {
    sourceKind: 'agent',
    sourceInstanceId: 'agent-main',
    enabled: true,
  },
];

function getSourceInstanceSummaryKey(input: {
  sourceKind: string;
  sourceInstanceId: string;
}): string {
  return `${input.sourceKind}:${input.sourceInstanceId}`;
}

function createDefaultSourceInstanceSummary(
  source: SupervisedSourceInstance,
): SourceInstanceSummary {
  return {
    sourceKind: source.sourceKind,
    sourceInstanceId: source.sourceInstanceId,
    lifecycleStatus: source.enabled === false ? 'disabled' : 'enabled',
    recorderStatus: source.enabled === false ? 'stopped' : 'unknown',
    importedCount: 0,
    skippedCount: 0,
  };
}

function mergeDefaultSourceInstanceSummaries(
  summaries: SourceInstanceSummary[],
): SourceInstanceSummary[] {
  const mergedByKey = new Map<string, SourceInstanceSummary>();

  for (const source of DEFAULT_SUPERVISED_SOURCE_INSTANCES) {
    const summary = createDefaultSourceInstanceSummary(source);
    mergedByKey.set(getSourceInstanceSummaryKey(summary), summary);
  }

  for (const summary of summaries) {
    mergedByKey.set(getSourceInstanceSummaryKey(summary), summary);
  }

  return [...mergedByKey.values()].sort((left, right) =>
    getSourceInstanceSummaryKey(left).localeCompare(
      getSourceInstanceSummaryKey(right),
    ),
  );
}

const SOURCE_LEDGER_RUNTIME_INTERVAL_MS = 60 * 1000;

function resolveRuntimeWorkspaceDir(workspaceDir: string | undefined): string {
  const resolvedWorkspaceDir = workspaceDir ?? process.env.MIRRORBRAIN_WORKSPACE_DIR;

  if (resolvedWorkspaceDir === undefined || resolvedWorkspaceDir.length === 0) {
    throw new ValidationError(
      'workspaceDir is required; refusing to use the source directory as a MirrorBrain workspace.',
    );
  }

  return resolvedWorkspaceDir;
}

interface CreateMirrorBrainServiceInput {
  service: MirrorBrainRuntimeService;
  workspaceDir?: string;
  browserBucketId?: string;
  browserScopeId?: string;
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

type WorkspaceStorageInput = {
  workspaceDir: string;
  baseUrl?: string;
};

type ListMemoryEventsDependency = (
  input: WorkspaceStorageInput & { query?: string },
) => Promise<MemoryEventReadResult>;

type ListMemoryNarrativesDependency = (
  input: WorkspaceStorageInput,
) => Promise<MemoryNarrative[]>;

type ListCandidateMemoriesDependency = (
  input: WorkspaceStorageInput,
) => Promise<CandidateMemory[]>;

type ListReviewedMemoriesDependency = (
  input: WorkspaceStorageInput,
) => Promise<ReviewedMemory[]>;

type ListSkillArtifactsDependency = (
  input: WorkspaceStorageInput,
) => Promise<SkillArtifact[]>;

type PublishMemoryNarrativeDependency = (
  input: WorkspaceStorageInput & { artifact: MemoryNarrative },
) => Promise<unknown>;

type PublishSkillDependency = (
  input: WorkspaceStorageInput & { artifact: SkillArtifact },
) => Promise<unknown>;

type PublishCandidateMemoryDependency = (
  input: WorkspaceStorageInput & { artifact: CandidateMemory },
) => Promise<unknown>;

type PublishReviewedMemoryDependency = (
  input: WorkspaceStorageInput & { artifact: ReviewedMemory },
) => Promise<unknown>;

type DeleteCandidateMemoryResourceDependency = (
  input: WorkspaceStorageInput & { candidateMemoryId: string },
) => Promise<unknown>;

type CreateCandidateMemoriesDependency = (
  input: Parameters<typeof createCandidateMemories>[0],
) => CandidateMemory[] | Promise<CandidateMemory[]>;

type AnalyzeWorkSessionCandidatesDependency = (
  input: Parameters<typeof analyzeWorkSessionCandidates>[0],
) => WorkSessionAnalysisResult | Promise<WorkSessionAnalysisResult>;

interface CreateMirrorBrainServiceDependencies {
  queryMemory?: typeof queryMemoryFromAgentApi;
  listMemoryEvents?: ListMemoryEventsDependency;
  listWorkspaceMemoryEvents?: typeof listMirrorBrainMemoryEventsFromQmdFiles;
  listRawWorkspaceMemoryEvents?: typeof listRawMirrorBrainMemoryEventsFromQmdFiles;
  listMemoryNarratives?: ListMemoryNarrativesDependency;
  listCandidateMemories?: ListCandidateMemoriesDependency;
  listWorkspaceCandidateMemories?: typeof listMirrorBrainCandidateMemoriesFromQmdWorkspace;
  listReviewedMemories?: ListReviewedMemoriesDependency;
  listSkillDrafts?: ListSkillArtifactsDependency;
  publishMemoryNarrative?: PublishMemoryNarrativeDependency;
  publishSkill?: PublishSkillDependency;
  publishCandidateMemory?: PublishCandidateMemoryDependency;
  publishReviewedMemory?: PublishReviewedMemoryDependency;
  deleteCandidateMemoryResource?: DeleteCandidateMemoryResourceDependency;
  undoReviewedMemory?: (reviewedMemoryId: string, workspaceDir: string) => Promise<void>;
  buildBrowserThemeNarratives?: typeof generateBrowserThemeNarratives;
  buildShellProblemNarratives?: typeof generateShellProblemNarratives;
  generateSkillDraft?: typeof buildSkillDraftFromReviewedMemories;
  reviewMemory?: typeof reviewCandidateMemory;
  createCandidateMemories?: CreateCandidateMemoriesDependency;
  suggestCandidateReviews?: typeof suggestCandidateReviews;
  loadBrowserPageContentArtifactFromWorkspace?: typeof loadBrowserPageContentArtifactFromWorkspace;
  analyzeKnowledge?: typeof analyzeKnowledgeWithConfiguredLLM;
  generateKnowledgeArticlePreview?: typeof generatePhase4KnowledgeArticlePreview;
  createMemoryEventWriter?: (input: {
    config: ReturnType<typeof getMirrorBrainConfig>;
    workspaceDir: string;
  }) => QmdWorkspaceMemoryEventWriter;
  createCheckpointStore?: (input: {
    workspaceDir: string;
  }) => SyncCheckpointStore;
  createSourceLedgerStateStore?: (input: {
    workspaceDir: string;
  }) => SourceLedgerStateStore;
  createResourceConfigurationStore?: (input: {
    workspaceDir: string;
  }) => ResourceConfigurationStore;
  importSourceLedgers?: typeof importChangedSourceLedgers;
  captureBrowserLedgerRecords?: typeof captureActivityWatchBrowserLedgerRecords;
  fetchActivityWatchBuckets?: typeof fetchActivityWatchBuckets;
  analyzeWorkSessions?: AnalyzeWorkSessionCandidatesDependency;
  now?: () => string;
}

interface AnalyzeWorkSessionsInput {
  preset: AnalysisWindowPreset;
}

interface ReviewWorkSessionInput {
  decision: 'keep' | 'discard';
  reviewedBy: string;
  title?: string;
  summary?: string;
  projectAssignment?: ProjectAssignment;
}

type GenerateKnowledgeArticleDraftInput = Omit<
  CreateKnowledgeArticleDraftInput,
  'generatedAt' | 'reviewedWorkSessions'
> & {
  reviewedWorkSessionIds: string[];
};

type GenerateKnowledgeArticlePreviewServiceInput = Omit<
  GeneratePhase4KnowledgeArticlePreviewInput,
  'generatedAt' | 'analyzeWithLLM'
>;

interface PublishKnowledgeArticleDraftServiceInput {
  draft: KnowledgeArticleDraft;
  publishedBy: string;
  topicAssignment: TopicAssignment;
  autoResolvePublishDecision?: boolean;
}

interface ReviseKnowledgeArticleServiceInput {
  projectId: string;
  topicId: string;
  articleId: string;
  instruction: string;
  revisedBy: string;
}

function normalizeMemoryEventReadResult(result: MemoryEventReadResult): MemoryEvent[] {
  return Array.isArray(result) ? result : result.items;
}

function isReviewedMemoryLike(value: unknown): value is ReviewedMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'candidateMemoryId' in value &&
    'memoryEventIds' in value &&
    Array.isArray((value as { memoryEventIds?: unknown }).memoryEventIds)
  );
}

function isReviewedWorkSessionLike(value: unknown): value is ReviewedWorkSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'candidateId' in value &&
    'memoryEventIds' in value &&
    'reviewState' in value
  );
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

type DeletedArtifactKind = 'skills';

function isUnsafeArtifactId(artifactId: string): boolean {
  return (
    artifactId.includes('..') ||
    artifactId.includes('/') ||
    artifactId.includes('\\')
  );
}

function validateKnowledgeArticleId(articleId: string): void {
  if (!articleId.startsWith('article:') || isUnsafeArtifactId(articleId)) {
    throw new ValidationError(`Invalid Knowledge Article ID format: ${articleId}`);
  }
}

function validateSkillArtifactId(artifactId: string): void {
  if (!artifactId.startsWith('skill-draft:') || isUnsafeArtifactId(artifactId)) {
    throw new ValidationError(`Invalid skill artifact ID format: ${artifactId}`);
  }
}

const SYNC_IMPORTED_EVENT_PREVIEW_LIMIT = 50;

function createDefaultMemoryEventWriter(input: {
  workspaceDir: string;
}): QmdWorkspaceMemoryEventWriter {
  return createQmdWorkspaceMemoryEventWriter({
    workspaceDir: input.workspaceDir,
  });
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
  const workspaceDir = resolveRuntimeWorkspaceDir(input.workspaceDir);
  const configuredBrowserBucketId = input.browserBucketId;
  const browserScopeId = input.browserScopeId ?? 'scope-browser';
  const shellHistoryPath = input.shellHistoryPath;
  const shellScopeId = input.shellScopeId ?? 'scope-shell';
  const startPolling =
    dependencies.startBrowserSyncPolling ?? startBrowserMemorySyncPolling;
  const startSourceImportPolling =
    dependencies.startSourceLedgerImportPolling ?? startSourceLedgerImportPolling;
  const startRecorderSupervisor =
    dependencies.startSourceRecorderSupervisor ??
    startBuiltInSourceLedgerRecorderSupervisor;
  const dependencyCaptureSourceRecord = dependencies.captureSourceRecord;
  const checkpointStore = (
    dependencies.createCheckpointStore ?? createFileSyncCheckpointStore
  )({
    workspaceDir,
  });
  const memoryEventWriter = (
    dependencies.createMemoryEventWriter ?? createDefaultMemoryEventWriter
  )({
    config,
    workspaceDir,
  });
  const executeBrowserMemorySyncOnce =
    dependencies.runBrowserMemorySyncOnce ?? runBrowserMemorySyncOnce;
  const executeShellMemorySyncOnce =
    dependencies.runShellMemorySyncOnce ?? runShellMemorySyncOnce;
  const sourceLedgerStateStore = (
    dependencies.createSourceLedgerStateStore ?? createFileSourceLedgerStateStore
  )({
    workspaceDir,
  });
  const executeSourceLedgerImport =
    dependencies.importSourceLedgers ?? importChangedSourceLedgers;
  const loadActivityWatchBuckets =
    dependencies.fetchActivityWatchBuckets ?? fetchActivityWatchBuckets;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const getAuthorizationScope =
    dependencies.getAuthorizationScope ??
    (async (scopeId: string): Promise<AuthorizationScope | null> => {
      if (scopeId === browserScopeId) {
        return createAuthorizationScope({
          id: browserScopeId,
          sourceCategory: 'browser',
        });
      }

      if (scopeId === shellScopeId) {
        return createAuthorizationScope({
          id: shellScopeId,
          sourceCategory: 'shell',
        });
      }

      return null;
    });
  const authorizeSourceSync = createMemorySourceAuthorizationPolicy({
    getAuthorizationScope,
  });
  const authorizePageContentCapture: BrowserPageContentCaptureAuthorizationDependency =
    dependencies.authorizePageContentCapture ?? (async () => false);
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
  const captureSourceRecord = async (
    source: SupervisedSourceInstance,
  ): Promise<CapturedSourceRecordResult> => {
    if (dependencyCaptureSourceRecord !== undefined) {
      return dependencyCaptureSourceRecord(source);
    }

    if (source.sourceKind !== 'browser') {
      return null;
    }

    const bucket = await resolveBrowserBucket();

    return captureActivityWatchBrowserLedgerRecords(
      {
        bucketId: bucket.id,
        config,
        initialBackfillStartAt: bucket.created,
        now: now(),
        scopeId: browserScopeId,
      },
      {
        authorizeSourceSync,
        checkpointStore,
      },
    );
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
        authorizeSourceSync,
        authorizePageContentCapture,
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
        authorizeSourceSync,
        writeMemoryEvent: memoryEventWriter.writeMemoryEvent,
      },
    );
  };
  const importSourceLedgersOnce = (): Promise<SourceLedgerImportResult> =>
    executeSourceLedgerImport(
      {
        authorizationScopeId: 'scope-source-ledger',
        importedAt: now(),
        workspaceDir,
      },
      {
        readCheckpoint: sourceLedgerStateStore.readCheckpoint,
        writeCheckpoint: sourceLedgerStateStore.writeCheckpoint,
        writeMemoryEvent: async (event) => {
          await memoryEventWriter.writeMemoryEvent(
            createQmdWorkspaceMemoryEventRecord(event),
          );
        },
        writeSourceAuditEvent: sourceLedgerStateStore.writeSourceAuditEvent,
        isSourceImportAllowed: async ({ sourceKind, sourceInstanceId }) => {
          const configs = await sourceLedgerStateStore.listSourceInstanceConfigs();
          const sourceConfig = configs.find(
            (item) =>
              item.sourceKind === sourceKind &&
              item.sourceInstanceId === sourceInstanceId,
          );

          return sourceConfig?.enabled !== false;
        },
      },
    );
  const resolveSupervisedSources = async (): Promise<SupervisedSourceInstance[]> => {
    const configs = await sourceLedgerStateStore.listSourceInstanceConfigs();
    const sourceByKey = new Map(
      DEFAULT_SUPERVISED_SOURCE_INSTANCES.map((source) => [
        `${source.sourceKind}:${source.sourceInstanceId}`,
        { ...source },
      ]),
    );

    for (const config of configs) {
      sourceByKey.set(`${config.sourceKind}:${config.sourceInstanceId}`, {
        sourceKind: config.sourceKind,
        sourceInstanceId: config.sourceInstanceId,
        enabled: config.enabled,
      });
    }

    return Array.from(sourceByKey.values());
  };
  const sourceImportPolling = startSourceImportPolling(
    {
      schedule: {
        scanIntervalMs: SOURCE_LEDGER_RUNTIME_INTERVAL_MS,
      },
    },
    {
      runImportOnce: importSourceLedgersOnce,
    },
  );
  let recorderSupervisor: SourceRecorderSupervisor | null = null;
  let shouldStopRecorderSupervisor = false;
  const recorderSupervisorPromise = resolveSupervisedSources()
    .then((sources) =>
      startRecorderSupervisor(
        {
          intervalMs: SOURCE_LEDGER_RUNTIME_INTERVAL_MS,
          workspaceDir,
          sources,
          now,
        },
        {
          captureSourceRecord,
          writeSourceAuditEvent: sourceLedgerStateStore.writeSourceAuditEvent,
        },
      ),
    )
    .then((supervisor) => {
      recorderSupervisor = supervisor;
      if (shouldStopRecorderSupervisor) {
        void supervisor.stop();
      }
      return supervisor;
    })
    .catch(() => null);
  let status: 'running' | 'stopped' = 'running';

  return {
    get status() {
      return status;
    },
    config,
    syncBrowserMemory,
    syncShellMemory,
    stop() {
      sourceImportPolling.stop();
      shouldStopRecorderSupervisor = true;
      if (recorderSupervisor !== null) {
        void recorderSupervisor.stop();
      }
      status = 'stopped';
    },
  };
}

export function createMirrorBrainService(
  input: CreateMirrorBrainServiceInput,
  dependencies: CreateMirrorBrainServiceDependencies = {},
) {
  const serviceConfig = input.service.config ?? getMirrorBrainConfig();
  const workspaceDir = resolveRuntimeWorkspaceDir(input.workspaceDir);
  const browserScopeId = input.browserScopeId ?? 'scope-browser';
  const knowledgeArticleStore = createFileKnowledgeArticleStore({
    workspaceDir,
  });
  const now = dependencies.now ?? (() => new Date().toISOString());
  const queryMemory = dependencies.queryMemory ?? queryMemoryFromAgentApi;
  const listMemoryEvents =
    dependencies.listMemoryEvents ?? listMirrorBrainMemoryEventsFromQmdWorkspace;
  const listWorkspaceMemoryEvents =
    dependencies.listWorkspaceMemoryEvents ?? listMirrorBrainMemoryEventsFromQmdWorkspace;
  const listRawWorkspaceMemoryEvents =
    dependencies.listRawWorkspaceMemoryEvents ?? listRawMirrorBrainMemoryEventsFromQmdWorkspace;
  const listMemoryNarratives =
    dependencies.listMemoryNarratives ?? listMirrorBrainMemoryNarrativesFromQmdWorkspace;
  const listCandidateMemories =
    dependencies.listCandidateMemories ?? listMirrorBrainCandidateMemoriesFromQmdWorkspace;
  const listWorkspaceCandidateMemories =
    dependencies.listWorkspaceCandidateMemories ?? listMirrorBrainCandidateMemoriesFromQmdWorkspace;
  const listSkillDrafts =
    dependencies.listSkillDrafts ?? listMirrorBrainSkillArtifactsFromQmdWorkspace;
  const publishMemoryNarrative =
    dependencies.publishMemoryNarrative ?? ingestMemoryNarrativeToQmdWorkspace;
  const publishSkill =
    dependencies.publishSkill ?? ingestSkillArtifactToQmdWorkspace;
  const publishCandidateMemory =
    dependencies.publishCandidateMemory ?? ingestCandidateMemoryToQmdWorkspace;
  const publishReviewedMemory =
    dependencies.publishReviewedMemory ?? ingestReviewedMemoryToQmdWorkspace;
  const deleteCandidateMemoryResource =
    dependencies.deleteCandidateMemoryResource ?? (async () => undefined);
  const memoryEventWriter = (
    dependencies.createMemoryEventWriter ?? createDefaultMemoryEventWriter
  )({
    config: serviceConfig,
    workspaceDir,
  });
  const checkpointStore = (
    dependencies.createCheckpointStore ?? createFileSyncCheckpointStore
  )({
    workspaceDir,
  });
  const sourceLedgerStateStore = (
    dependencies.createSourceLedgerStateStore ?? createFileSourceLedgerStateStore
  )({
    workspaceDir,
  });
  const resourceConfigurationStore = (
    dependencies.createResourceConfigurationStore ?? createFileResourceConfigurationStore
  )({
    workspaceDir,
  });
  const importSourceLedgers =
    dependencies.importSourceLedgers ?? importChangedSourceLedgers;
  const captureBrowserLedgerRecords =
    dependencies.captureBrowserLedgerRecords ??
    captureActivityWatchBrowserLedgerRecords;
  const loadActivityWatchBuckets =
    dependencies.fetchActivityWatchBuckets ?? fetchActivityWatchBuckets;
  const analyzeWorkSessions =
    dependencies.analyzeWorkSessions ?? analyzeWorkSessionCandidates;
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

      try {
        await unlink(reviewedFilePath);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return;
        }
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

    let workspaceDeleteError: unknown = null;

    try {
      await unlink(candidateFilePath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      } else {
        workspaceDeleteError = error;
      }
    }

    await deleteCandidateMemoryResource({
      workspaceDir,
      candidateMemoryId,
    });

    if (workspaceDeleteError !== null) {
      throw workspaceDeleteError;
    }
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
  const loadBrowserPageArtifact =
    dependencies.loadBrowserPageContentArtifactFromWorkspace ??
    loadBrowserPageContentArtifactFromWorkspace;
  const analyzeKnowledge = dependencies.analyzeKnowledge ?? analyzeKnowledgeWithConfiguredLLM;
  const generateArticlePreview =
    dependencies.generateKnowledgeArticlePreview ?? generatePhase4KnowledgeArticlePreview;
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
  const loadSkillArtifacts = async (): Promise<SkillArtifact[]> => {
    const [storedSkills, workspaceSkills, deletedSkillIds] = await Promise.all([
      listSkillDrafts({
        workspaceDir,
      }).catch(() => [] as SkillArtifact[]),
      listMirrorBrainSkillArtifactsFromQmdWorkspace({
        workspaceDir,
      }).catch(() => [] as SkillArtifact[]),
      loadDeletedArtifactIds('skills'),
    ]);

    return mergeArtifactsById(
      storedSkills.filter((artifact) => !deletedSkillIds.has(artifact.id)),
      workspaceSkills.filter((artifact) => !deletedSkillIds.has(artifact.id)),
    );
  };
  const publishMemoryNarratives = async (artifacts: MemoryNarrative[]) => {
    await Promise.all(
      artifacts.map((artifact) =>
        publishMemoryNarrative({
          workspaceDir,
          artifact,
        }),
      ),
    );
  };
  const listStoredMemoryEventArray = async (
    input: WorkspaceStorageInput & { query?: string },
  ): Promise<MemoryEvent[]> =>
    normalizeMemoryEventReadResult(await listMemoryEvents(input));
  const loadOrInitializeCache = async (): Promise<MemoryEventsCache> => {
    if (
      dependencies.listMemoryEvents !== undefined ||
      dependencies.listWorkspaceMemoryEvents !== undefined
    ) {
      return initializeCacheFromQmdWorkspace(workspaceDir, {
        listWorkspaceMemoryEvents: listWorkspaceMemoryEvents,
      });
    }

    let cache = await loadMemoryEventsCache(workspaceDir);

    if (cache === null) {
      cache = await initializeCacheFromQmdWorkspace(workspaceDir, {
        listWorkspaceMemoryEvents: listWorkspaceMemoryEvents,
      });
    }

    return cache;
  };
  const loadMemoryEvents = async (): Promise<MemoryEvent[]> => {
    try {
      return await listStoredMemoryEventArray({ workspaceDir });
    } catch {
      return listWorkspaceMemoryEvents({
        workspaceDir,
      });
    }
  };
  const getReviewedWorkSessionsDir = () =>
    join(
      workspaceDir,
      'mirrorbrain',
      'reviewed-work-sessions',
    );

  const saveReviewedWorkSession = async (
    reviewedWorkSession: ReviewWorkSessionCandidateResult['reviewedWorkSession'],
  ): Promise<void> => {
    const reviewedWorkSessionsDir = getReviewedWorkSessionsDir();

    await mkdir(reviewedWorkSessionsDir, { recursive: true });
    await writeFile(
      join(
        reviewedWorkSessionsDir,
        `${encodeURIComponent(reviewedWorkSession.id)}.json`,
      ),
      `${JSON.stringify(reviewedWorkSession, null, 2)}\n`,
    );
  };
  const loadReviewedWorkSession = async (
    reviewedWorkSessionId: string,
  ): Promise<ReviewedWorkSession> => {
    const reviewedWorkSessionPath = join(
      getReviewedWorkSessionsDir(),
      `${encodeURIComponent(reviewedWorkSessionId)}.json`,
    );

    let text: string;

    try {
      text = await readFile(reviewedWorkSessionPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Reviewed work session was not found: ${reviewedWorkSessionId}`);
      }

      throw error;
    }

    const parsed = JSON.parse(text) as unknown;

    if (!isReviewedWorkSessionLike(parsed)) {
      throw new Error(`Reviewed work session is malformed: ${reviewedWorkSessionId}`);
    }

    return parsed;
  };
  const loadReviewedWorkSessions = async (
    reviewedWorkSessionIds: string[],
  ): Promise<ReviewedWorkSession[]> => {
    if (reviewedWorkSessionIds.length === 0) {
      throw new Error('Knowledge Article Drafts require reviewed work sessions.');
    }

    return Promise.all(reviewedWorkSessionIds.map(loadReviewedWorkSession));
  };
  const createAnalysisWindow = (preset: AnalysisWindowPreset) => {
    const endAt = now();
    const endDate = new Date(endAt);
    const durationMsByPreset: Record<AnalysisWindowPreset, number> = {
      'last-6-hours': 6 * 60 * 60 * 1000,
      'last-24-hours': 24 * 60 * 60 * 1000,
      'last-7-days': 7 * 24 * 60 * 60 * 1000,
    };
    const startAt = new Date(
      endDate.getTime() - durationMsByPreset[preset],
    ).toISOString();

    return {
      preset,
      startAt,
      endAt,
    };
  };
  const loadCandidateMemories = async (): Promise<CandidateMemory[]> => {
    try {
      const result = await listCandidateMemories({ workspaceDir });

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
  const loadReviewedMemories = async (): Promise<ReviewedMemory[]> => {
    if (dependencies.listReviewedMemories !== undefined) {
      return dependencies.listReviewedMemories({ workspaceDir });
    }

    try {
      return await listMirrorBrainReviewedMemoriesFromQmdWorkspace({ workspaceDir });
    } catch {
      const reviewedDir = join(workspaceDir, 'mirrorbrain', 'reviewed-memories');

      try {
        const files = await readdir(reviewedDir);
        const items = await Promise.all(
          files
            .filter((file) => file.endsWith('.json'))
            .map(async (file) => {
              const content = await readFile(join(reviewedDir, file), 'utf8');
              const parsed = JSON.parse(content) as unknown;

              return isReviewedMemoryLike(parsed) ? parsed : null;
            }),
        );

        return items.filter((item): item is ReviewedMemory => item !== null);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return [];
        }

        throw error;
      }
    }
  };
  const importSourceLedgersForService = (): Promise<SourceLedgerImportResult> =>
    importSourceLedgers(
      {
        authorizationScopeId: 'scope-source-ledger',
        importedAt: now(),
        workspaceDir,
      },
      {
        readCheckpoint: sourceLedgerStateStore.readCheckpoint,
        writeCheckpoint: sourceLedgerStateStore.writeCheckpoint,
        writeMemoryEvent: async (event) => {
          await memoryEventWriter.writeMemoryEvent(
            createQmdWorkspaceMemoryEventRecord(event),
          );
        },
        writeSourceAuditEvent: sourceLedgerStateStore.writeSourceAuditEvent,
        isSourceImportAllowed: async ({ sourceKind, sourceInstanceId }) => {
          const configs = await sourceLedgerStateStore.listSourceInstanceConfigs();
          const config = configs.find(
            (item) =>
              item.sourceKind === sourceKind &&
              item.sourceInstanceId === sourceInstanceId,
          );

          return config?.enabled !== false;
        },
      },
    );
  const resolveManualBrowserBucket = async (): Promise<{
    id: string;
    created?: string;
  }> => {
    if (input.browserBucketId !== undefined) {
      return {
        id: input.browserBucketId,
      };
    }

    const buckets = await loadActivityWatchBuckets({
      baseUrl: serviceConfig.activityWatch.baseUrl,
    });
    const bucketId = resolveActivityWatchBrowserBucket(buckets);

    if (bucketId === null) {
      throw new Error(
        'No ActivityWatch browser watcher bucket is available for source import.',
      );
    }

    const bucket = buckets.find((item) => item.id === bucketId);

    return {
      id: bucketId,
      created: bucket?.created,
    };
  };
  const captureBrowserSourceLedgerForService = async (): Promise<void> => {
    const configs = await sourceLedgerStateStore.listSourceInstanceConfigs();
    const browserConfig = configs.find(
      (config) =>
        config.sourceKind === 'browser' &&
        config.sourceInstanceId === 'chrome-main',
    );

    if (browserConfig?.enabled === false) {
      return;
    }

    const bucket = await resolveManualBrowserBucket();
    const records = await captureBrowserLedgerRecords(
      {
        bucketId: bucket.id,
        config: serviceConfig,
        initialBackfillStartAt: bucket.created,
        now: now(),
        scopeId: browserScopeId,
      },
      {
        checkpointStore,
      },
    );

    await appendCapturedSourceRecordsToLedger({
      workspaceDir,
      now,
      source: {
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: true,
      },
      records,
    });
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
  return {
    service: input.service,
    syncBrowserMemory: async () => {
      const sync = await input.service.syncBrowserMemory();
      scheduleMemoryNarrativeRefresh(sync, buildBrowserThemeNarratives);

      if (sync.importedEvents && sync.importedEvents.length > 0) {
        void updateCacheWithNewEvents(workspaceDir, sync.importedEvents, 'browser').catch(
          () => undefined,
        );
      }

      return summarizeImportedEvents(sync) as BrowserMemorySyncResult;
    },
    syncShellMemory: async () => {
      const sync = await input.service.syncShellMemory();
      scheduleMemoryNarrativeRefresh(sync, buildShellProblemNarratives);

      if (sync.importedEvents && sync.importedEvents.length > 0) {
        void updateCacheWithNewEvents(workspaceDir, sync.importedEvents, 'shell').catch(
          () => undefined,
        );
      }

      return summarizeImportedEvents(sync) as ShellMemorySyncResult;
    },
    importSourceLedgers: async (): Promise<SourceLedgerImportResult> => {
      try {
        await captureBrowserSourceLedgerForService();
      } catch {
        // Manual import must still scan already-written ledgers even when the
        // optional browser refresh cannot reach ActivityWatch.
      }

      const result = await importSourceLedgersForService();

      await initializeCacheFromQmdWorkspace(workspaceDir, {
        listWorkspaceMemoryEvents,
      });

      return result;
    },
    listSourceAuditEvents: (
      filter: SourceAuditEventFilter = {},
    ) => sourceLedgerStateStore.listSourceAuditEvents(filter),
    updateSourceInstanceConfig: async (config: {
      sourceKind: SourceInstanceConfig['sourceKind'];
      sourceInstanceId: string;
      enabled: boolean;
      updatedBy: string;
    }): Promise<SourceInstanceConfig> => {
      const updatedAt = now();
      const updatedConfig: SourceInstanceConfig = {
        ...config,
        updatedAt,
      };
      const eventType = config.enabled ? 'source-enabled' : 'source-disabled';

      await sourceLedgerStateStore.writeSourceInstanceConfig(updatedConfig);
      await sourceLedgerStateStore.writeSourceAuditEvent({
        id: `source-audit:${eventType}:${config.sourceKind}:${config.sourceInstanceId}:${updatedAt}`,
        eventType,
        sourceKind: config.sourceKind,
        sourceInstanceId: config.sourceInstanceId,
        ledgerPath: '',
        lineNumber: 0,
        occurredAt: updatedAt,
        severity: 'info',
        message: `Source ${config.sourceKind}:${config.sourceInstanceId} ${config.enabled ? 'enabled' : 'disabled'}.`,
        metadata: {
          updatedBy: config.updatedBy,
        },
      });

      return updatedConfig;
    },
    listSourceInstanceSummaries: async (): Promise<SourceInstanceSummary[]> =>
      mergeDefaultSourceInstanceSummaries(
        await sourceLedgerStateStore.listSourceInstanceSummaries(),
      ),
    getResourceConfiguration: async (): Promise<ResourceConfiguration> =>
      redactResourceConfiguration(
        await resourceConfigurationStore.readResourceConfiguration(),
      ),
    updateResourceConfiguration: async (
      update: ResourceConfigurationUpdate,
    ): Promise<ResourceConfiguration> => {
      const current = await resourceConfigurationStore.readResourceConfiguration();
      const updated = mergeResourceConfigurationUpdate(current, update, now());

      await resourceConfigurationStore.writeResourceConfiguration(updated);

      return redactResourceConfiguration(updated);
    },
    analyzeWorkSessions: async (
      input: AnalyzeWorkSessionsInput,
    ): Promise<WorkSessionAnalysisResult> => {
      const analysisWindow = createAnalysisWindow(input.preset);
      const memoryEvents = await loadMemoryEvents();

      return analyzeWorkSessions({
        analysisWindow,
        generatedAt: analysisWindow.endAt,
        memoryEvents,
      });
    },
    reviewWorkSessionCandidate: async (
      candidate: WorkSessionCandidate,
      review: ReviewWorkSessionInput,
    ): Promise<ReviewWorkSessionCandidateResult> => {
      const result = reviewPhase4WorkSessionCandidate(candidate, {
        decision: review.decision,
        reviewedAt: now(),
        reviewedBy: review.reviewedBy,
        title: review.title,
        summary: review.summary,
        projectAssignment: review.projectAssignment,
      });

      if (result.project !== undefined) {
        await knowledgeArticleStore.saveProject(result.project);
      }

      await saveReviewedWorkSession(result.reviewedWorkSession);

      return result;
    },
    generateKnowledgeArticlePreview: async (
      input: GenerateKnowledgeArticlePreviewServiceInput,
    ): Promise<KnowledgeArticlePreview> =>
      generateArticlePreview({
        ...input,
        generatedAt: now(),
        analyzeWithLLM: analyzeKnowledge,
      }),
    generateKnowledgeArticleDraft: async (
      input: GenerateKnowledgeArticleDraftInput,
    ): Promise<KnowledgeArticleDraft> => {
      const reviewedWorkSessions = await loadReviewedWorkSessions(
        input.reviewedWorkSessionIds,
      );
      const draft = createPhase4KnowledgeArticleDraft({
        title: input.title,
        summary: input.summary,
        body: input.body,
        topicProposal: input.topicProposal,
        articleOperationProposal: input.articleOperationProposal,
        reviewedWorkSessions,
        generatedAt: now(),
      });

      await knowledgeArticleStore.saveDraft(draft);

      return draft;
    },
    publishKnowledgeArticleDraft: async (
      input: PublishKnowledgeArticleDraftServiceInput,
    ): Promise<PublishKnowledgeArticleDraftResult> => {
      const projectTopics = await knowledgeArticleStore.listTopics(input.draft.projectId);
      const projectArticles = (
        await Promise.all(
          projectTopics.map((topic) =>
            knowledgeArticleStore.listArticleHistory({
              projectId: input.draft.projectId,
              topicId: topic.id,
            }),
          ),
        )
      ).flat();
      const publishDecision = input.autoResolvePublishDecision === true
        ? await decideKnowledgeArticlePublishOperation({
            draft: input.draft,
            topics: projectTopics,
            articles: projectArticles,
            analyzeWithLLM: analyzeKnowledge,
          })
        : {
            topicProposal: input.draft.topicProposal,
            topicAssignment: input.topicAssignment,
            articleOperationProposal: input.draft.articleOperationProposal,
          };
      const resolvedDraft: KnowledgeArticleDraft = {
        ...input.draft,
        topicProposal: publishDecision.topicProposal,
        articleOperationProposal: publishDecision.articleOperationProposal,
      };
      const topicId =
        publishDecision.topicAssignment.kind === 'existing-topic'
          ? publishDecision.topicAssignment.topicId
          : `topic:${input.draft.projectId.replace(/[^a-z0-9]+/giu, '-').toLowerCase().replace(/^-|-$/gu, '')}:${publishDecision.topicAssignment.name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')}`;
      const existingArticles = projectArticles.filter(
        (article) => article.topicId === topicId,
      );
      const result = publishPhase4KnowledgeArticleDraft({
        draft: resolvedDraft,
        publishedAt: now(),
        publishedBy: input.publishedBy,
        topicAssignment: publishDecision.topicAssignment,
        existingArticles,
      });

      if (result.topic !== undefined) {
        await knowledgeArticleStore.saveTopic(result.topic);
      }

      await knowledgeArticleStore.saveArticles(
        result.supersededArticle
          ? [result.supersededArticle, result.article]
          : [result.article],
      );
      await knowledgeArticleStore.deleteDraft(input.draft.id);

      return result;
    },
    reviseKnowledgeArticle: async (
      input: ReviseKnowledgeArticleServiceInput,
    ): Promise<PublishKnowledgeArticleDraftResult> => {
      const currentArticle = await knowledgeArticleStore.getCurrentBestArticle({
        projectId: input.projectId,
        topicId: input.topicId,
        articleId: input.articleId,
      });

      if (currentArticle === null) {
        throw new ValidationError('Published Knowledge Article not found.');
      }

      const generatedAt = now();
      const revisedContent = await reviseKnowledgeArticleContent({
        article: currentArticle,
        instruction: input.instruction,
        analyzeWithLLM: analyzeKnowledge,
      });
      const draft = createPhase4KnowledgeArticleRevisionDraft({
        article: currentArticle,
        generatedAt,
        title: revisedContent.title,
        summary: revisedContent.summary,
        body: revisedContent.body,
      });
      const existingArticles = await knowledgeArticleStore.listArticleHistory({
        projectId: currentArticle.projectId,
        topicId: currentArticle.topicId,
        articleId: currentArticle.articleId,
      });
      const result = publishPhase4KnowledgeArticleDraft({
        draft,
        publishedAt: generatedAt,
        publishedBy: input.revisedBy,
        topicAssignment: {
          kind: 'existing-topic',
          topicId: currentArticle.topicId,
        },
        existingArticles,
      });

      await knowledgeArticleStore.saveArticles(
        result.supersededArticle
          ? [result.supersededArticle, result.article]
          : [result.article],
      );

      return result;
    },
    listKnowledgeArticleHistory: (
      filter: {
        projectId: string;
        topicId: string;
        articleId?: string;
      },
    ): Promise<KnowledgeArticle[]> =>
      knowledgeArticleStore.listArticleHistory(filter),
    listKnowledgeArticleTree: () => knowledgeArticleStore.listKnowledgeArticleTree(),
    deleteKnowledgeArticle: async (articleId: string): Promise<void> => {
      validateKnowledgeArticleId(articleId);
      await knowledgeArticleStore.deleteArticleLineage(articleId);
    },
    listMemoryEvents: async (
      input?: { page?: number; pageSize?: number } & MemoryEventSourceFilter,
    ) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 10;
      const cache = await loadOrInitializeCache();
      const { events, total, totalPages } = getEventsFromCache(
        cache,
        page,
        pageSize,
        {
          sourceKind: input?.sourceKind,
          sourceInstanceId: input?.sourceInstanceId,
        },
      );

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
        workspaceDir,
      }),
    queryMemory: (input: MemoryQueryInput) =>
      queryMemory({
        workspaceDir,
        query: input.query,
        timeRange: input.timeRange,
        sourceTypes: input.sourceTypes,
      }),
    listSkillDrafts: loadSkillArtifacts,
    publishSkillDraft: (artifact: SkillArtifact) =>
      clearDeletedArtifact('skills', artifact.id).then(() =>
        publishSkill({
          workspaceDir,
          artifact,
        }),
      ),
    deleteSkillArtifact,
    generateSkillDraftFromReviewedMemories: async (
      reviewedMemories: ReviewedMemory[],
    ): Promise<SkillArtifact> => {
      const artifact = generateSkillDraft(reviewedMemories);

      await clearDeletedArtifact('skills', artifact.id);
      await publishSkill({
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
      const existingCandidates = await loadCandidateMemories();
      const candidatesForDate = existingCandidates.filter(
        (candidate) => candidate.reviewDate === reviewDate,
      );
      const importResult = await importSourceLedgersForService();

      if (candidatesForDate.length > 0 && importResult.importedCount === 0) {
        return candidatesForDate;
      }

      const candidateSourceEvents = await listRawWorkspaceMemoryEvents({
        workspaceDir,
      });
      const enrichedMemoryEvents = await Promise.all(
        candidateSourceEvents.map(async (event) => {
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
        workspaceDir,
        artifact,
      });

      return artifact;
    },
  };
}
