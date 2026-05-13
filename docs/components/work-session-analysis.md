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
- Filtering noisy local browser records such as `localhost`, `127.x.x.x`,
  `0.0.0.0`, and loopback browser pages.
- Deduplicating repeated browser pages inside the selected window by stable URL,
  title, and summary.
- Grouping included events by project and topic hints.
- Falling back to browser hostnames as project hints and title-derived topic
  phrases when source-ledger records do not carry explicit project/topic
  entities.
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
  - `candidates`: pending `WorkSessionCandidate` objects grouped by project
    and topic.
  - `excludedMemoryEventIds`: memory records outside the selected window or
    removed as local noise / duplicates.
- `WorkSessionCandidate`
  - `memoryEventIds`: provenance links back to memory records.
  - `sourceTypes`: source categories represented in the candidate.
  - `timeRange`: first and last event timestamp inside the candidate.
  - `relationHints`: lightweight source titles for later review and linking.
  - `reviewState`: initialized to `pending`.

## Data Flow

1. A caller supplies memory events and an explicit analysis window.
2. Events outside the window are excluded and reported by id.
3. Local browser pages are filtered out so MirrorBrain's own UI and local dev
   pages do not become review candidates.
4. Repeated browser pages are deduplicated within the window.
5. Included events are grouped by explicit `project` and `topic` entities when
   present. Browser ledger records without explicit project/topic entities use
   hostname and title-derived phrase fallbacks.
6. Each group is sorted by timestamp and converted into a pending work-session
   candidate whose title and summary are suitable for preview knowledge review.
7. The caller may later persist, display, review, merge, or discard the
   candidates through separate components.

## Failure Modes And Constraints

- The workflow assumes source authorization happened before memory events were
  supplied.
- Missing project entities fall back to browser hostnames when available, then
  to `unassigned`.
- The fallback topic phrase is heuristic. High-value publication still depends
  on explicit human review before a Knowledge Article is published.
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
- Local browser noise is filtered out.
- Repeated browser pages are deduplicated.
- One project can produce multiple topic-scoped candidates.
- Source-ledger browser records without explicit project/topic entities receive
  project and topic fallback hints.
- Source event ids, source types, timestamps, and pending review state are
  preserved.
- Events outside the selected window, local browser noise, and duplicates are
  excluded and reported.
