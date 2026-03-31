# MirrorBrain Phase 1 MVP Delivery Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current Phase 1 backend slice into a user-runnable MVP with a complete local environment, end-to-end usage path, and explicit deployment and operation documentation.

**Architecture:** Keep the existing service-oriented TypeScript domain and integration modules, then add the minimum runnable surfaces required for real usage: a local HTTP API, a minimal standalone review UI, first-class persistence for review artifacts, and a documented local startup flow for ActivityWatch and OpenViking dependencies.

**Tech Stack:** TypeScript, Vitest, Playwright, `tsc --noEmit`, local HTTP service, minimal TypeScript frontend, ActivityWatch, OpenViking

---

## MVP Acceptance Standard

Phase 1 is only considered complete when a new user can:

1. install and start the required local dependencies
2. start MirrorBrain locally with a documented command
3. confirm the service is healthy
4. trigger browser memory import from ActivityWatch
5. review at least one candidate memory in a user-facing interface
6. generate and view one knowledge draft and one skill draft
7. retrieve those artifacts through the `openclaw`-facing service API
8. complete the flow by following only repository documentation

If any of these require source-code reading or ad hoc shell knowledge, the MVP is incomplete.

### Task 1: Align Planning Docs To The User-Runnable MVP Standard

**Files:**
- Modify: `docs/plans/2026-03-16-mirrorbrain-prd.md`
- Modify: `docs/plans/2026-03-16-mirrorbrain-technical-design.md`
- Modify: `docs/features/mirrorbrain-phase1-e2e.md`
- Create: `docs/adr/2026-03-20-phase1-mvp-scope.md`

**Step 1: Write the failing documentation test**

Document the expected MVP acceptance bullets in the new ADR and capture the mismatch against the current “code-level slice” definition.

**Step 2: Verify the current docs fail this standard**

Confirm the current documents do not yet require:

- a runnable HTTP surface
- a user-facing review flow
- project-level setup and usage documentation
- Playwright E2E coverage for the MVP path

**Step 3: Write the minimal doc changes**

Update the planning docs so they explicitly define Phase 1 as a user-runnable MVP rather than a backend-only slice.

**Step 4: Review the docs for consistency**

Check the PRD, technical design, feature doc, and ADR for a single consistent MVP definition.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-16-mirrorbrain-prd.md docs/plans/2026-03-16-mirrorbrain-technical-design.md docs/features/mirrorbrain-phase1-e2e.md docs/adr/2026-03-20-phase1-mvp-scope.md
git commit -m "docs: redefine phase 1 as user-runnable mvp"
```

### Task 2: Add A Runnable HTTP Service Surface

**Files:**
- Create: `src/apps/mirrorbrain-http-server/index.ts`
- Create: `src/apps/mirrorbrain-http-server/index.test.ts`
- Modify: `src/apps/mirrorbrain-service/index.ts`
- Modify: `src/shared/config/index.ts`
- Modify: `src/shared/types/index.ts`
- Create: `docs/components/mirrorbrain-http-server.md`

**Step 1: Write the failing test**

Create tests that require:

- a health endpoint
- a sync trigger endpoint
- read endpoints for memory, knowledge, and skill drafts
- write endpoints for candidate creation, review, and artifact generation

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/apps/mirrorbrain-http-server/index.test.ts`
Expected: FAIL because the server app does not exist yet.

**Step 3: Write minimal implementation**

Implement the smallest local HTTP server that wraps the existing service contract and exposes explicit JSON APIs for the full Phase 1 path.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/apps/mirrorbrain-http-server/index.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/apps/mirrorbrain-http-server/index.test.ts src/apps/mirrorbrain-service/index.test.ts tests/integration/mirrorbrain-service-contract.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/apps/mirrorbrain-http-server/index.ts src/apps/mirrorbrain-http-server/index.test.ts src/apps/mirrorbrain-service/index.ts src/shared/config/index.ts src/shared/types/index.ts docs/components/mirrorbrain-http-server.md
git commit -m "feat: add runnable mirrorbrain http service"
```

### Task 3: Persist CandidateMemory And ReviewedMemory As First-Class Artifacts

**Files:**
- Modify: `src/integrations/openviking-store/index.ts`
- Modify: `src/integrations/openviking-store/index.test.ts`
- Modify: `src/modules/memory-review/index.ts`
- Modify: `src/modules/memory-review/index.test.ts`
- Modify: `src/apps/mirrorbrain-service/index.ts`
- Modify: `tests/integration/mirrorbrain-service-contract.test.ts`
- Create: `docs/components/memory-review-storage.md`

**Step 1: Write the failing test**

Create tests that require:

- persisted candidate memories to be listable and reloadable
- persisted reviewed memories to preserve decision metadata and provenance
- service methods to operate on stored review artifacts instead of in-memory only values

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/memory-review/index.test.ts src/integrations/openviking-store/index.test.ts tests/integration/mirrorbrain-service-contract.test.ts`
Expected: FAIL because candidate and reviewed memory are not stored as first-class artifacts yet.

