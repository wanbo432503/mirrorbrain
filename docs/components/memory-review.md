# Memory Review

## Summary

This component turns raw `MemoryEvent` records into daily `CandidateMemory` streams and records explicit human review outcomes. In Phase 1, candidate generation is scoped to a single review date and uses deterministic stream grouping so the same daily inputs produce the same candidate ids.

## Responsibility Boundary

This component is responsible for:

- filtering raw memory events into a daily review window
- grouping daily events into one or more candidate memory streams
- deriving stream metadata such as `title`, `theme`, `summary`, and `timeRange`
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
3. The component groups those events into candidate streams using a deterministic browser-focused stream key.
4. Each `CandidateMemory` includes stream metadata:
   - `id`
   - `memoryEventIds`
   - `title`
   - `theme`
   - `summary`
   - `reviewDate`
   - `timeRange`
   - `reviewState`
5. A caller applies an explicit human decision with `reviewCandidateMemory(...)`.
6. The component returns a `ReviewedMemory` that preserves the candidate title, summary, theme, and memory-event linkage alongside the review decision.
7. A caller may request `suggestCandidateReviews(...)` to get suggestion-only review hints before any human decision is recorded.

## Key Data Structures

### `CandidateMemory`

- represents a single daily memory stream, not a first-event placeholder
- has a stable id derived from review date plus the stream key
- remains in `pending` state until an explicit review decision is recorded

### `ReviewedMemory`

- records the candidate link and human decision
- preserves enough candidate context to remain explainable outside the original review screen
- currently supports explicit `keep` and `discard` outcomes

### `CandidateReviewSuggestion`

- suggestion-only artifact for AI-assisted or rule-based triage
- includes recommendation, rationale, confidence, and priority
- must not be treated as a reviewed memory or implicit approval

## Dependencies

- `src/shared/types/index.ts` for shared lifecycle types

## Failure Modes And Operational Constraints

- candidate creation throws if the selected review date has no memory events
- daily scope currently depends on ISO timestamp prefixes matching the provided `reviewDate`
- grouping is intentionally simple for Phase 1 and optimized for deterministic browser-event streams, not semantic clustering
- reviewed memory still requires a caller-supplied timestamp for auditability
- AI review suggestions are currently rule-based placeholders and should be treated as advisory only

## Test Strategy

- unit coverage in `src/modules/memory-review/index.test.ts`
- broader integration coverage through the service and HTTP layers once they adopt the daily candidate-stream contract

## Known Risks Or Limitations

- stream grouping is rule-based, so multiple tabs within the same host/path family may collapse into one candidate
- AI review suggestions exist, but they are not backed by a real model yet
- daily scope assumes caller and source timestamps use a consistent day boundary
