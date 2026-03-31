import type {
  KnowledgeArtifact,
  ReviewedMemory,
} from '../../shared/types/index.js';

interface CreateKnowledgeDraftInput {
  reviewedMemories: ReviewedMemory[];
}

export function createKnowledgeDraft(
  input: CreateKnowledgeDraftInput,
): KnowledgeArtifact {
  const [firstReviewedMemory] = input.reviewedMemories;

  return {
    id: `knowledge-draft:${firstReviewedMemory.id}`,
    draftState: 'draft',
    sourceReviewedMemoryIds: input.reviewedMemories.map((memory) => memory.id),
  };
}
