# Skill Draft Management

## Summary

This component owns the Phase 1 skill-draft state transitions. It creates draft `SkillArtifact` records from workflow evidence references and supports explicit approval as a separate transition from draft creation.

## Responsibility Boundary

This component is responsible for:

- creating draft skill artifacts from workflow evidence references
- attaching execution-safety metadata that requires confirmation
- approving a draft through an explicit state change

This component is not responsible for:

- discovering workflow evidence from raw activity
- executing skills
- storing approved skills in host-specific locations

## Key Interfaces

- `createSkillDraft(...)`
- `approveSkillDraft(...)`

## Data Flow

1. A caller supplies reviewed workflow evidence references.
2. The component creates a draft `SkillArtifact` with confirmation-required safety metadata.
3. If a user approves the draft, the component returns an updated artifact with `approvalState: approved`.

## Test Strategy

- unit coverage in `src/modules/skill-draft-management/index.test.ts`
- workflow and integration coverage through skill-draft generation tests

## Known Risks Or Limitations

- the current draft payload is intentionally minimal and does not yet include richer executable guidance content
- approval is modeled as a direct state change without a separate audit log component
