# MirrorBrain Phase 1 E2E Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first end-to-end MirrorBrain slice from ActivityWatch browser ingestion through OpenViking-backed memory persistence, review, knowledge draft creation, skill draft creation, and `openclaw` plugin-facing retrieval.

**Architecture:** Start from a minimal TypeScript service-oriented scaffold. Keep ActivityWatch and OpenViking behind thin integration adapters, enforce MirrorBrain lifecycle rules in domain modules, and expose a narrow API-first surface that can run in-process first and evolve into a separate service later.

**Tech Stack:** TypeScript, Vitest, Playwright, `tsc --noEmit`, ActivityWatch API integration, OpenViking integration adapter

---

### Task 1: Bootstrap The Minimal TypeScript Service Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/apps/mirrorbrain-service/index.ts`
- Create: `src/shared/types/index.ts`
- Create: `src/shared/config/index.ts`
- Create: `src/shared/config/index.test.ts`

**Step 1: Write the failing test**

Create `src/shared/config/index.test.ts` with a test that expects the config loader to expose a default sync interval and initial backfill window.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/config/index.test.ts`
Expected: FAIL because the config module does not exist yet.

**Step 3: Write minimal implementation**

Create the package/tooling files and implement a config loader that returns:

- a default polling interval in milliseconds
- a default initial backfill window
- placeholders for ActivityWatch and OpenViking connection settings

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/shared/config/index.test.ts`
Expected: PASS

**Step 5: Run type verification**

Run: `pnpm tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/apps/mirrorbrain-service/index.ts src/shared/types/index.ts src/shared/config/index.ts src/shared/config/index.test.ts
git commit -m "chore: bootstrap mirrorbrain typescript service scaffold"
```

### Task 2: Add Authorization Scope Policy

**Files:**
- Create: `src/modules/authorization-scope-policy/index.ts`
- Create: `src/modules/authorization-scope-policy/index.test.ts`
- Modify: `src/shared/types/index.ts`

**Step 1: Write the failing test**

Create tests that require:

- unauthorized source categories to be rejected
- authorized source scopes to support browser, shell, and `openclaw` conversation categories
- revocation to disable future ingestion for that scope

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/authorization-scope-policy/index.test.ts`
Expected: FAIL because the policy module does not exist yet.

**Step 3: Write minimal implementation**

Implement minimal types and policy functions for:

- creating an authorization scope
- checking whether a source event is allowed
- revoking a scope

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/authorization-scope-policy/index.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/shared/config/index.test.ts src/modules/authorization-scope-policy/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/types/index.ts src/modules/authorization-scope-policy/index.ts src/modules/authorization-scope-policy/index.test.ts
git commit -m "feat: add authorization scope policy"
```

### Task 3: Add ActivityWatch Browser Sync Planning And Scheduling

**Files:**
- Create: `src/integrations/activitywatch-browser-source/index.ts`
- Create: `src/integrations/activitywatch-browser-source/index.test.ts`
- Modify: `src/shared/config/index.ts`
- Modify: `src/shared/types/index.ts`

**Step 1: Write the failing test**

Create tests that require:

- initial sync to request a controlled backfill window
- incremental sync to use a persisted checkpoint
- polling interval to be configurable instead of hard-coded

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/integrations/activitywatch-browser-source/index.test.ts`
Expected: FAIL because the adapter module does not exist yet.

**Step 3: Write minimal implementation**

Implement a thin adapter that:

- builds ActivityWatch query parameters for initial backfill
- builds query parameters for incremental sync
- exposes a sync schedule derived from config

Do not make network calls yet beyond what the tests require to model request planning.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/integrations/activitywatch-browser-source/index.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/shared/config/index.test.ts src/modules/authorization-scope-policy/index.test.ts src/integrations/activitywatch-browser-source/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/config/index.ts src/shared/types/index.ts src/integrations/activitywatch-browser-source/index.ts src/integrations/activitywatch-browser-source/index.test.ts
git commit -m "feat: add activitywatch browser sync planning"
```

### Task 4: Normalize ActivityWatch Events Into MemoryEvent And Persist To OpenViking

