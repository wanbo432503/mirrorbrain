# MirrorBrain

[README 中文版](./README_CN.md)

MirrorBrain / 镜像大脑 is a local-first global personal memory system for
authorized PC work activity. It records, imports, reviews, and organizes work
context across sources so a person can recover what happened, turn important
sessions into durable knowledge, and distill repeatable workflows into
reviewable skills.

## Background

Modern work leaves useful context across browser pages, local files, shell
commands, screenshots, and agent conversations. Without a dedicated personal
memory system, that context is scattered, hard to review, and difficult to
reuse safely.

MirrorBrain is not a generic note app and is no longer described primarily as
an `openclaw` plugin. Its role is to convert authorized personal work activity
into explicit, source-attributed memory products:

- `memory`: source-attributed activity records, recall views, candidate
  memories, reviewed memories, work-session candidates, and retrieval
  narratives.
- `knowledge`: human-readable synthesized artifacts derived from reviewed work,
  organized as Project -> Topic -> Knowledge Article with version history.
- `skill`: draft or approved Agent Skill artifacts derived from repeatable
  workflow evidence, with confirmation boundaries preserved before execution.

Phase 1 proved the local vertical slice. The repository now has a runnable
Phase 2 / Phase 3 baseline: browser and shell memory sync, review workflows,
topic-oriented knowledge, knowledge graph views, skill draft flows, a local
HTTP API, and a React control UI. Phase 4 changes the center of gravity to a
multi-source personal memory system: built-in source recorders write daily
JSONL ledgers, the importer converts those ledgers into unified `MemoryEvent`
records, users analyze time windows into reviewed work sessions, and reviewed
sessions feed project-scoped knowledge articles. For the current status
snapshot, see [Current Project Status](./docs/features/current-project-status.md).

## Philosophy

- User authorization comes first. Capture must be opt-in, source-scoped,
  attributable, and reviewable.
- Memory, knowledge, and skill are separate lifecycle products. The code,
  APIs, and docs should not blur their boundaries.
- Review is a product boundary. Raw activity can become candidate memory, but
  durable knowledge and reusable skills require explicit review or approval.
- Provenance must survive transformations. Records should remain traceable from
  source capture through review, knowledge synthesis, and skill drafting.
- MirrorBrain owns the personal memory workflow. Host applications, including
  `openclaw`, can consume memory, knowledge, and skill capabilities through
  explicit APIs, but they do not define or own MirrorBrain's internal lifecycle.
- Skills are not silent automation. Skill artifacts can guide agents, but
  execution requires confirmation unless a narrower safe exception is explicitly
  designed and documented.

## Feature Overview

### Memory

- Sync authorized browser activity from ActivityWatch and `aw-watcher-web`.
- Sync authorized shell history files when configured, with best-effort command
  secret redaction before MirrorBrain persistence.
- Import Phase 4 daily JSONL ledgers for browser, file activity, screenshot,
  shell, and agent transcript source kinds through a unified source-ledger
  boundary.
- Track source status, source audit events, and per-ledger checkpoints for
  operational visibility.
- Keep browser activity capture and readable page text capture as separate
  authorization decisions. The runtime service denies page text backfill by
  default unless a page-content authorization dependency is explicitly wired.
- Generate daily candidate memories for human review.
- Analyze user-selected time windows into work-session candidates for manual
  review.
- Store reviewed memories with source references and review decisions.
- Query memory through the local HTTP API and optional host adapters.
- Generate browser theme and shell problem narratives for recall-oriented
  questions such as "what did I do before?" or "how did I solve this issue?".

### Knowledge

- Generate knowledge drafts from reviewed memories.
- Produce topic-oriented knowledge artifacts with current-best versions.
- Generate Phase 4 Knowledge Article Drafts from reviewed work sessions.
- Organize durable knowledge under Project -> Topic -> Knowledge Article.
- Preserve provenance from reviewed memory into generated knowledge.
- Maintain topic history and knowledge graph views.
- Support quality checks and review-oriented regeneration flows.

### Skill

- Draft Agent Skills from reviewed workflow evidence.
- Preserve workflow evidence references in every skill artifact.
- Track approval state and execution safety metadata.
- Keep confirmation requirements explicit before any future execution flow.

### Operator Surfaces

- Fastify HTTP service with OpenAPI JSON and Swagger UI.
- React Web UI for local control, Memory Sources, review, work-session
  analysis, knowledge browsing, and skill draft inspection.
- Local workspace artifacts for inspectable records and fallback reads.
- QMD-backed indexing and retrieval inside the same MirrorBrain workspace.
- Shared API contract schemas for public knowledge and skill artifact DTOs.
- Optional integration surfaces for host applications that want to consume
  MirrorBrain capabilities.

### Safety And Contract Baselines

- Generic memory-source sync checks runtime authorization before upstream fetch
  and again before persistence.
- Shell memory stores redacted command content and redacted command-derived
  identifiers; it does not modify the user's original shell history file.
- Browser page text capture is URL-level, separately authorized, and best
  effort. Browser event capture can proceed without page text capture.
