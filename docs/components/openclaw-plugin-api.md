# OpenClaw Plugin API

## Summary

This component is MirrorBrain's plugin-facing retrieval surface for `openclaw`. In Phase 1 it exposes async read operations for browser memory events, knowledge drafts, and skill drafts by loading them from OpenViking-backed storage.

## Responsibility Boundary

- exposes the retrieval contract consumed by `openclaw`
- delegates storage access to the OpenViking adapter
- returns domain-shaped artifacts rather than raw filesystem responses
- does not own sync, review, knowledge generation, or skill generation

## Key Interfaces

- `queryMemory(...)`
- `listKnowledge(...)`
- `listSkillDrafts(...)`

## Data Flow

1. `openclaw` calls a MirrorBrain retrieval method with the OpenViking base URL.
2. The plugin API delegates to the OpenViking store adapter.
3. The store adapter lists MirrorBrain artifact URIs and reads their content.
4. The plugin API returns parsed `MemoryEvent`, `KnowledgeArtifact`, or `SkillArtifact` objects.

## Test Strategy

- unit tests verify each retrieval method delegates to the correct loader
- integration coverage verifies the overall Phase 1 slice can return stored artifacts through this API

## Known Limitations

- retrieval currently reads from fixed Phase 1 URI namespaces
- there is no filtering, pagination, or query shaping yet
