import type { SkillArtifact } from '../../shared/types/index.js';

interface CreateSkillDraftInput {
  workflowEvidenceRefs: string[];
}

export function createSkillDraft(
  input: CreateSkillDraftInput,
): SkillArtifact {
  const [firstWorkflowEvidenceRef] = input.workflowEvidenceRefs;

  return {
    id: `skill-draft:${firstWorkflowEvidenceRef}`,
    approvalState: 'draft',
    workflowEvidenceRefs: input.workflowEvidenceRefs,
    executionSafetyMetadata: {
      requiresConfirmation: true,
    },
  };
}

export function approveSkillDraft(
  draft: SkillArtifact,
): SkillArtifact {
  return {
    ...draft,
    approvalState: 'approved',
  };
}
