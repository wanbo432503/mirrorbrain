# MirrorBrain

[README 中文版](./README_CN.md)

MirrorBrain / 镜像大脑 is a local-first personal memory system for authorized PC work activity. It helps a user turn scattered work traces into three explicit products:

- **Memory**: source-attributed records and recall views of what happened.
- **Knowledge**: reviewed, human-readable knowledge articles organized by project and topic.
- **Skill**: draft or approved Agent Skill artifacts distilled from repeatable workflow evidence.

MirrorBrain is API-first and local-first. It runs as an independent local service with a React control UI, and agent clients can consume its memory, knowledge, and skill capabilities through explicit APIs.

## Current Status

The repository now contains a runnable local baseline with:

- ActivityWatch browser memory sync.
- Configured shell history sync with best-effort command redaction.
- Phase 4 source-ledger import for daily JSONL records from browser, file activity, screenshot, audio recording, shell, and agent source kinds.
- Source status and audit views.
- Work-session analysis for user-selected time windows.
- Preview and Published Project -> Topic -> Knowledge trees.
- Knowledge Article draft, revision, publication, and history flows.
- Topic knowledge, knowledge graph, and quality/lint workflows from earlier phases.
- Skill draft generation from reviewed evidence.
- Fastify HTTP API, OpenAPI docs, and a React local operator UI.
- QMD-backed indexing and retrieval under the MirrorBrain workspace.

For the detailed implementation snapshot, see [Current Project Status](./docs/features/current-project-status.md).

## Product Model

MirrorBrain keeps memory, knowledge, and skill separate throughout the lifecycle.

### Memory

Memory is the recall layer. It contains authorized, source-attributed activity records and derived review views.

Typical memory inputs include:

- browser events from ActivityWatch / `aw-watcher-web`
- shell history from an explicitly configured shell history path
- Phase 4 source-ledger JSONL records
- future document and host-agent sources once authorization and review boundaries are complete

Memory is never treated as durable knowledge automatically. It stays attributable, inspectable, and reviewable.

### Knowledge

Knowledge is the reviewed synthesis layer. In the current Phase 4 flow, reviewed work sessions produce project-scoped knowledge article drafts, which can then be previewed, revised, and published.

The durable reading model is:

```text
Project -> Topic -> Knowledge Article -> Revision History
```

Knowledge artifacts preserve provenance back to reviewed work and supporting memory evidence.

### Skill

Skill artifacts are reusable Agent Skill drafts generated from reviewed workflow evidence. They preserve evidence references and approval metadata. MirrorBrain does not silently execute skills; execution remains confirmation-bound unless a narrower safe exception is explicitly designed and documented.

## Main Local Workflow

A typical local MirrorBrain flow is:

```text
Authorized sources
  -> source sync / source-ledger import
  -> normalized MemoryEvent records
  -> work-session analysis
  -> human review
  -> preview knowledge tree
  -> published Project -> Topic -> Knowledge Article
```

In the UI this usually means:

1. Open **Memory Sources** and run source import or sync.
2. Inspect imported memory events and source audit/status information.
3. Open the review/work-session surface and analyze a 6-hour, 24-hour, or 7-day window.
4. Review generated work-session candidates.
5. Inspect the Preview Project -> Topic -> Knowledge tree.
6. Publish useful reviewed knowledge into the durable Published tree.
7. Optionally use the older Knowledge and Skill tabs for topic knowledge, graph, and skill draft workflows.

## Architecture At A Glance

| Layer | Path | Responsibility |
| --- | --- | --- |
| Service facade | `src/apps/mirrorbrain-service` | Composes runtime dependencies and exposes high-level MirrorBrain operations. |
| HTTP server | `src/apps/mirrorbrain-http-server` | Fastify API, OpenAPI docs, static UI serving, request/response validation. |
| React UI | `src/apps/mirrorbrain-web-react` | Local control UI that consumes the HTTP API only. |
| Domain modules | `src/modules` | Memory, knowledge, skill, authorization, graph, article, and review domain rules. |
| Workflows | `src/workflows` | Multi-step sync, import, analysis, narrative, merge, lint, and skill-draft orchestration. |
| Integrations | `src/integrations` | ActivityWatch, shell history, QMD workspace, source-ledger state, page content, and host adapters. |
| Shared | `src/shared` | Types, API contracts, config, and cross-cutting utilities. |

For the complete module catalog, see [Module Reference](./docs/components/module-reference.md).

## Quick Start

### 1. Prerequisites

Install or prepare:

- Node.js
- `pnpm`
- ActivityWatch running locally
- `aw-watcher-web` installed in the browser you want to authorize

Default local addresses:

- ActivityWatch: `http://127.0.0.1:5600`
- MirrorBrain: `http://127.0.0.1:3007`

### 2. Start ActivityWatch