- HTTP response schemas for knowledge and skill artifacts live in
  `src/shared/api-contracts/` so transport optionality does not silently drift
  from domain types.

### Current Non-Goals

- Document import is not implemented yet.
- Full real source recorders for file activity, screenshot, richer shell
  sessions, and agent transcript directories are not complete yet.
- Durable authorization-scope management UI, source-instance allowlists, and
  revocation workflows are not complete yet.
- Production deployment, multi-user auth, retention policy, and network
  hardening are outside the current local-first baseline.
- Autonomous skill execution beyond draft generation and safety metadata is not
  implemented.

## Quick Start

### 1. Prerequisites

Install or prepare:

- Node.js
- `pnpm`
- ActivityWatch running locally
- `aw-watcher-web` installed in the target browser

Default local addresses:

- ActivityWatch: `http://127.0.0.1:5600`
- MirrorBrain: `http://127.0.0.1:3007`

### 2. Start ActivityWatch

1. Install ActivityWatch from `https://activitywatch.net/`.
2. Start ActivityWatch.
3. Install `aw-watcher-web` in the browser you want to authorize.
4. Confirm the ActivityWatch UI shows browser tab events.

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

MirrorBrain reads `MIRRORBRAIN_LLM_*` directly for knowledge and title
generation. Memory, knowledge, and skill artifacts are stored under
`MIRRORBRAIN_WORKSPACE_DIR`; QMD keeps its derived SQLite/vector index under
`<workspaceDir>/mirrorbrain/qmd/`.

The React UI is a nested app rather than a root `pnpm` workspace package today.
Install its dependencies before running `pnpm dev`; the dev command invokes the
nested Vite build watcher directly.

### 4. Run MirrorBrain

```bash
pnpm dev
```

The dev command validates local configuration, checks the QMD workspace and
ActivityWatch readiness, starts the React build watcher, starts the local HTTP
service, enables shell sync when configured, and prints the service address,
process id, and log path.

Open the local UI:

```text
http://127.0.0.1:3007
```

Open the API docs:

```text
http://127.0.0.1:3007/docs
```

### 5. Verify The Local Flow

In the Web UI:

1. Open `Memory Sources`, select `All-Main Sources`, and run `Import Sources`.
2. Confirm imported memory events appear in the paginated memory list.
3. Open a source detail page to inspect source status, recent memory, or audit
   events.
4. Run a work-session analysis window when you want to group recent activity
   into reviewable sessions.
5. Keep reviewed work or memory candidates to create durable review inputs.
6. Open `Knowledge` and generate or approve a knowledge draft or article.
7. Open `Skill` and generate a skill draft from reviewed evidence.

Expected results:

- Memory events show source attribution.
- Daily candidates include summaries, source refs, and review guidance.
- Source audit/status views show import and recorder state.
- Work-session candidates preserve their supporting memory evidence.
- Kept candidates become reviewed memories.
- Knowledge drafts retain reviewed-memory provenance.
- Knowledge articles are organized by project and topic where Phase 4 flows are
  used.
- Approved topic knowledge appears in topic and graph views.
- Skill drafts retain workflow evidence refs and confirmation metadata.

## Architecture And API Documentation

Architecture details live in `docs/components/` instead of this README.

Start with:

- [Documentation index](./docs/README.md)
- [Module reference](./docs/components/module-reference.md)
- [MirrorBrain HTTP API](./docs/components/mirrorbrain-http-api.md)
- [API contracts](./docs/components/api-contracts.md)
- [MirrorBrain service](./docs/components/mirrorbrain-service.md)
- [MirrorBrain HTTP server](./docs/components/mirrorbrain-http-server.md)
- [Local runtime](./docs/components/local-runtime.md)
- [Authorization scope policy](./docs/components/authorization-scope-policy.md)
- [Memory source sync](./docs/components/memory-source-sync.md)
- [Memory review storage](./docs/components/memory-review-storage.md)
- [Browser memory sync](./docs/components/browser-memory-sync.md)
- [Browser page content](./docs/components/browser-page-content.md)
- [OpenClaw plugin API](./docs/components/openclaw-plugin-api.md) optional host adapter
- [QMD workspace store](./docs/components/qmd-workspace-store.md)
- [Source directory audit](./docs/components/source-directory-audit.md)
- [ActivityWatch browser source](./docs/components/activitywatch-browser-source.md)
- [Shell history source](./docs/components/shell-history-source.md)
- [Memory review](./docs/components/memory-review.md)
- [Knowledge generation LLM](./docs/components/knowledge-generation-llm.md)
- [Knowledge lint](./docs/components/knowledge-lint.md)
- [Knowledge compilation system](./docs/components/knowledge-compilation-system.md)
- [Topic knowledge merge](./docs/components/topic-knowledge-merge.md)
- [Topic knowledge read](./docs/components/topic-knowledge-read.md)
- [Topic knowledge quality](./docs/components/topic-knowledge-quality.md)
- [Skill draft builder](./docs/components/skill-draft-builder.md)
- [Skill draft management](./docs/components/skill-draft-management.md)

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
