# Memory Review Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the current placeholder review flow into a daily-review workflow that creates multiple candidate memory streams from today’s memory, and reserve backend interfaces for AI-assisted candidate analysis and review suggestions.

**Architecture:** Keep the existing TypeScript service-oriented shape, but replace the thin single-candidate model with a daily candidate-stream model. Expand the domain types first, then wire those richer candidate and AI-review contracts through the service and HTTP layers, and finally update the Web UI to present daily candidate streams and explicit review actions.

**Tech Stack:** TypeScript, Vitest, standalone TypeScript web UI, local HTTP API, `tsc --noEmit`

---

### Task 1: Redefine Review Types Around Daily Candidate Streams

**Files:**
- Modify: `src/shared/types/index.ts`
- Test: `src/modules/memory-review/index.test.ts`
- Modify: `src/modules/memory-review/index.ts`
- Modify: `docs/components/memory-review.md`

**Step 1: Write the failing tests**

Add tests in `src/modules/memory-review/index.test.ts` that expect:

- candidate creation to operate on a daily memory window instead of arbitrary undifferentiated memory
- candidate generation to return multiple `CandidateMemory` streams
- each candidate to include a stable id, a summary, and a theme/title representing the work stream
- candidate creation to reject empty input
- reviewed memory to preserve the candidate stream context and explicit decision

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/modules/memory-review/index.test.ts
```

Expected: FAIL because the current implementation only creates one candidate from the first event and exposes no stream-level metadata.

**Step 3: Write minimal implementation**

Update `src/shared/types/index.ts` and `src/modules/memory-review/index.ts` so:

- `CandidateMemory` can represent a candidate stream rather than a first-event placeholder
- the model includes at least:
  - stable `id`
  - `memoryEventIds`
  - `summary`
  - `title` or `theme`
  - `reviewState`
  - a daily time range or equivalent daily-scope metadata
- reviewed memory preserves enough candidate context to remain explainable
- candidate generation remains simple and deterministic for Phase 1

Do not build a sophisticated clustering engine yet. Use a narrow grouping rule that still returns multiple candidate streams when the inputs justify it.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm vitest run src/modules/memory-review/index.test.ts
```

Expected: PASS

**Step 5: Update docs**

Update `docs/components/memory-review.md` to document:

- daily-scope candidate generation
- multiple candidate streams
- candidate summary/theme fields
- explicit keep/discard reviewed outcomes

**Step 6: Commit**

```bash
git add src/shared/types/index.ts src/modules/memory-review/index.ts src/modules/memory-review/index.test.ts docs/components/memory-review.md
git commit -m "Model daily candidate memory streams"
```

### Task 2: Add AI-Review-Ready Domain Interfaces

**Files:**
- Test: `src/modules/memory-review/index.test.ts`
- Modify: `src/modules/memory-review/index.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `docs/components/memory-review.md`

**Step 1: Write the failing tests**

Add tests that expect a new analysis path such as:

- `analyzeCandidateMemories(...)`
- or `suggestCandidateReviews(...)`

The tests should expect:

- an explicit draft/suggestion output shape
- candidate-level rationales or scores
- no automatic promotion to reviewed memory

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/modules/memory-review/index.test.ts
```

Expected: FAIL because no AI-review-ready interface exists yet.

**Step 3: Write minimal implementation**

Add a narrow domain interface that can later host AI review without changing the service contract again.

The initial implementation may be rule-based or placeholder, but it must:

- accept candidate streams
- return explicit suggestions
- preserve human confirmation boundaries

Suggested output fields:

- candidate id
- recommendation (`keep`, `discard`, `review`)
- rationale
- confidence or priority score

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm vitest run src/modules/memory-review/index.test.ts
```

Expected: PASS

**Step 5: Update docs**

Document that:

- AI analysis is suggestion-only
- it does not replace human review in Phase 1
- the interface exists to support future automatic candidate triage

**Step 6: Commit**

```bash
git add src/shared/types/index.ts src/modules/memory-review/index.ts src/modules/memory-review/index.test.ts docs/components/memory-review.md
git commit -m "Add AI review suggestion contract"
```

### Task 3: Wire Candidate Stream And AI Contracts Through Service And HTTP

**Files:**
- Modify: `src/apps/mirrorbrain-service/index.ts`
- Test: `src/apps/mirrorbrain-service/index.test.ts`
- Modify: `src/apps/mirrorbrain-http-server/index.ts`
- Test: `src/apps/mirrorbrain-http-server/index.test.ts`
- Modify: `docs/components/mirrorbrain-service.md`
- Modify: `docs/components/mirrorbrain-http-server.md`

**Step 1: Write the failing tests**

Add or update tests so they expect:

- service-level candidate generation to return multiple candidate streams
- HTTP endpoints to support a daily review creation request instead of implicit “all loaded memory”
- a new AI suggestion endpoint or equivalent service method to exist
- AI suggestions to remain separate from reviewed-memory write operations

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/apps/mirrorbrain-service/index.test.ts src/apps/mirrorbrain-http-server/index.test.ts
```

