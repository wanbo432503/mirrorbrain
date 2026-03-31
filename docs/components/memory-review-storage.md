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
- `createMirrorBrainService(...).createCandidateMemory(...)`
- `createMirrorBrainService(...).reviewCandidateMemory(...)`

## Data Flow

1. Domain logic creates a `CandidateMemory` from raw `MemoryEvent[]`.
2. The service persists that candidate into OpenViking resource storage.
3. A user review decision produces a `ReviewedMemory`.
4. The service persists that reviewed memory into OpenViking resource storage.
5. Later workflows can reload stored candidates or reviewed memories for UI or generation flows.

## Dependencies

- `src/modules/memory-review/index.ts` for domain object creation
- `src/integrations/openviking-store/index.ts` for resource import and retrieval
- `src/apps/mirrorbrain-service/index.ts` for orchestration and persistence wiring

## Failure Modes And Operational Constraints

- if the OpenViking resource import fails, candidate or reviewed memory persistence fails with the underlying request error
- candidate and reviewed memory currently use JSON resource files rather than richer typed OpenViking entities
- lifecycle transitions still depend on explicit service calls; no background promotion is performed

## Test Strategy

- adapter coverage in `src/integrations/openviking-store/index.test.ts`
- service persistence coverage in `tests/integration/mirrorbrain-service-contract.test.ts`
- broader service and type verification through `Vitest` and `tsc --noEmit`
