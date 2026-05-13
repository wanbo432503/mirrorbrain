# MirrorBrain

[README 中文版](./README_CN.md)

MirrorBrain / 镜像大脑 is the memory and capability layer for `openclaw`.
It helps `openclaw` remember authorized PC work activity, turn reviewed work
into durable knowledge, and propose reusable Agent Skills from repeatable
workflows.

## Background

Modern work leaves useful context across browser pages, shell commands, local
documents, and AI conversations. Without a dedicated memory layer, that context
is scattered, hard to review, and difficult for an agent to reuse safely.

MirrorBrain is built as a local-first, API-first subsystem for `openclaw`. It is
not a generic note app. Its role is to convert authorized work activity into
three explicit product outputs:

- `memory`: source-attributed activity records, recall views, candidate
  memories, reviewed memories, and retrieval narratives.
- `knowledge`: human-readable synthesized artifacts derived from reviewed
  memory, including topic-oriented current-best knowledge and version history.
- `skill`: draft or approved Agent Skill artifacts derived from repeatable
  workflow evidence, with confirmation boundaries preserved before execution.

Phase 1 proved the local vertical slice. The repository now has a runnable
Phase 2 / Phase 3 baseline: browser and shell memory sync, review workflows,
topic-oriented knowledge, knowledge graph views, skill draft flows, a local
HTTP API, and a React control UI. The current product direction remains
`openclaw` integration first, followed by stronger retrieval quality,
authorization UX, and topic knowledge quality. For the current status snapshot,
see [Current Project Status](./docs/features/current-project-status.md).

## Philosophy

- User authorization comes first. Capture must be opt-in, source-scoped,
  attributable, and reviewable.
- Memory, knowledge, and skill are separate lifecycle products. The code,
  APIs, and docs should not blur their boundaries.
- Review is a product boundary. Raw activity can become candidate memory, but
  durable knowledge and reusable skills require explicit review or approval.
- Provenance must survive transformations. Records should remain traceable from
  source capture through review, knowledge synthesis, and skill drafting.
- MirrorBrain owns its workflows. `openclaw` consumes memory, knowledge, and
  skill capabilities through explicit capability surfaces rather than hidden
  host-state coupling.
- Skills are not silent automation. Skill artifacts can guide agents, but
  execution requires confirmation unless a narrower safe exception is explicitly
  designed and documented.

## Feature Overview

### Memory

- Sync authorized browser activity from ActivityWatch and `aw-watcher-web`.
- Sync authorized shell history files when configured, with best-effort command
  secret redaction before MirrorBrain persistence.
- Keep browser activity capture and readable page text capture as separate
  authorization decisions. The runtime service denies page text backfill by
  default unless a page-content authorization dependency is explicitly wired.
- Generate daily candidate memories for human review.
- Store reviewed memories with source references and review decisions.
- Query memory through the local HTTP API and an `openclaw`-oriented helper.
- Generate browser theme and shell problem narratives for recall-oriented
  questions such as "what did I do before?" or "how did I solve this issue?".

### Knowledge

- Generate knowledge drafts from reviewed memories.
- Produce topic-oriented knowledge artifacts with current-best versions.
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
- React Web UI for local control, review, knowledge browsing, and skill draft
  inspection.
- Local workspace artifacts for inspectable records and fallback reads.
- OpenViking-backed indexing and retrieval for local search.
- Shared API contract schemas for public knowledge and skill artifact DTOs.

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
- `openclaw` conversation capture is not the current priority.
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
- OpenViking running locally

Default local addresses:

- ActivityWatch: `http://127.0.0.1:5600`
- OpenViking: `http://127.0.0.1:1933`
- MirrorBrain: `http://127.0.0.1:3007`

### 2. Start ActivityWatch

1. Install ActivityWatch from `https://activitywatch.net/`.
2. Start ActivityWatch.
3. Install `aw-watcher-web` in the browser you want to authorize.
4. Confirm the ActivityWatch UI shows browser tab events.

