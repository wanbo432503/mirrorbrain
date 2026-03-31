# Daily Review Knowledge

## Summary

This component creates Phase 1 knowledge drafts from reviewed memory. It is the domain-level step that turns reviewed memory inputs into a draft `KnowledgeArtifact` while preserving provenance links back to the reviewed memories.

## Responsibility Boundary

This component is responsible for:

- accepting reviewed memory as the only synthesis input
- creating a draft knowledge artifact identifier
- preserving `sourceReviewedMemoryIds` provenance in the resulting artifact

This component is not responsible for:

- selecting which reviewed memories should be synthesized
- publishing knowledge artifacts
- rendering or editing knowledge content in the UI

## Key Interfaces

- `createKnowledgeDraft(...)`

## Data Flow

1. A caller passes one or more reviewed memories into the component.
2. The component creates a draft `KnowledgeArtifact`.
3. The artifact keeps links to all reviewed memory ids used as synthesis input.

## Test Strategy

- unit coverage in `src/modules/daily-review-knowledge/index.test.ts`
- integration coverage through service and workflow tests that generate knowledge from reviewed memory

## Known Risks Or Limitations

- the current draft structure is intentionally minimal and does not yet generate rich titles or bodies
- the component assumes reviewed-memory input has already passed the required human review gate
