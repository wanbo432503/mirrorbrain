# Memory Review Storage

## Summary

MirrorBrain now persists `CandidateMemory` and `ReviewedMemory` as first-class OpenViking-backed artifacts instead of treating them as transient in-memory values.

## Responsibility Boundary

This storage slice is responsible for:

- writing candidate memories to OpenViking resources
- writing reviewed memories to OpenViking resources
- reading candidate memories back for later review flows
- reading reviewed memories back for downstream knowledge and skill generation

This slice is not responsible for:

- deciding how candidates are created
- deciding how review decisions are made
- rendering review UI

## Key Interfaces

- `ingestCandidateMemoryToOpenViking(...)`
- `ingestReviewedMemoryToOpenViking(...)`
- `listMirrorBrainCandidateMemoriesFromOpenViking(...)`
- `listMirrorBrainReviewedMemoriesFromOpenViking(...)`
- `createMirrorBrainService(...).createDailyCandidateMemories(...)`
- `createMirrorBrainService(...).reviewCandidateMemory(...)`

## Data Flow

1. Domain logic creates one or more daily `CandidateMemory` streams from raw `MemoryEvent[]`.
2. The service persists each candidate stream into OpenViking resource storage.
3. Candidate persistence is intentionally sequential so multiple candidate writes do not contend on the same OpenViking `/resources` point lock.
4. A user review decision produces a `ReviewedMemory`.
5. The service persists that reviewed memory into OpenViking resource storage.
6. Later workflows can reload stored candidates or reviewed memories for UI or generation flows.
7. Daily candidate refresh uses published knowledge `sourceReviewedMemoryIds` plus persisted reviewed memories to identify memory events that have already been synthesized into knowledge, then removes those events from the next clustering input.

## Dependencies

- `src/modules/memory-review/index.ts` for domain object creation
- `src/integrations/openviking-store/index.ts` for resource import and retrieval
- `src/apps/mirrorbrain-service/index.ts` for orchestration and persistence wiring

## Failure Modes And Operational Constraints

- if the OpenViking resource import fails, candidate or reviewed memory persistence fails with the underlying request error
- candidate and reviewed memory currently use JSON resource files rather than richer typed OpenViking entities
- lifecycle transitions still depend on explicit service calls; no background promotion is performed
- reviewed memories must remain reloadable after candidate deletion because they are the durable bridge between published knowledge and the original memory events that should not be reclustered

## Test Strategy

- adapter coverage in `src/integrations/openviking-store/index.test.ts`
- service persistence coverage in `tests/integration/mirrorbrain-service-contract.test.ts`
- service coverage in `src/apps/mirrorbrain-service/index.test.ts` verifies published-knowledge-consumed memory events are excluded from regenerated candidates
- broader service and type verification through `Vitest` and `tsc --noEmit`