1. Install ActivityWatch from `https://activitywatch.net/`.
2. Start ActivityWatch.
3. Install `aw-watcher-web` in the browser you want to authorize.
4. Confirm that the ActivityWatch UI shows browser tab events.

### 3. Configure MirrorBrain

```bash
pnpm install
pnpm --dir src/apps/mirrorbrain-web-react install
cp .env.example .env
```

Set local values in `.env`:

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
MIRRORBRAIN_BROWSER_BUCKET_ID=aw-watcher-web-chrome_laptop
MIRRORBRAIN_WORKSPACE_DIR=/path_to_workspace/mirrorbrain-workspace
MIRRORBRAIN_SHELL_HISTORY_PATH=/path_to_workspace/.zsh_history
MIRRORBRAIN_LLM_API_BASE=http://127.0.0.1:8000/v1
MIRRORBRAIN_LLM_API_KEY=replace-with-your-llm-api-key
MIRRORBRAIN_LLM_MODEL=replace-with-your-llm-model
```

MirrorBrain stores memory, knowledge, and skill artifacts under `MIRRORBRAIN_WORKSPACE_DIR`. QMD stores its rebuildable SQLite/vector index under:

```text
<workspaceDir>/mirrorbrain/qmd/
```

`MIRRORBRAIN_LLM_*` is used by knowledge and title generation flows. Memory sync and basic local inspection can still run independently of knowledge generation quality.

### 4. Run MirrorBrain

```bash
pnpm dev
```

The dev command validates local configuration, checks QMD workspace readiness and ActivityWatch availability, starts the React build watcher, starts the HTTP service, enables configured sync/import loops, and prints the service address, process id, and log path.

Open the local UI:

```text
http://127.0.0.1:3007
```

Open the API docs:

```text
http://127.0.0.1:3007/docs
```

Open the OpenAPI JSON:

```text
http://127.0.0.1:3007/openapi.json
```

## Verify The Local Flow

In the Web UI:

1. Open **Memory Sources**.
2. Select **All Sources** and run **Import Sources**.
3. Confirm imported memory events appear in the paginated memory list.
4. Open a source detail page to inspect source status, recent memory, and audit events.
5. Run a work-session analysis window.
6. Review generated work-session candidates.
7. Inspect the Preview Project -> Topic -> Knowledge tree.
8. Publish useful knowledge into the durable Published tree.
9. Open **Skill** and generate a skill draft from reviewed evidence when needed.

Expected results:

- Imported memory events keep source attribution.
- Source audit/status views show import and recorder state.
- Work-session candidates preserve supporting memory evidence.
- Preview knowledge can be published into durable Project -> Topic -> Knowledge Article content.
- Knowledge articles preserve provenance and revision history.
- Skill drafts preserve workflow evidence refs and confirmation metadata.

## API And Documentation

Architecture and component details live in `docs/` rather than this README.

Start with:

- [Documentation index](./docs/README.md)
- [Current Project Status](./docs/features/current-project-status.md)
- [Module Reference](./docs/components/module-reference.md)
- [MirrorBrain HTTP API](./docs/components/mirrorbrain-http-api.md)
- [MirrorBrain service](./docs/components/mirrorbrain-service.md)
- [MirrorBrain HTTP server](./docs/components/mirrorbrain-http-server.md)
- [Work Session Analysis UI](./docs/components/work-session-analysis-ui.md)
- [Knowledge Article](./docs/components/knowledge-article.md)
- [Knowledge Article Revision](./docs/components/knowledge-article-revision.md)
- [QMD workspace store](./docs/components/qmd-workspace-store.md)
- [Agent memory API](./docs/components/agent-memory-api.md)

## Common Commands

Local runtime:

```bash
pnpm dev
```

Root backend/service checks:

```bash
pnpm test
pnpm typecheck
pnpm e2e
git diff --check
```

React UI checks:

```bash
pnpm --dir src/apps/mirrorbrain-web-react exec vitest run
pnpm --dir src/apps/mirrorbrain-web-react build
```

## Current Non-Goals

- Document ingestion is not implemented yet.
- Full real source recorders for file activity, screenshot, richer shell sessions, and agent session directories are not complete yet.
- Durable authorization-scope management UI, source-instance allowlists, and revocation workflows are not complete yet.
- Production deployment, multi-user auth, retention policy, and network hardening are outside the current local-first baseline.
- Autonomous skill execution beyond draft generation and safety metadata is not implemented.

## Safety Principles

- Capture is opt-in and source-scoped.
- Source attribution must survive capture, review, knowledge synthesis, and skill drafting.
- Review is a product boundary: raw memory does not automatically become durable knowledge or executable skill.
- Sensitive data must not be silently promoted into durable artifacts.
- Host applications can consume MirrorBrain capabilities through APIs, but MirrorBrain owns its capture, review, and synthesis workflows.