**Files:**
- Create: `src/modules/memory-capture/index.ts`
- Create: `src/modules/memory-capture/index.test.ts`
- Create: `src/integrations/openviking-store/index.ts`
- Create: `src/integrations/openviking-store/index.test.ts`
- Modify: `src/shared/types/index.ts`

**Step 1: Write the failing test**

Create tests that require:

- an ActivityWatch browser event to normalize into a `MemoryEvent`
- source attribution to be preserved
- normalized events to be handed to an OpenViking store adapter with stable ids and ingestion metadata

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/memory-capture/index.test.ts src/integrations/openviking-store/index.test.ts`
Expected: FAIL because the capture and store modules do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- a normalizer from ActivityWatch browser events to `MemoryEvent`
- a minimal OpenViking write adapter interface
- persistence calls that attach source ids and checkpoints as ingestion metadata

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/memory-capture/index.test.ts src/integrations/openviking-store/index.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/shared/config/index.test.ts src/modules/authorization-scope-policy/index.test.ts src/integrations/activitywatch-browser-source/index.test.ts src/modules/memory-capture/index.test.ts src/integrations/openviking-store/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/types/index.ts src/modules/memory-capture/index.ts src/modules/memory-capture/index.test.ts src/integrations/openviking-store/index.ts src/integrations/openviking-store/index.test.ts
git commit -m "feat: normalize and persist memory events"
```

### Task 5: Generate CandidateMemory And Review Decisions

**Files:**
- Create: `src/modules/memory-review/index.ts`
- Create: `src/modules/memory-review/index.test.ts`
- Modify: `src/shared/types/index.ts`

**Step 1: Write the failing test**

Create tests that require:

- related `MemoryEvent` records to group into a `CandidateMemory`
- candidate state to remain distinct from reviewed state
- explicit user review decisions to produce `ReviewedMemory`

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/memory-review/index.test.ts`
Expected: FAIL because the review module does not exist yet.

**Step 3: Write minimal implementation**

Implement minimal grouping and review transition functions with explicit state fields.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/memory-review/index.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/modules/memory-capture/index.test.ts src/modules/memory-review/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/types/index.ts src/modules/memory-review/index.ts src/modules/memory-review/index.test.ts
git commit -m "feat: add candidate memory review flow"
```

### Task 6: Generate Daily Review Knowledge Drafts

**Files:**
- Create: `src/modules/daily-review-knowledge/index.ts`
- Create: `src/modules/daily-review-knowledge/index.test.ts`
- Create: `src/workflows/daily-review/index.ts`
- Create: `src/workflows/daily-review/index.test.ts`
- Modify: `src/shared/types/index.ts`

**Step 1: Write the failing test**

Create tests that require:

- reviewed memory to be selected as the only valid knowledge input
- knowledge drafts to carry source reviewed memory ids
- publication state to remain draft until explicit review approval

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/daily-review-knowledge/index.test.ts src/workflows/daily-review/index.test.ts`
Expected: FAIL because the knowledge modules do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- a knowledge draft builder using reviewed memory only
- a daily review workflow that returns a draft artifact with provenance

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/daily-review-knowledge/index.test.ts src/workflows/daily-review/index.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/modules/memory-review/index.test.ts src/modules/daily-review-knowledge/index.test.ts src/workflows/daily-review/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/types/index.ts src/modules/daily-review-knowledge/index.ts src/modules/daily-review-knowledge/index.test.ts src/workflows/daily-review/index.ts src/workflows/daily-review/index.test.ts
git commit -m "feat: add daily review knowledge drafts"
```

### Task 7: Generate Skill Drafts From Reviewed Workflow Evidence

**Files:**
- Create: `src/modules/skill-draft-management/index.ts`
- Create: `src/modules/skill-draft-management/index.test.ts`
- Create: `src/workflows/skill-draft-builder/index.ts`
- Create: `src/workflows/skill-draft-builder/index.test.ts`
- Modify: `src/shared/types/index.ts`

**Step 1: Write the failing test**

Create tests that require:

