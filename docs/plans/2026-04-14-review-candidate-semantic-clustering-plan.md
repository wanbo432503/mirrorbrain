# Review Candidate Semantic Clustering Plan

## Summary

This plan upgrades MirrorBrain review candidate generation from shallow browser URL/title grouping into a task-oriented review pipeline that can use:

- URL and title structure
- browser page text from `browser-page-content`
- temporal continuity
- page-role hints such as search / docs / issue / PR / chat / localhost debugging

The goal is to make daily review candidates represent the work the user was actually trying to accomplish, not just which sites happened to be open.

This plan keeps the current MirrorBrain boundaries:

- raw browser activity still enters as `MemoryEvent`
- review still creates explicit `CandidateMemory`
- AI guidance remains suggestion-only
- reviewed memory still requires an explicit human decision

## Why This Work Exists

The current review flow is still too shallow:

- it can over-group unrelated pages that share host or token overlap
- it cannot properly use page text to recognize semantic relationships
- it cannot clearly distinguish primary task pages from supporting pages
- it does not yet explain candidate formation in enough detail for trustworthy review

The desired review experience is:

1. no more than 10 candidates for a review day
2. each candidate has a task-oriented title
3. each candidate shows the duration of the work
4. each candidate shows the concrete URLs involved
5. AI guidance explains why the candidate exists and why it may be worth keeping

## Product Requirements

### Candidate Output Requirements

Each generated candidate must:

- represent a plausible user task rather than a flat host/path bucket
- have a readable title that answers "what was the user trying to do?"
- expose a `timeRange` and derived duration
- expose concrete source URLs and visit timestamps
- be bounded into at most 10 candidates for a review day

### AI Guidance Requirements

Each candidate suggestion must:

- include a keep score from 0 to 100
- include a rationale paragraph
- include explicit supporting reasons
- explain why the included pages belong together
- remain suggestion-only and never auto-promote to reviewed memory

### Safety And Explainability Requirements

- candidate grouping must remain inspectable and testable
- raw source attribution must survive into `sourceRefs`
- low-confidence grouping should bias toward explicit human review
- semantic grouping must not silently hide raw browser provenance

## Target Architecture

The candidate generator should move to a two-layer design:

### Layer 1: Clustering Inputs

Create a normalized per-event candidate-clustering input model derived from:

- `MemoryEvent`
- workspace/browser page-content artifact when available
- task-role hints inferred from URL/title/text

Suggested shape:

- `eventId`
- `timestamp`
- `url`
- `title`
- `host`
- `pathSegments`
- `pageText`
- `pageTitle`
- `accessTimes`
- `pageRoleHints`
- `taskTokens`
- `entityTokens`

This model should live in a dedicated review module rather than inside UI code.

### Layer 2: Task Candidate Builder

Use the clustering inputs to build daily task candidates through deterministic scoring:

- semantic overlap from page text
- token overlap from title and URL
- page-role compatibility
- host/path compatibility
- temporal continuity
- primary/supporting page relationship

The result remains a `CandidateMemory`, but with richer `sourceRefs` and clearer reasoning.

## Implementation Phases

### Phase A: Introduce Page-Content-Aware Candidate Inputs

**Goal:** Make candidate generation aware of `browser-page-content` text without changing the whole clustering algorithm at once.

**Files likely involved:**

- `src/modules/memory-review/index.ts`
- `src/modules/memory-review/index.test.ts`
- new helper under `src/modules/memory-review/` for candidate clustering input preparation
- `src/apps/mirrorbrain-service/index.ts`
- `src/apps/mirrorbrain-service/index.test.ts`
- `docs/components/memory-review.md`

**Steps:**

1. Add failing tests for candidate generation that require page-text-aware grouping.
2. Introduce a clustering input builder that can attach page-content text when available.
3. Keep a narrow fallback path for events that do not yet have page text.
4. Preserve current review APIs while enriching internal grouping inputs.
5. Update docs.

**Acceptance criteria:**

