# Skill Draft Builder

## Summary

This workflow builds a Phase 1 skill draft from reviewed memories. It converts reviewed-memory ids into workflow evidence references and delegates draft creation to the skill-draft-management module.

## Responsibility Boundary

This workflow is responsible for:

- deriving workflow evidence references from reviewed memories
- invoking the skill-draft-management module to create a draft skill artifact
- returning a draft artifact that preserves evidence linkage

This workflow is not responsible for:

- detecting repeated workflows from raw memory automatically
- approving or executing skills
- host-specific skill installation

## Key Interfaces

- `buildSkillDraftFromReviewedMemories(...)`

## Data Flow

1. A caller supplies reviewed memories as workflow evidence.
2. The workflow maps those reviewed memories to evidence references.
3. The workflow delegates draft creation to the skill-draft-management module.
4. The resulting draft skill artifact is returned with provenance preserved through `workflowEvidenceRefs`.

## Test Strategy

- unit coverage in `src/workflows/skill-draft-builder/index.test.ts`
- integration coverage through service and Phase 1 end-to-end tests that generate skill drafts

## Known Risks Or Limitations

- the current workflow assumes the provided reviewed memories are already valid workflow evidence
- richer workflow-pattern detection remains outside this thin Phase 1 builder
