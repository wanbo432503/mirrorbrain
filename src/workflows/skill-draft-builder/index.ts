import { createSkillDraft } from '../../modules/skill-draft-management/index.js';
import type {
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';

export function buildSkillDraftFromReviewedMemories(
  reviewedMemories: ReviewedMemory[],
): SkillArtifact {
  return createSkillDraft({
    workflowEvidenceRefs: reviewedMemories.map((memory) => memory.id),
  });
}
