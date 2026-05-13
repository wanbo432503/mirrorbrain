# Work Session Review Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the current Review and Work Sessions experiences so Work Session candidates become the primary review entrypoint and feed Project -> Topic -> Knowledge tree management.

**Architecture:** The Web UI should expose one primary review flow built around work-session analysis windows. Preview knowledge trees are derived from the latest 6h/24h/7d analysis candidates, while published trees are loaded from persisted Knowledge Articles. Publishing a preview knowledge item reviews the underlying work session, generates a Knowledge Article Draft, then publishes it into the persisted Project -> Topic -> Knowledge tree.

**Tech Stack:** TypeScript, React, Vitest, Fastify HTTP API, file-backed MirrorBrain stores.

---

## Product Decision

The old daily `CandidateMemory -> ReviewedMemory` review path remains as a compatibility backend path for now, but it is no longer the primary Web UI workflow.

The primary UI flow becomes:

```text
MemoryEvent
-> work-session analysis window
-> WorkSessionCandidate
-> preview Project / Topic / Knowledge tree
-> Publish
-> ReviewedWorkSession
-> KnowledgeArticleDraft
-> Published KnowledgeArticle
-> published Project / Topic / Knowledge tree
```

The tree has two modes:

- `Preview`: generated from the current analysis window. It is ephemeral until the user publishes.
- `Published`: persisted tree of historical Project -> Topic -> Knowledge Article records.

Publishing must support an explicit merge intent:

- `create-new-article`
- `update-existing-article`
- `rewrite-existing-article`

The first implementation may map `rewrite-existing-article` onto the same backend versioning primitive as `update-existing-article`, but the UI and DTO should preserve the user's intent.

## Task 1: Document The New Review Boundary

**Files:**

- Modify: `docs/plans/2026-05-12-mirrorbrain-phase4-design.md`
- Modify: `docs/features/current-project-status.md`
- Modify: `README.md`
- Modify: `README_CN.md`

**Steps:**

1. Update docs so Work Sessions are described as the primary candidate generation and review flow.
2. Mark daily candidate memory review as legacy/compatibility, not the main UI direction.
3. Document `Preview` and `Published` tree modes.
4. Run `rg -n "Review tab|daily candidate|work-session"` against touched docs to verify wording is consistent.
5. Commit the documentation update.

## Task 2: Add Published Knowledge Tree API

**Files:**

- Test: `src/integrations/knowledge-article-store/index.test.ts`
- Modify: `src/integrations/knowledge-article-store/index.ts`
- Test: `src/apps/mirrorbrain-http-server/index.test.ts`
- Modify: `src/apps/mirrorbrain-http-server/index.ts`
- Modify: `src/apps/mirrorbrain-service/index.ts`
- Modify: `src/apps/mirrorbrain-web-react/src/types/index.ts`
- Modify: `src/apps/mirrorbrain-web-react/src/api/client.ts`
- Test: `src/apps/mirrorbrain-web-react/src/api/client.test.ts`

**Steps:**

1. Write a failing store test that saves projects, topics, and articles, then lists a Project -> Topic -> Knowledge Article tree.
2. Implement a minimal `listKnowledgeArticleTree()` store method.
3. Write a failing HTTP/API-client test for `GET /knowledge-articles/tree`.
4. Expose the tree through the service and HTTP server.
5. Add React API client and shared UI types.
6. Run targeted tests and commit.

## Task 3: Build Preview Tree Derivation

**Files:**

- Test: `src/apps/mirrorbrain-web-react/src/components/work-sessions/work-session-preview-tree.test.ts`
- Create: `src/apps/mirrorbrain-web-react/src/components/work-sessions/work-session-preview-tree.ts`

**Steps:**

1. Write a failing pure unit test that converts `WorkSessionCandidate[]` into preview Project -> Topic -> Knowledge tree nodes.
2. Use `candidate.projectHint` as the default project label.
3. Use the strongest relation hint, or the candidate title when no relation hint exists, as the default topic label.
4. Represent each candidate as one preview knowledge item with publish metadata.
5. Implement the pure derivation helper.
6. Run targeted tests and commit.

## Task 4: Replace Review Tab Main UI With Work Session Review

**Files:**

- Test: `src/apps/mirrorbrain-web-react/src/App.test.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/App.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/components/layout/TabNavigation.tsx`
- Test: `src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.tsx`

**Steps:**

1. Write a failing app test that `Review` renders the work-session review surface.
2. Remove the old top-level `work sessions` tab from primary navigation.
3. Mount `WorkSessionAnalysisPanel` under the `review` tab.
4. Keep the old `ReviewPanel` code in place but no longer route it as the main tab.
5. Run app and work-session tests and commit.

## Task 5: Add Preview / Published Tree UI

**Files:**

- Test: `src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.tsx`

**Steps:**

1. Write a failing test that after running an analysis, the left side shows `Preview` and `Published` subtabs.
2. Assert the Preview tree renders Project -> Topic -> Knowledge candidate levels.
3. Assert the Published tree loads from `api.listKnowledgeArticleTree()`.
4. Implement the tree UI with a left directory pane and right detail pane.
5. Run targeted tests and commit.

## Task 6: Publish Preview Knowledge Into Published Tree

**Files:**

- Test: `src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx`
- Modify: `src/apps/mirrorbrain-web-react/src/api/client.ts`
- Modify: `src/apps/mirrorbrain-web-react/src/types/index.ts`
- Modify: `src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.tsx`

**Steps:**

1. Write a failing test that clicking `Publish` on a preview knowledge item calls:
   - `reviewWorkSessionCandidate`
   - `generateKnowledgeArticleDraft`
   - `publishKnowledgeArticleDraft`
   - `listKnowledgeArticleTree`
2. Add API-client methods for draft generation and publishing if missing.
3. Add UI controls for project name, topic name, and merge intent.
4. Implement publish orchestration in the panel.
5. Refresh the Published tree after publish.
6. Run targeted tests and commit.

## Task 7: Verification

**Commands:**

```bash
corepack pnpm vitest run src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx
corepack pnpm vitest run src/apps/mirrorbrain-web-react/src/App.test.tsx src/apps/mirrorbrain-web-react/src/api/client.test.ts
corepack pnpm vitest run src/integrations/knowledge-article-store/index.test.ts src/apps/mirrorbrain-http-server/index.test.ts
corepack pnpm typecheck
cd src/apps/mirrorbrain-web-react && corepack pnpm build
git diff --check
```

Expected: all commands pass before the feature is considered complete.
