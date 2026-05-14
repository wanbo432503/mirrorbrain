export interface BrowserSyncSummary {
  sourceKey: string;
  strategy: 'initial-backfill' | 'incremental';
  importedCount: number;
  lastSyncedAt: string;
  importedEvents?: MemoryEvent[];
}

export type SourceLedgerKind =
  | 'browser'
  | 'file-activity'
  | 'screenshot'
  | 'audio-recording'
  | 'shell'
  | 'agent';

export interface SourceLedgerImportCheckpoint {
  ledgerPath: string;
  nextLineNumber: number;
  updatedAt: string;
}

export interface SourceLedgerImportResult {
  importedCount: number;
  skippedCount: number;
  scannedLedgerCount: number;
  changedLedgerCount: number;
  ledgerResults: Array<{
    ledgerPath: string;
    importedCount: number;
    skippedCount: number;
    checkpoint: SourceLedgerImportCheckpoint;
  }>;
}

export interface SourceAuditEvent {
  id: string;
  eventType: string;
  sourceKind?: SourceLedgerKind;
  sourceInstanceId?: string;
  ledgerPath: string;
  lineNumber: number;
  occurredAt: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SourceInstanceSummary {
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
  lifecycleStatus: 'enabled' | 'disabled' | 'running' | 'degraded' | 'error';
  recorderStatus: 'unknown' | 'running' | 'stopped' | 'error';
  lastImporterScanAt?: string;
  lastImportedAt?: string;
  importedCount: number;
  skippedCount: number;
  latestWarning?: string;
  checkpointSummary?: string;
}

export interface SourceInstanceConfig {
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface MirrorBrainSyncConfig {
  pollingIntervalMs: number;
  initialBackfillHours: number;
}

export type MirrorBrainSourceCategory =
  | 'browser'
  | 'shell'
  | 'agent';

export interface MirrorBrainEndpointConfig {
  baseUrl: string;
}

export interface MirrorBrainServiceConfig {
  host: string;
  port: number;
}

export interface MirrorBrainConfig {
  sync: MirrorBrainSyncConfig;
  activityWatch: MirrorBrainEndpointConfig;
  service: MirrorBrainServiceConfig;
}

export interface OpenAICompatibleResourceConfig {
  enabled: boolean;
  providerName: string;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TavilySearchResourceConfig {
  enabled: boolean;
  providerName: 'tavily';
  baseUrl: string;
  apiKeyConfigured: boolean;
  maxResults: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ResourceConfiguration {
  llm: OpenAICompatibleResourceConfig;
  embedding: OpenAICompatibleResourceConfig;
  search: TavilySearchResourceConfig;
}

export interface OpenAICompatibleResourceConfigUpdate {
  enabled: boolean;
  providerName: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  updatedBy: string;
}

export interface TavilySearchResourceConfigUpdate {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  maxResults: number;
  updatedBy: string;
}

export interface ResourceConfigurationUpdate {
  llm?: OpenAICompatibleResourceConfigUpdate;
  embedding?: OpenAICompatibleResourceConfigUpdate;
  search?: TavilySearchResourceConfigUpdate;
}

export interface AuthorizationScope {
  id: string;
  sourceCategory: MirrorBrainSourceCategory;
  revokedAt: string | null;
}

export interface MemoryEventCaptureMetadata {
  upstreamSource: string;
  checkpoint: string;
}

export interface MemoryEvent {
  id: string;
  sourceType: string;
  sourceRef: string;
  timestamp: string;
  authorizationScopeId: string;
  content: Record<string, unknown>;
  captureMetadata: MemoryEventCaptureMetadata;
}

export interface MemoryTimeRange {
  startAt: string;
  endAt: string;
}

export type AnalysisWindowPreset =
  | 'last-6-hours'
  | 'last-24-hours'
  | 'last-7-days';

export interface WorkSessionAnalysisWindow extends MemoryTimeRange {
  preset: AnalysisWindowPreset;
}

export interface WorkSessionCandidate {
  id: string;
  projectHint: string;
  title: string;
  summary: string;
  memoryEventIds: string[];
  sourceTypes: string[];
  timeRange: MemoryTimeRange;
  relationHints: string[];
  evidenceItems?: WorkSessionEvidenceItem[];
  reviewState: 'pending';
}

export interface WorkSessionEvidenceItem {
  memoryEventId: string;
  sourceType: string;
  title: string;
  url?: string;
  filePath?: string;
  summary?: string;
  excerpt: string;
}

export type WorkSessionProjectAssignment =
  | {
      kind: 'existing-project';
      projectId: string;
    }
  | {
      kind: 'confirmed-new-project';
      name: string;
      description?: string;
    };

export interface ReviewWorkSessionInput {
  decision: 'keep' | 'discard';
  reviewedBy: string;
  title?: string;
  summary?: string;
  projectAssignment?: WorkSessionProjectAssignment;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewedWorkSession {
  id: string;
  candidateId: string;
  projectId: string | null;
  title: string;
  summary: string;
  memoryEventIds: string[];
  sourceTypes: string[];
  timeRange: MemoryTimeRange;
  relationHints: string[];
  reviewState: 'reviewed' | 'discarded';
  reviewedAt: string;
  reviewedBy: string;
}

export interface WorkSessionReviewResult {
  reviewedWorkSession: ReviewedWorkSession;
  project?: Project;
}

export interface Topic {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type ArticleOperationProposal =
  | {
      kind: 'create-new-article';
    }
  | {
      kind: 'update-existing-article';
      articleId: string;
    }
  | {
      kind: 'attach-as-supporting-evidence';
      articleId?: string;
    };

export type TopicProposal =
  | {
      kind: 'existing-topic';
      topicId: string;
    }
  | {
      kind: 'new-topic';
      name: string;
      description?: string;
    };

export type TopicAssignment =
  | {
      kind: 'existing-topic';
      topicId: string;
    }
  | {
      kind: 'confirmed-new-topic';
      name: string;
      description?: string;
    };

export interface KnowledgeArticleDraft {
  id: string;
  draftState: 'draft';
  projectId: string;
  title: string;
  summary: string;
  body: string;
  topicProposal: TopicProposal;
  articleOperationProposal: ArticleOperationProposal;
  sourceReviewedWorkSessionIds: string[];
  sourceMemoryEventIds: string[];
  provenanceRefs: Array<{
    kind: 'reviewed-work-session' | 'memory-event';
    id: string;
  }>;
  generatedAt: string;
}

export interface KnowledgeArticle {
  id: string;
  articleId: string;
  projectId: string;
  topicId: string;
  title: string;
  summary: string;
  body: string;
  version: number;
  isCurrentBest: boolean;
  supersedesArticleId: string | null;
  sourceReviewedWorkSessionIds: string[];
  sourceMemoryEventIds: string[];
  provenanceRefs: KnowledgeArticleDraft['provenanceRefs'];
  publishState: 'published';
  publishedAt: string;
  publishedBy: string;
}

export interface KnowledgeArticleTree {
  projects: Array<{
    project: Project;
    topics: Array<{
      topic: Topic;
      articles: Array<{
        articleId: string;
        title: string;
        currentBestArticle: KnowledgeArticle | null;
        history: KnowledgeArticle[];
      }>;
    }>;
  }>;
}

export interface KnowledgeArticlePreview {
  candidateId: string;
  title: string;
  summary: string;
  body: string;
  knowledgeType: 'systematic-knowledge' | 'workflow' | 'news';
  sourceTypes: string[];
  memoryEventCount: number;
}

export interface GenerateKnowledgeArticlePreviewRequest {
  candidate: WorkSessionCandidate;
  topicName?: string;
}

export interface GenerateKnowledgeArticleDraftRequest {
  reviewedWorkSessionIds: string[];
  title: string;
  summary: string;
  body: string;
  topicProposal: TopicProposal;
  articleOperationProposal: ArticleOperationProposal;
}

export interface PublishKnowledgeArticleDraftRequest {
  draft: KnowledgeArticleDraft;
  publishedBy: string;
  topicAssignment: TopicAssignment;
}

export interface PublishKnowledgeArticleDraftResult {
  article: KnowledgeArticle;
  topic?: Topic;
  supersededArticle?: KnowledgeArticle;
}

export interface ReviseKnowledgeArticleRequest {
  projectId: string;
  topicId: string;
  articleId: string;
  instruction: string;
  revisedBy: string;
}

export type ReviseKnowledgeArticleResult = PublishKnowledgeArticleDraftResult;

export interface WorkSessionAnalysisResult {
  analysisWindow: WorkSessionAnalysisWindow;
  generatedAt: string;
  candidates: WorkSessionCandidate[];
  excludedMemoryEventIds: string[];
}

export interface MemoryQueryInput {
  query: string;
  timeRange?: MemoryTimeRange;
  sourceTypes?: MirrorBrainSourceCategory[];
}

export interface MemoryResultSourceRef {
  id: string;
  sourceType: string;
  sourceRef: string;
  timestamp: string;
}

export interface MemoryNarrativeContext {
  inferredCwd?: string;
  workspaceLabel?: string;
  sessionId?: string;
}

export interface MemoryNarrative {
  id: string;
  narrativeType: 'browser-theme' | 'shell-problem';
  sourceCategory: 'browser' | 'shell';
  theme: string;
  title: string;
  summary: string;
  timeRange: MemoryTimeRange;
  sourceEventIds: string[];
  sourceRefs: MemoryResultSourceRef[];
  queryHints: string[];
  operationPhases?: string[];
  context?: MemoryNarrativeContext;
}

export interface MemoryQueryItem {
  id: string;
  theme: string;
  title: string;
  summary: string;
  timeRange: MemoryTimeRange;
  sourceRefs: MemoryResultSourceRef[];
}

export interface MemoryQueryResult {
  timeRange?: MemoryTimeRange;
  explanation?: string;
  items: MemoryQueryItem[];
}

export type CandidateSourceRole =
  | 'search'
  | 'docs'
  | 'chat'
  | 'issue'
  | 'pull-request'
  | 'repository'
  | 'debug'
  | 'reference'
  | 'shopping'
  | 'entertainment'
  | 'learning'
  | 'reading'
  | 'web';

export interface CandidateMemory {
  id: string;
  memoryEventIds: string[];
  sourceRefs?: Array<{
    id: string;
    sourceType: string;
    timestamp: string;
    title?: string;
    url?: string;
    role?: CandidateSourceRole;
    contribution?: 'primary' | 'supporting';
  }>;
  discardedSourceRefs?: Array<{
    id: string;
    sourceType: string;
    timestamp: string;
    title?: string;
    url?: string;
    role?: CandidateSourceRole;
  }>;
  title: string;
  summary: string;
  theme: string;
  formationReasons?: string[];
  compressedSourceCount?: number;
  discardReasons?: string[];
  reviewDate: string;
  timeRange: {
    startAt: string;
    endAt: string;
  };
  reviewState: 'pending';
}

export interface ReviewedMemory {
  id: string;
  candidateMemoryId: string;
  candidateTitle: string;
  candidateSummary: string;
  candidateTheme: string;
  candidateSourceRefs?: Array<{
    id: string;
    sourceType: string;
    timestamp: string;
    title?: string;
    url?: string;
    role?: CandidateSourceRole;
    contribution?: 'primary' | 'supporting';
  }>;
  candidateFormationReasons?: string[];
  candidateTimeRange?: {
    startAt: string;
    endAt: string;
  };
  memoryEventIds: string[];
  reviewDate: string;
  decision: 'keep' | 'discard';
  reviewedAt: string;
}

export interface CandidateReviewSuggestion {
  candidateMemoryId: string;
  recommendation: 'keep' | 'discard' | 'review';
  confidenceScore: number;
  keepScore?: number;
  primarySourceCount?: number;
  supportingSourceCount?: number;
  evidenceSummary?: string;
  priorityScore: number;
  rationale: string;
  supportingReasons?: string[];
}

export interface KnowledgeArtifact {
  id: string;
  draftState: 'draft' | 'published';
  artifactType?: 'daily-review-draft' | 'topic-merge-candidate' | 'topic-knowledge';
  topicKey?: string | null;
  title?: string;
  summary?: string;
  body?: string;
  sourceReviewedMemoryIds: string[];
  derivedFromKnowledgeIds?: string[];
  version?: number;
  isCurrentBest?: boolean;
  supersedesKnowledgeId?: string | null;
  updatedAt?: string;
  reviewedAt?: string | null;
  recencyLabel?: string;
  provenanceRefs?: Array<{
    kind: 'reviewed-memory' | 'knowledge-artifact';
    id: string;
  }>;
  tags?: string[];
  relatedKnowledgeIds?: string[];
  compilationMetadata?: {
    discoveryInsights: string[];
    generationMethod: 'two-stage-compilation' | 'legacy';
    discoveryStageCompletedAt?: string;
    executeStageCompletedAt?: string;
  };
}

export interface SkillArtifact {
  id: string;
  approvalState: 'draft' | 'approved';
  workflowEvidenceRefs: string[];
  executionSafetyMetadata: {
    requiresConfirmation: boolean;
  };
  updatedAt?: string;
  reviewedAt?: string | null;
}

/**
 * Knowledge Graph Types
 *
 * Types for the knowledge relation graph visualization.
 */

export type KnowledgeGraphNodeType = 'topic' | 'knowledge-artifact';
export type KnowledgeGraphEdgeType = 'CONTAINS' | 'REFERENCES' | 'SIMILAR';

export interface KnowledgeGraphNode {
  id: string;
  type: KnowledgeGraphNodeType;
  label: string;
  topicKey: string;
  properties: {
    artifactId?: string;
    title?: string;
    summary?: string;
    version?: number;
    isCurrentBest?: boolean;
    updatedAt?: string;
    tags?: string[];
  };
}

export interface KnowledgeGraphEdge {
  id: string;
  type: KnowledgeGraphEdgeType;
  source: string;
  target: string;
  label: string;
  properties: {
    similarity?: number;
  };
}

export interface KnowledgeGraphSnapshot {
  generatedAt: string;
  stats: {
    topics: number;
    knowledgeArtifacts: number;
    wikilinkReferences: number;
    similarityRelations: number;
  };
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}