Expected: FAIL because the current service and HTTP layers only understand single candidate creation and direct review.

**Step 3: Write minimal implementation**

Update the service and HTTP layers so they expose:

- daily candidate stream generation
- candidate listing if needed by the UI flow
- AI-review suggestion retrieval
- explicit reviewed-memory decisions that still require a caller action

Prefer narrow new endpoints over overloading old ones ambiguously.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm vitest run src/apps/mirrorbrain-service/index.test.ts src/apps/mirrorbrain-http-server/index.test.ts
```

Expected: PASS

**Step 5: Update docs**

Update:

- `docs/components/mirrorbrain-service.md`
- `docs/components/mirrorbrain-http-server.md`

Document the new candidate-stream and AI-suggestion contracts.

**Step 6: Commit**

```bash
git add src/apps/mirrorbrain-service/index.ts src/apps/mirrorbrain-service/index.test.ts src/apps/mirrorbrain-http-server/index.ts src/apps/mirrorbrain-http-server/index.test.ts docs/components/mirrorbrain-service.md docs/components/mirrorbrain-http-server.md
git commit -m "Expose daily candidate and AI review APIs"
```

### Task 4: Update The Web UI For Daily Candidate Streams

**Files:**
- Test: `src/apps/mirrorbrain-web/main.test.ts`
- Modify: `src/apps/mirrorbrain-web/main.ts`
- Modify: `src/apps/mirrorbrain-web/styles.css`
- Modify: `src/apps/mirrorbrain-web/README.md`
- Modify: `docs/features/mirrorbrain-review-ui.md`

**Step 1: Write the failing tests**

Add tests that expect:

- the Memory tab to scope candidate creation to today’s memory
- the Review tab to display multiple candidate streams
- each candidate stream to show a title/theme and summary
- the Review tab to surface AI review suggestions when available
- explicit keep/discard actions to operate on a selected candidate stream

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/apps/mirrorbrain-web/main.test.ts
```

Expected: FAIL because the current UI assumes a single current candidate and no AI suggestion surface.

**Step 3: Write minimal implementation**

Update the web UI so:

- `Create Candidate` on the Review tab becomes “generate daily candidates”
- the Review tab can browse multiple candidate streams
- each candidate clearly represents a work thread/theme
- AI suggestions render as suggestions, not final state
- keep/discard apply to the chosen candidate

Do not add a full editor, drag-and-drop grouping, or advanced workflow clustering yet.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm vitest run src/apps/mirrorbrain-web/main.test.ts
```

Expected: PASS

**Step 5: Update docs**

Update:

- `src/apps/mirrorbrain-web/README.md`
- `docs/features/mirrorbrain-review-ui.md`

Document daily candidate generation and AI suggestion visibility.

**Step 6: Commit**

```bash
git add src/apps/mirrorbrain-web/main.ts src/apps/mirrorbrain-web/main.test.ts src/apps/mirrorbrain-web/styles.css src/apps/mirrorbrain-web/README.md docs/features/mirrorbrain-review-ui.md
git commit -m "Add daily candidate stream review UI"
```

### Task 5: Broader Verification And Operator Docs

**Files:**
- Modify: `README.md`
- Modify: `README_CN.md`

**Step 1: Run targeted suites**

Run:

```bash
pnpm vitest run src/modules/memory-review/index.test.ts src/apps/mirrorbrain-service/index.test.ts src/apps/mirrorbrain-http-server/index.test.ts src/apps/mirrorbrain-web/main.test.ts
```

Expected: PASS

**Step 2: Run broader relevant suite**

Run:

```bash
pnpm vitest run tests/integration/mirrorbrain-service-contract.test.ts src/apps/mirrorbrain-web/main.test.ts src/apps/mirrorbrain-http-server/index.test.ts
```

Expected: PASS

**Step 3: Run type verification**

Run:

```bash
pnpm typecheck
```

Expected: PASS

**Step 4: Update top-level docs**

Update `README.md` and `README_CN.md` if needed to explain:

- daily candidate creation
- multiple candidate streams
- AI-review suggestion availability

**Step 5: Final commit**

```bash
git add README.md README_CN.md
git commit -m "Document daily candidate review workflow"
```

## Execution Notes

- Keep the scope aligned with Phase 1: browser-only, local-first, human-confirmed review.
- Candidate stream generation may start with a simple deterministic grouping heuristic; do not overbuild clustering.
- AI analysis must remain suggestion-only until a later plan explicitly changes that boundary.
- If persistence changes become necessary for candidate streams or AI suggestions, treat them as a scoped follow-up rather than silently broadening this plan.
