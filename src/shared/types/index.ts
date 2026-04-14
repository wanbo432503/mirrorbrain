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

export interface CandidateMemory {
  id: string;
  memoryEventIds: string[];
  sourceRefs?: Array<{
    id: string;
    sourceType: string;
    timestamp: string;
    title?: string;
    url?: string;
    role?: 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'web';
    contribution?: 'primary' | 'supporting';
  }>;
  title: string;
  summary: string;
  theme: string;
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
}

export interface SkillArtifact {
  id: string;
  approvalState: 'draft' | 'approved';
  workflowEvidenceRefs: string[];
  executionSafetyMetadata: {
    requiresConfirmation: boolean;
  };
}