- candidate generation can read page text from browser page-content artifacts
- tests prove that related pages can group based on page text rather than URL alone
- raw events without page text still participate with a fallback path

### Phase B: Replace Flat Grouping With Task-Oriented Heuristic Clustering

**Goal:** Stop using shallow host/path grouping as the primary candidate rule.

**Files likely involved:**

- `src/modules/memory-review/index.ts`
- `src/modules/memory-review/index.test.ts`
- new helper files under `src/modules/memory-review/`
- `docs/components/memory-review.md`

**Steps:**

1. Add failing tests for:
   - related docs + issue + PR + search pages grouped into one task
   - unrelated same-host pages kept separate
   - supporting pages attached to the right main task
2. Implement event-to-event and event-to-group scoring.
3. Introduce page-role hints:
   - search
   - docs
   - issue
   - PR
   - repository
   - chat
   - localhost/debug
4. Build candidates from temporal sessions plus semantic regrouping.
5. Keep the grouping deterministic and explainable.

**Acceptance criteria:**

- candidate titles are task-oriented
- grouping uses page text and role hints, not only URL structure
- task grouping remains deterministic under tests

### Phase C: Add Primary vs Supporting Source Reasoning

**Goal:** Improve review readability by separating the pages most central to the task from supporting evidence.

**Files likely involved:**

- `src/shared/types/index.ts`
- `src/apps/mirrorbrain-web-react/src/types/index.ts`
- `src/modules/memory-review/index.ts`
- `src/modules/memory-review/index.test.ts`
- `src/apps/mirrorbrain-http-server/index.ts`
- `src/apps/mirrorbrain-http-server/index.test.ts`
- `docs/components/memory-review.md`
- `docs/components/mirrorbrain-http-server.md`

**Steps:**

1. Add failing tests for candidate payloads that distinguish:
   - primary sources
   - supporting sources
2. Extend `CandidateMemory` or its nested refs in the smallest coherent way.
3. Update HTTP schemas.
4. Keep source attribution explicit.

**Acceptance criteria:**

- the selected candidate view can label why a page is central or supporting
- page-role reasoning can be surfaced in the UI without reverse-engineering the algorithm

### Phase D: Enforce Candidate Cap At 10

**Goal:** Keep daily review bounded and human-usable.

**Files likely involved:**

- `src/modules/memory-review/index.ts`
- `src/modules/memory-review/index.test.ts`
- `docs/components/memory-review.md`

**Steps:**

1. Add failing tests that generate more than 10 plausible groups.
2. Implement a merge/down-rank pass that:
   - keeps the strongest tasks separate
   - merges weak fragments into nearby stronger tasks where justified
   - biases weak leftovers toward support, not standalone candidates
3. Keep the final order stable and explainable.

**Acceptance criteria:**

- no review window returns more than 10 candidates
- the cap does not drop raw provenance
- merged low-evidence pages remain visible through `sourceRefs`

### Phase E: Upgrade AI Guidance To Explain Candidate Creation

**Goal:** Make the right-side review panel trustworthy and useful.

**Files likely involved:**

- `src/modules/memory-review/index.ts`
- `src/modules/memory-review/index.test.ts`
- `src/shared/types/index.ts`
- `src/apps/mirrorbrain-web-react/src/components/review/ReviewGuidance.tsx`
- `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx`
- `src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx`
- `docs/components/memory-review.md`
- `src/apps/mirrorbrain-web-react/README.md`

**Steps:**

1. Add failing tests for:
   - keep score
   - supporting reasons
   - candidate rationale tied to grouping evidence
2. Make `suggestCandidateReviews(...)` consume richer candidate evidence.
3. Surface:
   - keep score
   - rationale
   - supporting reasons
   - page relationship explanation
4. Keep the suggestions heuristic for now, not LLM-backed.

**Acceptance criteria:**

- each candidate has a visible keep score
- the UI explains why the grouped URLs belong together
- the UI explains why the candidate may be worth keeping

### Phase F: React Review UI Upgrade

**Goal:** Make the review UI match the richer candidate model.

