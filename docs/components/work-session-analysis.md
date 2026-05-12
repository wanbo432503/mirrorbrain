# Work Session Analysis

## Summary

`src/workflows/work-session-analysis` builds Phase 4 work-session candidates
from user-selected memory windows. It is a domain-only workflow: it groups
already captured `MemoryEvent` records into pending, reviewable work-session
candidates without changing source authorization, memory storage, knowledge
publication, or skill execution state.

## Responsibility Boundary

The workflow owns:

- Filtering memory events into a selected analysis window.
- Grouping included events by project entity hints.
- Preserving source event identifiers, source types, timestamps, and relation
  hints on each candidate.
- Marking generated candidates as pending review.

The workflow does not own:

- Memory capture or source authorization.
- Durable work-session storage.
- Human review state transitions beyond the initial pending candidate.
- Knowledge article generation or publication.
- Skill draft generation or execution.

## Key Interfaces

Input:

- `analysisWindow`: selected time range with a preset such as `last-6-hours`,
  `last-24-hours`, or `last-7-days`.
- `generatedAt`: timestamp used to identify the candidate generation pass.
- `memoryEvents`: source-attributed `MemoryEvent` records from authorized
  capture paths.

Output:

- `WorkSessionAnalysisResult`
  - `candidates`: pending `WorkSessionCandidate` objects grouped by project.
  - `excludedMemoryEventIds`: memory records outside the selected window.
- `WorkSessionCandidate`
  - `memoryEventIds`: provenance links back to memory records.
  - `sourceTypes`: source categories represented in the candidate.
  - `timeRange`: first and last event timestamp inside the candidate.
  - `relationHints`: lightweight source titles for later review and linking.
  - `reviewState`: initialized to `pending`.

## Data Flow

1. A caller supplies memory events and an explicit analysis window.
2. Events outside the window are excluded and reported by id.
3. Included events are grouped by `project` entities when present, otherwise
   by the `unassigned` project hint.
4. Each group is sorted by timestamp and converted into a pending work-session
   candidate.
5. The caller may later persist, display, review, merge, or discard the
   candidates through separate components.

## Failure Modes And Constraints

- The workflow assumes source authorization happened before memory events were
  supplied.
- Missing project entities are preserved under `unassigned` instead of being
  silently dropped.
- Candidate ids are deterministic for a project and generation timestamp but
  are not durable reviewed-session ids.
- Candidate review remains human-gated; this workflow does not mark anything as
  reviewed or publishable.

## Test Strategy

Unit tests live beside the workflow in
`src/workflows/work-session-analysis/index.test.ts`.

The current tests verify that:

- Multiple project-scoped candidates are produced for events inside a selected
  window.
- Source event ids, source types, timestamps, and pending review state are
  preserved.
- Events outside the selected window are excluded and reported.
