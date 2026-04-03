import type { KnowledgeArtifact } from '../../shared/types/index.js';

interface BuildTopicKnowledgeCandidatesInput {
  knowledgeDrafts: KnowledgeArtifact[];
}

interface MergeDailyReviewIntoTopicKnowledgeInput {
  candidate: KnowledgeArtifact;
  existingKnowledgeArtifacts: KnowledgeArtifact[];
  mergedAt?: string;
}

type MergeDecision =
  | 'create-topic'
  | 'update-current-best'
  | 'keep-draft';

interface MergeDailyReviewIntoTopicKnowledgeResult {
  decision: MergeDecision;
  artifact: KnowledgeArtifact;
  supersededArtifact?: KnowledgeArtifact;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function resolveTopicKey(artifact: KnowledgeArtifact): string {
  if (artifact.topicKey && artifact.topicKey.length > 0) {
    return artifact.topicKey;
  }

  return slugify(artifact.title ?? artifact.id);
}

function shouldKeepDraft(candidate: KnowledgeArtifact): boolean {
  return (
    candidate.sourceReviewedMemoryIds.length === 0 ||
    (candidate.body?.trim().length ?? 0) < 20
  );
}

export function buildTopicKnowledgeCandidates(
  input: BuildTopicKnowledgeCandidatesInput,
): KnowledgeArtifact[] {
  return input.knowledgeDrafts
    .filter((artifact) => artifact.artifactType === 'daily-review-draft')
    .map((artifact) => {
      const topicKey = resolveTopicKey(artifact);

      return {
        ...artifact,
        artifactType: 'topic-merge-candidate',
        id: `topic-merge-candidate:${topicKey}:${artifact.id}`,
        topicKey,
        derivedFromKnowledgeIds: [artifact.id],
      };
    });
}

export function mergeDailyReviewIntoTopicKnowledge(
  input: MergeDailyReviewIntoTopicKnowledgeInput,
): MergeDailyReviewIntoTopicKnowledgeResult {
  if (shouldKeepDraft(input.candidate)) {
    return {
      decision: 'keep-draft',
      artifact: input.candidate,
    };
  }

  const topicKey = resolveTopicKey(input.candidate);
  const existingVersions = input.existingKnowledgeArtifacts.filter(
    (artifact) =>
      artifact.artifactType === 'topic-knowledge' &&
      artifact.topicKey === topicKey,
  );
  const currentBest = existingVersions
    .filter((artifact) => artifact.isCurrentBest === true)
    .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))[0];
  const currentVersion =
    existingVersions.reduce(
      (max, artifact) => Math.max(max, artifact.version ?? 0),
      0,
    ) || 0;
  const nextVersion = currentVersion + 1;
  const mergedAt = input.mergedAt ?? input.candidate.updatedAt;

  const artifact: KnowledgeArtifact = {
    ...input.candidate,
    artifactType: 'topic-knowledge',
    id: `topic-knowledge:${topicKey}:v${nextVersion}`,
    topicKey,
    draftState: 'published',
    version: nextVersion,
    isCurrentBest: true,
    supersedesKnowledgeId: currentBest?.id ?? null,
    updatedAt: mergedAt,
    recencyLabel:
      mergedAt !== undefined
        ? `updated on ${mergedAt.slice(0, 10)}`
        : input.candidate.recencyLabel,
  };

  if (!currentBest) {
    return {
      decision: 'create-topic',
      artifact,
    };
  }

  return {
    decision: 'update-current-best',
    artifact,
    supersededArtifact: {
      ...currentBest,
      isCurrentBest: false,
    },
  };
}
