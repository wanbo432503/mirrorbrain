# Memory Review

## Summary

This component turns raw `MemoryEvent` records into daily `CandidateMemory` streams and records explicit human review outcomes. Candidate generation is scoped to a single review date and now uses deterministic task-oriented browser grouping so related URLs can collapse into a human-reviewable "piece of work" instead of a flat host/path bucket.

## Responsibility Boundary

This component is responsible for:

- filtering raw memory events into a daily review window
- grouping daily events into one or more task-oriented candidate memory streams
- deriving stream metadata such as `title`, `theme`, `summary`, `timeRange`, source URL refs, and page-role hints
- recording explicit `keep` or `discard` review decisions while preserving candidate context

This component is not responsible for:

- persisting candidate or reviewed memory artifacts
- cross-day ranking, merging, or long-horizon clustering
- generating knowledge artifacts or skill drafts
- automatically approving candidates without a separate review action

## Key Interfaces

- `createCandidateMemories(...)`
- `reviewCandidateMemory(...)`
- `suggestCandidateReviews(...)`

## Data Flow

1. A caller passes normalized memory events and a `reviewDate` into `createCandidateMemories(...)`.
2. The component keeps only events whose timestamp falls on that review date.
3. The component prefers browser page-content text and page title when they are available, then falls back to raw browser title and URL tokens.
4. The component assigns page-role hints such as search, docs, chat, issue, pull-request, repository, debug, reference, or generic web.
5. The component groups events into task-oriented candidate streams using deterministic heuristic similarity across page text, titles, URLs, time, hosts, and page-role compatibility.
6. Each `CandidateMemory` includes stream metadata:
   - `id`
   - `memoryEventIds`
   - `sourceRefs`
   - `title`
   - `theme`
   - `summary`
   - `reviewDate`
   - `timeRange`
   - `reviewState`
7. Candidate generation caps the final result set at 10 streams with a three-way compression policy:
   - keep strong task groups independent
   - merge weak supporting groups into the most compatible stronger task
   - discard singleton supporting-only noise when it does not match any stronger task closely enough
8. A caller applies an explicit human decision with `reviewCandidateMemory(...)`.
9. The component returns a `ReviewedMemory` that preserves the candidate title, summary, theme, and memory-event linkage alongside the review decision.
10. A caller may request `suggestCandidateReviews(...)` to get suggestion-only review hints, supporting reasons, and a keep-score before any human decision is recorded.

## Key Data Structures

### `CandidateMemory`

- represents a single daily memory stream, not a first-event placeholder
- has a stable id derived from review date plus the stream key
- carries `sourceRefs` so the review UI can show the concrete URLs and visit times that justify the task
- `sourceRefs` can also carry page-role hints that explain whether a page acted like docs, search, chat, issue, PR, debug, or a generic web page
- `sourceRefs` can distinguish `primary` pages from `supporting` pages so the review UI can separate core task evidence from auxiliary browsing
- remains in `pending` state until an explicit review decision is recorded

### `ReviewedMemory`

- records the candidate link and human decision
- preserves enough candidate context to remain explainable outside the original review screen
- currently supports explicit `keep` and `discard` outcomes

### `CandidateReviewSuggestion`

- suggestion-only artifact for AI-assisted or rule-based triage
- includes recommendation, rationale, confidence, keep-score, supporting reasons, and priority
- can include evidence-mix fields such as primary/supporting source counts and summary copy so the UI can explain how much direct vs auxiliary evidence supports the task
- must not be treated as a reviewed memory or implicit approval

## Dependencies

- `src/shared/types/index.ts` for shared lifecycle types

## Failure Modes And Operational Constraints

- candidate creation throws if the selected review date has no memory events
- daily scope currently depends on ISO timestamp prefixes matching the provided `reviewDate`
- grouping is heuristic rather than model-based, so it can still miss subtle semantic relationships between tasks
- browser page-content text is used when available, but the flow still falls back to title/URL-only grouping when the page artifact is missing
- page-role hints improve grouping, but they are still inferred heuristically from URLs and titles
- candidate generation is intentionally capped at 10 tasks, which means weak one-off activity may be merged into broader neighbors
- singleton supporting-only browser pages such as isolated search or chat visits may be dropped instead of being forced into an unrelated candidate
- when weak fragments are merged to stay under the 10-task cap, the surviving candidate can carry compression metadata and reasons so the UI can explain the merge
- reviewed memory still requires a caller-supplied timestamp for auditability
- AI review suggestions are currently heuristic and should be treated as advisory only

## Test Strategy

- unit coverage in `src/modules/memory-review/index.test.ts`
- broader integration coverage through the service and HTTP layers once they adopt the daily candidate-stream contract

## Known Risks Or Limitations

- stream grouping is heuristic and task-token-based, so unrelated pages with shallow shared wording can still merge incorrectly
- page-text clustering now prefers terms repeated within a page or echoed by the page title, which reduces generic-word bleed but can still miss sparse one-off clues
- page-role hints reduce some false merges, but they do not replace stronger semantic modeling
- AI review suggestions exist, but they are still heuristic rather than model-backed
- daily scope assumes caller and source timestamps use a consistent day boundary
