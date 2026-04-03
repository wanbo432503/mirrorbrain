import type {
  KnowledgeArtifact,
  ReviewedMemory,
} from '../../shared/types/index.js';

interface CreateKnowledgeDraftInput {
  reviewedMemories: ReviewedMemory[];
}

function slugifyTopicKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

export function createKnowledgeDraft(
  input: CreateKnowledgeDraftInput,
): KnowledgeArtifact {
  const [firstReviewedMemory] = input.reviewedMemories;
  const reviewedAt = firstReviewedMemory?.reviewedAt ?? null;
  const reviewDate = firstReviewedMemory?.reviewDate ?? '';
  const candidateTitle = firstReviewedMemory?.candidateTitle ?? 'Daily Review Draft';
  const candidateSummary =
    firstReviewedMemory?.candidateSummary ?? 'Reviewed memory included.';
  const candidateTheme = firstReviewedMemory?.candidateTheme ?? '';

  return {
    artifactType: 'daily-review-draft',
    id: `knowledge-draft:${firstReviewedMemory.id}`,
    draftState: 'draft',
    topicKey: candidateTheme.length > 0 ? slugifyTopicKey(candidateTheme) : null,
    title: candidateTitle,
    summary: `${input.reviewedMemories.length} reviewed memor${
      input.reviewedMemories.length === 1 ? 'y' : 'ies'
    } about ${candidateTitle} from ${reviewDate}.`,
    body: `- ${candidateTitle}: ${candidateSummary}`,
    sourceReviewedMemoryIds: input.reviewedMemories.map((memory) => memory.id),
    derivedFromKnowledgeIds: [],
    version: 1,
    isCurrentBest: false,
    supersedesKnowledgeId: null,
    updatedAt: reviewedAt ?? undefined,
    reviewedAt,
    recencyLabel: reviewDate.length > 0 ? reviewDate : 'recent',
    provenanceRefs: input.reviewedMemories.map((memory) => ({
      kind: 'reviewed-memory',
      id: memory.id,
    })),
  };
}
