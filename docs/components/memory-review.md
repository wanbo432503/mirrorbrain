# Memory Review

## Summary

This component provides the minimal Phase 1 memory review state transitions. It groups one or more normalized `MemoryEvent` records into a `CandidateMemory` and converts an explicitly reviewed candidate into a `ReviewedMemory`.

## Responsibility Boundary

This component is responsible for:

- creating candidate memory from normalized memory events
- recording an explicit review decision on a candidate
- producing reviewed-memory identifiers that preserve candidate linkage

This component is not responsible for:

- ranking or selecting the best events to review
- persisting candidate or reviewed memory artifacts
- generating knowledge or skill artifacts

## Key Interfaces

- `createCandidateMemory(...)`
- `reviewCandidateMemory(...)`

## Data Flow

1. A caller passes one or more normalized memory events into the component.
2. The component groups them into a `CandidateMemory`.
3. A human review decision is applied to that candidate.
4. The component returns a `ReviewedMemory` that links back to the original candidate id.

## Test Strategy

- unit coverage in `src/modules/memory-review/index.test.ts`
- integration coverage through service tests that persist and reload review artifacts

## Known Risks Or Limitations

- candidate creation is currently simple grouping and does not include richer ranking signals
- review decisions are intentionally minimal and do not yet include edits, annotations, or merge behavior
