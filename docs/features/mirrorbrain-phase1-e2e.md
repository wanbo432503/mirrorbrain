# MirrorBrain Phase 1 E2E

## Summary

This feature documents the first vertical slice of MirrorBrain:

- ActivityWatch browser input with persisted sync checkpoints
- normalization into `MemoryEvent`
- OpenViking record persistence
- local sync checkpoint persistence for incremental polling
- daily candidate memory stream review
- daily review knowledge draft generation
- skill draft generation
- `openclaw` plugin-facing retrieval
- a runnable local service and review surface for the MVP path

## Responsibility Boundary

This feature validates the Phase 1 path end to end as a user-runnable MVP. It is not a production-complete implementation of all source adapters, enterprise deployment targets, or advanced review workflows, but it must be usable without reading source code.

## Key Interfaces

- `normalizeActivityWatchBrowserEvent(...)`
- `persistMemoryEvent(...)`
- `runBrowserMemorySyncOnce(...)`
- `createCandidateMemories(...)`
- `reviewCandidateMemory(...)`
- `runDailyReview(...)`
- `buildSkillDraftFromReviewedMemories(...)`
- `queryMemory(...)`
- `listKnowledge(...)`
- `listSkillDrafts(...)`

## Data Flow

1. MirrorBrain reads a browser sync checkpoint or falls back to the configured backfill window.
2. ActivityWatch browser events are fetched for the resulting time range.
3. MirrorBrain normalizes each event into a `MemoryEvent`.
4. The event is wrapped for OpenViking persistence and stored.
5. MirrorBrain advances the browser sync checkpoint.
6. Same-day memory events are grouped into one or more candidate memory streams.
7. The UI shows suggestion-only AI review hints for those streams.
8. A user review decision creates reviewed memory.
9. Daily review creates a knowledge draft.
10. Workflow evidence creates a skill draft.
11. A user-facing MVP surface exposes review and generation actions for the first flow.
12. The `openclaw` plugin API reads the resulting artifacts back from OpenViking-compatible storage adapters.

## Test Strategy

- targeted unit tests for each module
- integration tests for checkpoint persistence and the complete Phase 1 browser-driven slice
- Playwright coverage for the documented local MVP flow
- full `vitest` run and `tsc --noEmit` verification

## Known Limitations

- the documented local startup flow exists in the repository README and remains local-development oriented rather than production deployment guidance
- broader source coverage remains intentionally out of scope for the first runnable slice
