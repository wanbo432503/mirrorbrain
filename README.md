# MirrorBrain

[README 中文版](./README_CN.md)

MirrorBrain / 镜像大脑 is the memory and capability layer for `openclaw`.

It is meant to do three things:

- capture authorized work activity as `memory`
- turn reviewed memory into readable `knowledge`
- turn repeated reviewed workflows into reusable `skill` drafts

## Current Status

This repository now carries a working Phase 2 **and** Phase 3 implementation baseline.

What works now:

- browser source sync via `ActivityWatch` + `aw-watcher-web`
- shell history source sync
- local storage and retrieval via `OpenViking`
- `openclaw`-facing `query_memory` retrieval contract and demo docs
- offline browser theme narratives for `昨天/今天我做了什么？` style recall
- offline shell problem narratives for `我之前是怎么通过命令行解决这个问题的？` style recall
- Phase 3 topic-knowledge model, merge workflow, and current-best history chain
- topic knowledge read surfaces across service, HTTP, and the standalone web UI
- fixture-backed topic-knowledge quality evaluation with a deterministic rubric
- local HTTP service and standalone web UI
- browser sync, daily candidate stream generation, AI review suggestions, reviewed memory, knowledge draft, and skill draft flow

What is not implemented yet:

- document ingestion
- `openclaw` conversation capture
- broader source authorization UX
- richer topic detail/history browsing in the standalone UI
- direct `openclaw` topic list/detail/history adapter helpers
- production-grade deployment and operations

## Todo

The next obvious tasks after Phase 3 are:

- add more authorized source types beyond browser activity
- strengthen topic-knowledge consistency and richer topic browsing
- expose topic knowledge more directly to `openclaw`
- strengthen skill execution quality without weakening confirmation boundaries
- make local setup simpler than the current ActivityWatch + OpenViking stack

Planning docs live under [`docs/plans/`](./docs/plans/).

Current roadmap/status docs:

- minimum `openclaw` tool example: [`docs/features/openclaw-memory-tool-example.md`](./docs/features/openclaw-memory-tool-example.md)
- minimum manual demo guide: [`docs/features/openclaw-memory-demo-guide.md`](./docs/features/openclaw-memory-demo-guide.md)
- current project status: [`docs/features/current-project-status.md`](./docs/features/current-project-status.md)
- Phase 2 / Phase 3 roadmap: [`docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md`](./docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md)
- Phase 3 implementation plan: [`docs/plans/2026-04-03-phase3-knowledge-implementation-plan.md`](./docs/plans/2026-04-03-phase3-knowledge-implementation-plan.md)
- Phase 3 test spec: [`docs/plans/2026-04-03-phase3-knowledge-test-spec.md`](./docs/plans/2026-04-03-phase3-knowledge-test-spec.md)
- browser theme narratives: [`docs/components/browser-theme-narratives.md`](./docs/components/browser-theme-narratives.md)
- shell problem narratives: [`docs/components/shell-problem-narratives.md`](./docs/components/shell-problem-narratives.md)
- topic knowledge merge: [`docs/components/topic-knowledge-merge.md`](./docs/components/topic-knowledge-merge.md)
- topic knowledge read surfaces: [`docs/components/topic-knowledge-read.md`](./docs/components/topic-knowledge-read.md)
- topic knowledge quality evaluation: [`docs/components/topic-knowledge-quality.md`](./docs/components/topic-knowledge-quality.md)

## Quick Start

### 1. Prerequisites

You need:

- Node.js
- `pnpm`
- ActivityWatch running locally
- `aw-watcher-web` installed in your browser
- OpenViking running locally

Default local endpoints:

- ActivityWatch: `http://127.0.0.1:5600`
- OpenViking: `http://127.0.0.1:1933`
- MirrorBrain: `http://127.0.0.1:3007`

### 2. Install ActivityWatch

1. Install ActivityWatch from `https://activitywatch.net/`
2. Start ActivityWatch
3. Install `aw-watcher-web` in the browser you want to track
4. Open the ActivityWatch UI and confirm browser tab events are being recorded

### 3. Install and Start OpenViking

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
      "api_base": "http://<your-model-endpoint>/v1",
      "api_key": "<your-api-key>",
      "provider": "openai",
      "dimension": 1024,
      "model": "<your-embedding-model>"
    },
    "max_concurrent": 10
  },
  "vlm": {
    "api_base": "http://<your-model-endpoint>/v1",
    "api_key": "<your-api-key>",
    "provider": "openai",
    "model": "<your-vlm-model>",
    "max_concurrent": 32
  }
}
```

Export the config path and start the server:

```bash
export OPENVIKING_CONFIG_FILE=~/.openviking/ov.conf
openviking-server
```

If OpenViking cannot start, fix that first. MirrorBrain depends on it.

### 4. Install MirrorBrain

```bash
pnpm install
cp .env.example .env
```

Edit `.env` so these values match your machine:

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
MIRRORBRAIN_OPENVIKING_BASE_URL=http://127.0.0.1:1933
MIRRORBRAIN_WORKSPACE_DIR=/path_to_workspace/mirrorbrain-workspace
MIRRORBRAIN_SHELL_HISTORY_PATH=/path_to_workspace/.zsh_history
```

### 5. Start MirrorBrain

```bash
pnpm dev
```

The startup command now performs local bring-up checks before launching MirrorBrain:

- reports missing required `.env` values in one pass
- checks `OpenViking` reachability
- checks that `ActivityWatch` has browser events in the last hour
- wires shell history sync into the runtime when `MIRRORBRAIN_SHELL_HISTORY_PATH` is configured
- starts MirrorBrain as a background process and prints the service address and log path

Then open:

```text
http://127.0.0.1:3007
```

API docs:

```text
http://127.0.0.1:3007/docs
```

### 6. Verify the MVP Flow

In the web UI:

1. Click `Sync Browser Memory`
2. Open the `Review` tab and click `Create Candidate`
3. The UI will generate candidate streams from yesterday's local memory window, then select one daily candidate stream
4. Optionally inspect the AI review suggestion
5. Click `Keep Candidate`
6. Open the `Artifacts` tab
7. Click `Generate Knowledge`
8. Click `Generate Skill`

Expected result:

- memory events appear in the page
- one or more daily candidate streams are shown
- the selected candidate shows a title, summary, and suggestion
- one reviewed memory id is shown
- one knowledge draft id is shown
- one skill draft id is shown

## Useful Commands

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm e2e
```
