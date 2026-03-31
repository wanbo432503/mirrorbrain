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

export interface CandidateMemory {
  id: string;
  memoryEventIds: string[];
  reviewState: 'pending';
}

export interface ReviewedMemory {
  id: string;
  candidateMemoryId: string;
  decision: 'keep' | 'discard';
}

export interface KnowledgeArtifact {
  id: string;
  draftState: 'draft' | 'published';
  sourceReviewedMemoryIds: string[];
}

export interface SkillArtifact {
  id: string;
  approvalState: 'draft' | 'approved';
  workflowEvidenceRefs: string[];
  executionSafetyMetadata: {
    requiresConfirmation: boolean;
  };
}