**Files likely involved:**

- `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx`
- `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx`
- `src/apps/mirrorbrain-web-react/src/components/review/ReviewGuidance.tsx`
- `src/apps/mirrorbrain-web-react/src/components/review/CandidateCard.tsx`
- `src/apps/mirrorbrain-web-react/src/hooks/useReviewWorkflow.ts`
- `src/apps/mirrorbrain-web-react/src/types/index.ts`
- `src/apps/mirrorbrain-web-react/README.md`

**Steps:**

1. Add failing UI tests for:
   - duration display
   - clicked URL list
   - source-role display
   - keep score + rationale display
2. Render selected candidate details from `sourceRefs`.
3. Show the actual URLs with click-through links.
4. Show duration derived from `timeRange`.
5. Update metrics to count referenced events, not just candidate count.

**Acceptance criteria:**

- selected candidate shows task title, duration, and URLs
- AI guidance shows keep score and reasons
- the UI stays readable with up to 10 candidates

## Scoring Model Proposal

The first semantic version should remain deterministic and heuristic.

Suggested signals:

- `contentSimilarityScore`
  - keyword overlap from page text
  - entity overlap
  - error/library/feature token overlap
- `titleSimilarityScore`
  - normalized title token overlap
- `urlStructureScore`
  - shared host
  - shared product or project namespace
- `timeContinuityScore`
  - close timestamps
  - same session-like window
- `roleCompatibilityScore`
  - issue + PR + repo + docs can strongly support one task
  - search/chat can support a task but should rarely become the only primary page

Candidate membership should be decided by a combined score with explicit thresholds, all covered by tests.

## Data Model Changes

The next iteration should consider extending `CandidateMemory` more explicitly.

Suggested additions:

- `sourceRefs`
- `primarySourceRefs`
- `supportingSourceRefs`
- `durationMinutes`
- `candidateReasoning`
- `taskSignals`

For Phase A and Phase B, keep the schema change as small as possible. If `primarySourceRefs` and `supportingSourceRefs` can be deferred without breaking UI clarity, prefer deferring them until the grouping quality is proven.

## Testing Plan

### Domain Tests

Add or extend tests for:

- page-text-aware grouping
- same-host different-task separation
- multi-host same-task grouping
- candidate cap at 10
- supporting page assignment
- keep score and rationale generation

### Service Tests

Add or extend tests for:

- candidate generation using page-content-aware inputs
- candidate persistence preserving rich candidate refs
- review suggestion contract carrying keep score and reasons

### HTTP Tests

Add or extend tests for:

- candidate response schemas with rich source refs
- AI guidance response schemas with keep score and supporting reasons

### React UI Tests

Add or extend tests for:

- selected candidate duration formatting
- selected candidate URL rendering
- AI guidance score and reasoning display

## Delivery Sequence

Recommended implementation order:

1. Phase A
2. Phase B
3. Phase D
4. Phase E
5. Phase F
6. Phase C

Reasoning:

- first improve grouping inputs
- then improve actual task clustering
- then enforce bounded daily output
- then improve guidance and UI
- finally add more explicit source-role modeling if the simpler ref shape is not enough

## Non-Goals For This Plan

- embedding-first clustering in the first implementation pass
- fully autonomous candidate approval
- replacing human review with LLM judgment
- changing knowledge generation in the same change
- making `openclaw` the owner of daily review workflows

## Verification Commands

At each phase, the minimal verification bar should include:

```bash
pnpm vitest run src/modules/memory-review/index.test.ts
pnpm vitest run src/apps/mirrorbrain-service/index.test.ts src/apps/mirrorbrain-http-server/index.test.ts tests/integration/mirrorbrain-service-contract.test.ts
cd src/apps/mirrorbrain-web-react && pnpm vitest run
cd src/apps/mirrorbrain-web-react && pnpm exec tsc --noEmit
```

If root-level `pnpm typecheck` still includes unrelated React NodeNext import-extension failures, note that explicitly and keep the review-feature verification scoped to the affected package until that independent issue is resolved.
