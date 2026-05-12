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
  | 'shell'
  | 'agent-transcript';

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
  | 'openclaw-conversation';

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
  openViking: MirrorBrainEndpointConfig;
  service: MirrorBrainServiceConfig;
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
