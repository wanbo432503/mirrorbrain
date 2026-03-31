import { createKnowledgeDraft } from '../../modules/daily-review-knowledge/index.js';
import type {
  KnowledgeArtifact,
  ReviewedMemory,
} from '../../shared/types/index.js';

interface RunDailyReviewInput {
  reviewedMemories: ReviewedMemory[];
}

export function runDailyReview(
  input: RunDailyReviewInput,
): KnowledgeArtifact {
  return createKnowledgeDraft({
    reviewedMemories: input.reviewedMemories,
  });
}