**Step 3: Write minimal implementation**

Add OpenViking-backed write and read paths for candidate and reviewed memory, then wire the service methods to those persisted artifacts.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/memory-review/index.test.ts src/integrations/openviking-store/index.test.ts tests/integration/mirrorbrain-service-contract.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/modules/memory-review/index.test.ts src/integrations/openviking-store/index.test.ts src/apps/mirrorbrain-service/index.test.ts tests/integration/mirrorbrain-service-contract.test.ts tests/integration/mirrorbrain-phase1-e2e.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/integrations/openviking-store/index.ts src/integrations/openviking-store/index.test.ts src/modules/memory-review/index.ts src/modules/memory-review/index.test.ts src/apps/mirrorbrain-service/index.ts tests/integration/mirrorbrain-service-contract.test.ts docs/components/memory-review-storage.md
git commit -m "feat: persist candidate and reviewed memory artifacts"
```

### Task 4: Add A Minimal Standalone Review UI

**Files:**
- Create: `src/apps/mirrorbrain-web/index.html`
- Create: `src/apps/mirrorbrain-web/main.ts`
- Create: `src/apps/mirrorbrain-web/main.test.ts`
- Create: `src/apps/mirrorbrain-web/styles.css`
- Create: `src/apps/mirrorbrain-web/README.md`
- Create: `docs/features/mirrorbrain-review-ui.md`

**Step 1: Write the failing test**

Create UI tests that require a user to:

- see service health and sync status
- list memory artifacts
- create a candidate memory from selected raw memory
- review a candidate and mark it kept
- generate one knowledge draft and one skill draft

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/apps/mirrorbrain-web/main.test.ts`
Expected: FAIL because the standalone web UI does not exist yet.

**Step 3: Write minimal implementation**

Implement the smallest usable standalone UI with:

- a service connection panel
- a sync action
- a memory list
- a candidate review panel
- artifact generation buttons
- simple result views for knowledge and skill drafts

Keep the UI intentionally narrow and operational rather than polished.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/apps/mirrorbrain-web/main.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run src/apps/mirrorbrain-web/main.test.ts src/apps/mirrorbrain-http-server/index.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/apps/mirrorbrain-web/index.html src/apps/mirrorbrain-web/main.ts src/apps/mirrorbrain-web/main.test.ts src/apps/mirrorbrain-web/styles.css src/apps/mirrorbrain-web/README.md docs/features/mirrorbrain-review-ui.md
git commit -m "feat: add minimal mirrorbrain review ui"
```

### Task 5: Add Service Startup Scripts And Environment Templates

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `scripts/start-mirrorbrain-dev.ts`
- Create: `scripts/start-mirrorbrain-dev.test.ts`
- Create: `docs/components/local-runtime.md`

**Step 1: Write the failing test**

Create tests that require:

- a single documented dev start command
- environment parsing for HTTP port, workspace path, ActivityWatch URL, OpenViking URL, sync interval, and initial backfill window
- startup failure messages when required dependencies are unreachable

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/start-mirrorbrain-dev.test.ts`
Expected: FAIL because the startup script and environment contract do not exist yet.

**Step 3: Write minimal implementation**

