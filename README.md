# MirrorBrain

[README 中文版](./README_CN.md)

MirrorBrain / 镜像大脑 is the memory and capability layer for `openclaw`.

It is meant to do three things:

- capture authorized work activity as `memory`
- turn reviewed memory into readable `knowledge`
- turn repeated reviewed workflows into reusable `skill` drafts

## Current Status

This repository is still a narrow Phase 1 MVP.

What works now:

- browser source only, via `ActivityWatch` + `aw-watcher-web`
- local storage and retrieval via `OpenViking`
- local HTTP service and standalone web UI
- browser sync, daily candidate stream generation, AI review suggestions, reviewed memory, knowledge draft, and skill draft flow

What is not implemented yet:

- shell history capture
- document ingestion
- `openclaw` conversation capture
- broader source authorization UX
- production-grade deployment and operations

## Todo

The next obvious Phase 1 tasks are:

- add more authorized source types beyond browser activity
- improve review workflows and artifact quality
- harden the host/plugin boundary for `openclaw`
- make local setup simpler than the current ActivityWatch + OpenViking stack

Planning docs live under [`docs/plans/`](./docs/plans/).

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
```

### 5. Start MirrorBrain

```bash
pnpm dev
```

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
