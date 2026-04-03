# Daily Review Knowledge

## Summary

This component now creates Phase 3-ready daily-review knowledge drafts from reviewed memory. It remains the domain-level step that turns reviewed memory inputs into a draft `KnowledgeArtifact`, but the artifact now carries richer topic-aware metadata, draft body content, and provenance needed by later topic-merge workflows.

## Responsibility Boundary

This component is responsible for:

- accepting reviewed memory as the only synthesis input
- creating a Phase 3-ready draft knowledge artifact with topic-aware metadata
- preserving `sourceReviewedMemoryIds` provenance in the resulting artifact

This component is not responsible for:

- selecting which reviewed memories should be synthesized
- publishing knowledge artifacts
- rendering or editing knowledge content in the UI

## Key Interfaces

- `createKnowledgeDraft(...)`

## Data Flow

1. A caller passes one or more reviewed memories into the component.
2. The component creates a `daily-review-draft` `KnowledgeArtifact`.
3. The artifact keeps links to all reviewed memory ids used as synthesis input.
4. The artifact carries Phase 3 lifecycle fields so it can later flow into topic merge.

## Test Strategy

- unit coverage in `src/modules/daily-review-knowledge/index.test.ts`
- integration coverage through service and workflow tests that generate knowledge from reviewed memory

## Known Risks Or Limitations

- the current draft structure is richer than Phase 1, but still uses deterministic title/body generation rather than deeper synthesis
- the component assumes reviewed-memory input has already passed the required human review gate