### 3. Start OpenViking

Install the server:

```bash
pip install openviking --upgrade --force-reinstall
```

Create `~/.openviking/ov.conf`:

```json
{
  "storage": {
    "workspace": "/path_to_workspace/openviking_workspace"
  },
  "log": {
    "level": "INFO",
    "output": "stdout"
  },
  "embedding": {
    "dense": {
      "api_base": "<MIRRORBRAIN_EMBEDDING_API_BASE>",
      "api_key": "<MIRRORBRAIN_EMBEDDING_API_KEY>",
      "provider": "openai",
      "dimension": 1024,
      "model": "<MIRRORBRAIN_EMBEDDING_MODEL>"
    },
    "max_concurrent": 10
  },
  "vlm": {
    "api_base": "<MIRRORBRAIN_LLM_API_BASE>",
    "api_key": "<MIRRORBRAIN_LLM_API_KEY>",
    "provider": "openai",
    "model": "<MIRRORBRAIN_LLM_MODEL>",
    "max_concurrent": 32
  }
}
```

Start OpenViking:

```bash
export OPENVIKING_CONFIG_FILE=~/.openviking/ov.conf
openviking-server
```

MirrorBrain expects OpenViking to be reachable before the local service starts.

### 4. Configure MirrorBrain

```bash
pnpm install
pnpm --dir src/apps/mirrorbrain-web-react install
cp .env.example .env
```

Set local values in `.env`:

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
MIRRORBRAIN_BROWSER_BUCKET_ID=aw-watcher-web-chrome_laptop
MIRRORBRAIN_OPENVIKING_BASE_URL=http://127.0.0.1:1933
MIRRORBRAIN_WORKSPACE_DIR=/path_to_workspace/mirrorbrain-workspace
MIRRORBRAIN_SHELL_HISTORY_PATH=/path_to_workspace/.zsh_history
MIRRORBRAIN_LLM_API_BASE=http://127.0.0.1:8000/v1
MIRRORBRAIN_LLM_API_KEY=replace-with-your-llm-api-key
MIRRORBRAIN_LLM_MODEL=replace-with-your-llm-model
MIRRORBRAIN_EMBEDDING_API_BASE=http://127.0.0.1:8000/v1
MIRRORBRAIN_EMBEDDING_API_KEY=replace-with-your-embedding-api-key
MIRRORBRAIN_EMBEDDING_MODEL=replace-with-your-embedding-model
MIRRORBRAIN_EMBEDDING_DIMENSION=1024
```

MirrorBrain reads `MIRRORBRAIN_LLM_*` directly for knowledge and title
generation. OpenViking reads embedding configuration from
`~/.openviking/ov.conf`, so keep both configurations aligned.

The React UI is a nested app rather than a root `pnpm` workspace package today.
Install its dependencies before running `pnpm dev`; the dev command invokes the
nested Vite build watcher directly.

### 5. Run MirrorBrain

```bash
pnpm dev
```

The dev command validates local configuration, checks OpenViking and
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

### 6. Verify The Local Flow

In the Web UI:

1. Open `Memory` and run browser sync.
2. Run shell sync if `MIRRORBRAIN_SHELL_HISTORY_PATH` is configured.
3. Open `Review` and create daily candidates.
4. Keep one candidate to create a reviewed memory.
5. Open `Knowledge` and generate or approve a knowledge draft.
6. Open `Skill` and generate a skill draft from reviewed memory.

Expected results:

- Memory events show source attribution.
- Daily candidates include summaries, source refs, and review guidance.
- Kept candidates become reviewed memories.
- Knowledge drafts retain reviewed-memory provenance.
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
- [OpenClaw plugin API](./docs/components/openclaw-plugin-api.md)
- [OpenViking store](./docs/components/openviking-store.md)
- [QMD workspace store](./docs/components/qmd-workspace-store.md)
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
