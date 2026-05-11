# MirrorBrain

[README 中文版](./README_CN.md)

MirrorBrain / 镜像大脑 is the memory and capability layer for `openclaw`.
It runs as an independent local service while exposing capability-oriented APIs
that can be wrapped by an `openclaw` plugin.

MirrorBrain is not a generic note application. Its product boundary is the
conversion of authorized work activity into three explicitly separated outputs:

- `memory`: source-attributed records, recall views, candidate memories,
  reviewed memories, and retrieval narratives.
- `knowledge`: human-readable synthesized artifacts derived from reviewed
  memory, including topic-oriented current-best knowledge and history.
- `skill`: Agent Skill drafts derived from reviewed workflow evidence, with
  confirmation required before execution.

## Current Implementation

The repository contains a working Phase 2 and Phase 3 baseline:

- Browser memory sync through ActivityWatch and `aw-watcher-web`.
- Shell history sync through an explicit configured history file.
- Local storage and retrieval through OpenViking plus workspace fallback files.
- Browser page-text capture for richer review and knowledge generation.
- `openclaw`-facing `query_memory` retrieval helpers and demo docs.
- Offline browser theme narratives for "what did I work on?" recall.
- Offline shell problem narratives for command-line problem-solving recall.
- Daily candidate generation, review decisions, reviewed memory, knowledge
  draft generation, topic knowledge approval, and skill draft generation.
- Topic knowledge versioning with current-best markers and history.
- Knowledge relation graph support using wikilinks and TF-IDF similarity.
- React web UI for local control, review, knowledge browsing, and skill drafts.
- Fastify HTTP API with OpenAPI docs.

Not yet implemented:

- Document ingestion.
- `openclaw` conversation capture.
- Full source authorization and revocation UX.
- Direct `openclaw` topic list/detail/history adapter helpers.
- Production deployment, retention, and operations hardening.
- Autonomous skill execution beyond draft generation and approval-state modeling.

## Architecture

MirrorBrain is an API-first TypeScript system.

| Layer | Path | Responsibility |
| --- | --- | --- |
| Apps | `src/apps/` | Runtime service, HTTP server, and web UI surfaces. |
| Integrations | `src/integrations/` | ActivityWatch, shell history, browser page content, OpenViking, checkpoints, and openclaw adapters. |
| Modules | `src/modules/` | Domain rules for authorization, capture, review, knowledge, graphing, relation scoring, caching, and skills. |
| Workflows | `src/workflows/` | Multi-step orchestration for sync, narratives, review, topic merge, linting, quality checks, and skill drafting. |
| Shared | `src/shared/` | Cross-layer types, config defaults, and low-level LLM HTTP helpers. |

Read the full code-facing module catalog:

- [docs/README.md](./docs/README.md)
- [docs/components/module-reference.md](./docs/components/module-reference.md)

## Runtime Data

MirrorBrain stores local workspace artifacts under
`<MIRRORBRAIN_WORKSPACE_DIR>/mirrorbrain/`:

- `memory-events/`
- `browser-page-content/`
- `candidate-memories/`
- `reviewed-memories/`
- `memory-narratives/`
- `knowledge/`
- `skill-drafts/`
- `state/sync-checkpoints/`
- `cache/`
- `deleted-artifacts/`

OpenViking is used for indexing and retrieval, but MirrorBrain also keeps
workspace files as inspectable local records and fallback reads.

## Quick Start

### 1. Prerequisites

Install or prepare:

- Node.js
- `pnpm`
- ActivityWatch running locally
- `aw-watcher-web` installed in the browser being captured
- OpenViking running locally

Default local endpoints:

- ActivityWatch: `http://127.0.0.1:5600`
- OpenViking: `http://127.0.0.1:1933`
- MirrorBrain: `http://127.0.0.1:3007`

### 2. Start ActivityWatch

1. Install ActivityWatch from `https://activitywatch.net/`.
2. Start ActivityWatch.
3. Install `aw-watcher-web` in the target browser.
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

MirrorBrain expects OpenViking to be reachable before startup.

### 4. Configure MirrorBrain

```bash
pnpm install
cp .env.example .env
```

Set the local values:

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
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

MirrorBrain reads `MIRRORBRAIN_LLM_*` values for knowledge/title generation.
OpenViking reads embedding settings from `~/.openviking/ov.conf`, so keep both
files consistent.

### 5. Run MirrorBrain

```bash
pnpm dev
```

The startup command:

- validates required `.env` values
- checks OpenViking reachability
- checks ActivityWatch browser watcher readiness
- starts the React `vite build --watch` process
- waits for the first React build output
- starts the MirrorBrain HTTP service
- enables shell sync when `MIRRORBRAIN_SHELL_HISTORY_PATH` is configured
- prints the service address, process id, and log path

Open the UI:

```text
http://127.0.0.1:3007
```

OpenAPI docs:

```text
http://127.0.0.1:3007/docs
```

## Basic Verification Flow

In the web UI:

1. Open the `Memory` tab and run browser sync.
2. Optionally run shell sync if a shell history path is configured.
3. Open the `Review` tab and create daily candidates.
4. Review a candidate and keep it.
5. Open the `Knowledge` tab and generate or approve a knowledge draft.
6. Open the `Skill` tab and generate a skill draft from reviewed memory.

Expected result:

- Imported memory events appear with source attribution.
- Daily candidates show summaries, source refs, and review guidance.
- Kept candidates become reviewed memories.
- Knowledge drafts preserve reviewed-memory provenance.
- Approved topic knowledge appears in topic and graph views.
- Skill drafts keep workflow evidence refs and require confirmation metadata.

## HTTP Surface

Primary local endpoints:

- `GET /health`
- `GET /memory`
- `POST /memory/query`
- `POST /sync/browser`
- `POST /sync/shell`
- `GET /candidate-memories`
- `POST /candidate-memories/daily`
- `POST /reviewed-memories`
- `GET /knowledge`
- `GET /knowledge/topics`
- `GET /knowledge/topics/:topicKey`
- `GET /knowledge/topics/:topicKey/history`
- `GET /knowledge/graph`
- `POST /knowledge/generate`
- `POST /knowledge/regenerate`
- `POST /knowledge/approve`
- `GET /skills`
- `POST /skills/generate`

The full generated schema is available at `/openapi.json` and `/docs`.
The written API contract is documented in
[docs/components/mirrorbrain-http-api.md](./docs/components/mirrorbrain-http-api.md).

## Documentation

Start here:

- [Documentation index](./docs/README.md)
- [Current module reference](./docs/components/module-reference.md)
- [MirrorBrain HTTP API](./docs/components/mirrorbrain-http-api.md)
- [Current project status](./docs/features/current-project-status.md)
- [OpenClaw memory tool example](./docs/features/openclaw-memory-tool-example.md)
- [OpenClaw demo guide](./docs/features/openclaw-memory-demo-guide.md)
- [Phase 2 / Phase 3 plan](./docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md)

## Commands

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm e2e
```

For documentation-only changes:

```bash
git diff --check
```