- repeated reviewed activity to generate workflow evidence
- workflow evidence to produce a `SkillArtifact` draft
- draft approval to remain separate from execution permission

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/skill-draft-management/index.test.ts src/workflows/skill-draft-builder/index.test.ts`
Expected: FAIL because the skill modules do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- workflow evidence extraction from reviewed memory
- draft skill generation with approval state and safety metadata

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/skill-draft-management/index.test.ts src/workflows/skill-draft-builder/index.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/modules/daily-review-knowledge/index.test.ts src/modules/skill-draft-management/index.test.ts src/workflows/skill-draft-builder/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/types/index.ts src/modules/skill-draft-management/index.ts src/modules/skill-draft-management/index.test.ts src/workflows/skill-draft-builder/index.ts src/workflows/skill-draft-builder/index.test.ts
git commit -m "feat: add skill draft generation"
```

### Task 8: Expose The Narrow OpenClaw Plugin API

**Files:**
- Create: `src/integrations/openclaw-plugin-api/index.ts`
- Create: `src/integrations/openclaw-plugin-api/index.test.ts`
- Modify: `src/apps/mirrorbrain-service/index.ts`

**Step 1: Write the failing test**

Create tests that require:

- `queryMemory(...)` to return source-attributed reviewed or candidate memory results
- `listKnowledge(...)` to return knowledge drafts with provenance
- `listSkillDrafts(...)` to return skill drafts with approval metadata

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/integrations/openclaw-plugin-api/index.test.ts`
Expected: FAIL because the plugin API module does not exist yet.

**Step 3: Write minimal implementation**

Implement a thin API layer that delegates to MirrorBrain modules and returns lifecycle metadata needed by `openclaw`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/integrations/openclaw-plugin-api/index.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/integrations/openclaw-plugin-api/index.test.ts src/workflows/daily-review/index.test.ts src/workflows/skill-draft-builder/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/apps/mirrorbrain-service/index.ts src/integrations/openclaw-plugin-api/index.ts src/integrations/openclaw-plugin-api/index.test.ts
git commit -m "feat: expose openclaw plugin api"
```

### Task 9: Add The First End-To-End Integration Test

**Files:**
- Create: `tests/integration/mirrorbrain-phase1-e2e.test.ts`
- Create: `tests/fixtures/activitywatch/browser-events.json`
- Modify: `src/integrations/activitywatch-browser-source/index.ts`
- Modify: `src/integrations/openviking-store/index.ts`
- Modify: `src/integrations/openclaw-plugin-api/index.ts`

**Step 1: Write the failing test**

Create an integration test that proves:

- ActivityWatch browser fixture data can be backfilled
- normalized `MemoryEvent` records persist to the OpenViking adapter
- candidate memory can be reviewed
- a knowledge draft and skill draft are produced
- `openclaw` API queries return the resulting artifacts

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/integration/mirrorbrain-phase1-e2e.test.ts`
Expected: FAIL because the end-to-end flow is not fully wired yet.

**Step 3: Write minimal implementation**

Add the smallest composition code needed to connect the existing modules and adapters for the first vertical slice.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/integration/mirrorbrain-phase1-e2e.test.ts`
Expected: PASS

**Step 5: Run broader relevant suite**

Run: `pnpm vitest run`
Expected: PASS

**Step 6: Run type verification**

Run: `pnpm tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add tests/integration/mirrorbrain-phase1-e2e.test.ts tests/fixtures/activitywatch/browser-events.json src/integrations/activitywatch-browser-source/index.ts src/integrations/openviking-store/index.ts src/integrations/openclaw-plugin-api/index.ts
git commit -m "feat: wire first mirrorbrain phase1 e2e slice"
```

### Task 10: Update Component Documentation Alongside Implementation

**Files:**
- Create: `docs/components/activitywatch-browser-source.md`
- Create: `docs/components/openviking-store.md`
- Create: `docs/features/mirrorbrain-phase1-e2e.md`

**Step 1: Write the docs after the related code lands**

Document:

- purpose
- responsibilities and boundaries
- key interfaces
- data flow
- test strategy
- known limitations

**Step 2: Verify docs align with implemented behavior**

Check the docs against the final code and tests.

**Step 3: Commit**

```bash
git add docs/components/activitywatch-browser-source.md docs/components/openviking-store.md docs/features/mirrorbrain-phase1-e2e.md
git commit -m "docs: add phase1 component documentation"
```