Add a development startup entrypoint and package scripts so a user can start the local service and UI from documented commands.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/start-mirrorbrain-dev.test.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run scripts/start-mirrorbrain-dev.test.ts src/apps/mirrorbrain-http-server/index.test.ts src/apps/mirrorbrain-web/main.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add package.json .env.example scripts/start-mirrorbrain-dev.ts scripts/start-mirrorbrain-dev.test.ts docs/components/local-runtime.md
git commit -m "chore: add local startup flow for mvp"
```

### Task 6: Add Playwright MVP E2E Coverage

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/mirrorbrain-phase1-mvp.spec.ts`
- Create: `tests/e2e/fixtures/`
- Modify: `package.json`
- Create: `docs/features/mirrorbrain-phase1-mvp-e2e.md`

**Step 1: Write the failing test**

Create one Playwright test that drives the documented MVP path:

- open the standalone UI
- verify service health
- trigger sync
- create and review a candidate memory
- generate knowledge and skill drafts
- verify the results are visible

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/mirrorbrain-phase1-mvp.spec.ts`
Expected: FAIL because the UI and E2E harness are not complete yet.

**Step 3: Write minimal implementation**

Add the Playwright configuration, fixture setup, and the smallest test harness needed to validate the real local MVP path.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/mirrorbrain-phase1-mvp.spec.ts`
Expected: PASS

**Step 5: Run broader relevant tests**

Run: `pnpm vitest run`
Expected: PASS

Run: `npx playwright test`
Expected: PASS

Run: `pnpm tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e/mirrorbrain-phase1-mvp.spec.ts tests/e2e/fixtures package.json docs/features/mirrorbrain-phase1-mvp-e2e.md
git commit -m "test: add playwright coverage for phase 1 mvp"
```

### Task 7: Write The Root README For Installation, Deployment, And Use

**Files:**
- Create: `README.md`
- Modify: `docs/components/mirrorbrain-service.md`
- Modify: `docs/components/openviking-store.md`
- Modify: `docs/components/activitywatch-browser-source.md`

**Step 1: Write the failing documentation test**

Create a checklist in `README.md` draft form for:

- project overview
- architecture summary
- prerequisites
- local installation
- dependency setup for ActivityWatch and OpenViking
- environment variables
- startup commands
- test commands
- MVP usage walkthrough
- known limitations
- troubleshooting

**Step 2: Verify the repo currently fails this checklist**

Confirm the root README does not exist and that a new user cannot follow a single repository document to run the MVP.

**Step 3: Write minimal implementation**

Create the root README and make the component docs link back to it where necessary.

**Step 4: Review the docs for completeness**

Walk the README as if you were a new user and check that every required action has a command or UI step.

**Step 5: Commit**

```bash
git add README.md docs/components/mirrorbrain-service.md docs/components/openviking-store.md docs/components/activitywatch-browser-source.md
git commit -m "docs: add project readme for phase 1 mvp"
```

### Task 8: Run The Full MVP Verification Pass

**Files:**
- Modify: `progress.md`
- Modify: `findings.md`

**Step 1: Start the documented local environment**

Run the exact commands from `README.md` to start:

- ActivityWatch
- OpenViking
- MirrorBrain service
- MirrorBrain standalone UI

**Step 2: Execute the full automated verification**

Run:

- `pnpm vitest run`
- `npx playwright test`
- `pnpm tsc --noEmit`

Expected: PASS

**Step 3: Execute the manual MVP smoke flow**

Confirm that a fresh user can:

- load the UI
- trigger sync
- review one candidate
- generate one knowledge draft
- generate one skill draft

**Step 4: Record final findings**

Update `progress.md` and `findings.md` with:

- what worked
- what is still stubbed or mocked
- what remains outside Phase 1 MVP

**Step 5: Commit**

```bash
git add progress.md findings.md
git commit -m "docs: record phase 1 mvp verification results"
```

## Recommended Execution Order

1. Task 1 first, because the definition of “done” has changed.
2. Task 2 and Task 3 next, because the service must be runnable and review artifacts must persist.
3. Task 4 and Task 5 after that, because the MVP needs an operator-facing surface and startup contract.
4. Task 6 only after the UI and startup path are stable enough to automate.
5. Task 7 and Task 8 last, because documentation and verification should describe the actual runnable system rather than the intended one.

## Out Of Scope For This MVP Cut

- shell source integration
- `openclaw` conversation source integration
- document ingestion
- automatic publishing of knowledge
- automatic approval or execution of skills
- broad search, filtering, or ranking sophistication
- production deployment targets beyond a documented local developer/operator environment
