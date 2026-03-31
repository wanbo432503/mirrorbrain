# MirrorBrain

MirrorBrain / 镜像大脑 is a local-first Phase 1 MVP that imports authorized browser work activity, turns it into reviewable memory, and generates knowledge and skill drafts for `openclaw`.

Current Phase 1 scope is intentionally narrow:

- browser source only, via `ActivityWatch` + `aw-watcher-web`
- `OpenViking` as the primary local storage and retrieval layer
- local HTTP service plus a minimal standalone review UI
- candidate review, knowledge draft generation, and skill draft generation

This repository currently implements the browser-first MVP slice of the broader Phase 1 product plan. Shell history, document ingestion, and `openclaw` conversation capture remain planned but are not implemented in this repository yet.

## Architecture

- `src/apps/mirrorbrain-service/`: runtime service and polling lifecycle
- `src/apps/mirrorbrain-http-server/`: local HTTP API and static UI serving
- `src/apps/mirrorbrain-web/`: standalone MVP UI
- `src/integrations/activitywatch-browser-source/`: browser source adapter
- `src/integrations/openviking-store/`: OpenViking persistence and retrieval adapter

The current MVP serves the UI and JSON API from the same local origin.

## Prerequisites

Before starting MirrorBrain, make sure these local dependencies exist:

- Node.js and `pnpm`
- ActivityWatch running locally
- `aw-watcher-web` installed in your browser
- OpenViking running locally

Reference projects:

- ActivityWatch: `https://activitywatch.net/`
- `aw-watcher-web`: `https://github.com/ActivityWatch/aw-watcher-web`
- OpenViking: `https://github.com/volcengine/OpenViking`

Optional for E2E verification:

- Chromium for Playwright: `pnpm exec playwright install chromium`

## Quick Start

MirrorBrain Phase 1 depends on two local services:

- `ActivityWatch` for browser activity capture
- `OpenViking` for local storage and retrieval

### 1. Install ActivityWatch

Follow the official ActivityWatch installation guide for your operating system:

- ActivityWatch website: `https://activitywatch.net/`
- Official docs: `https://docs.activitywatch.net/`
- Browser watcher extension (`aw-watcher-web`): `https://github.com/ActivityWatch/aw-watcher-web`

Recommended setup for MirrorBrain Phase 1:

1. Install ActivityWatch desktop app from the official guide.
2. Start ActivityWatch locally.
3. Install `aw-watcher-web` in the browser you use for work capture.
4. Open the ActivityWatch UI and confirm browser tab events are being collected.

Expected local endpoint:

- ActivityWatch UI / API: `http://127.0.0.1:5600`

### 2. Install OpenViking

Install the server package:

```bash
pip install openviking --upgrade --force-reinstall
```

Optional CLI install:

```bash
curl -fsSL https://raw.githubusercontent.com/volcengine/OpenViking/main/crates/ov_cli/install.sh | bash
```

Create the OpenViking server config file at `~/.openviking/ov.conf`:

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

Export the config path:

```bash
export OPENVIKING_CONFIG_FILE=~/.openviking/ov.conf
```

If you use the CLI, create `~/.openviking/ovcli.conf`:

```json
{
  "url": "http://localhost:1933",
  "timeout": 60.0,
  "output": "table"
}
```

Then export:

```bash
export OPENVIKING_CLI_CONFIG_FILE=~/.openviking/ovcli.conf
```

Start OpenViking:

```bash
openviking-server
```

Expected local endpoint:

- OpenViking API: `http://127.0.0.1:1933`

Useful verification commands:

```bash
ov status
ov ls viking://resources/
```

### 3. Install MirrorBrain

```bash
pnpm install
```

### 4. Configure MirrorBrain

MirrorBrain reads these environment variables:

- `MIRRORBRAIN_HTTP_HOST`
- `MIRRORBRAIN_HTTP_PORT`
- `MIRRORBRAIN_WORKSPACE_DIR`
- `MIRRORBRAIN_ACTIVITYWATCH_BASE_URL`
- `MIRRORBRAIN_OPENVIKING_BASE_URL`
- `MIRRORBRAIN_SYNC_INTERVAL_MS`
- `MIRRORBRAIN_INITIAL_BACKFILL_HOURS`

At startup, `pnpm dev` loads the project-root `.env` file automatically when present. Shell environment variables still take precedence over values from `.env`.

Defaults are provided in [`.env.example`](./.env.example).

Default local ports:

- ActivityWatch: `http://127.0.0.1:5600`
- OpenViking: `http://127.0.0.1:1933`
- MirrorBrain: `http://127.0.0.1:3007`

Create a project-root `.env` based on [`.env.example`](./.env.example):

```bash
cp .env.example .env
```

Make sure these values match your local services:

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
MIRRORBRAIN_OPENVIKING_BASE_URL=http://127.0.0.1:1933
```

### 5. Start The MVP

1. Start ActivityWatch locally and verify the browser extension is capturing tabs.
2. Start OpenViking locally and verify its HTTP API is reachable.
3. Start MirrorBrain:

```bash
pnpm dev
```

4. Open `http://127.0.0.1:3007`

The startup script will:

- validate ActivityWatch reachability
- validate OpenViking reachability
- transpile the standalone web UI assets
- start browser sync polling
- start the local HTTP server

### 6. Verify The End-To-End Flow

1. Open `http://127.0.0.1:3007`
2. Confirm the page shows `Service Status: running`
3. Click `Sync Browser Memory`
4. Click `Create Candidate`
5. Click `Keep Candidate`
6. Click `Generate Knowledge`
7. Click `Generate Skill`

The page should show visible status messages for each step, plus:

- one candidate memory id
- one reviewed memory id
- one knowledge draft id
- one skill draft id

## MVP Walkthrough

The operator flow is the same as the Quick Start verification path above:

1. sync browser memory
2. create a candidate from imported memory
3. keep the candidate as reviewed memory
4. generate knowledge
5. generate skill

## API Surface

The local MVP HTTP API currently exposes:

- `GET /health`
- `POST /sync/browser`
- `GET /memory`
- `GET /knowledge`
- `GET /skills`
- `POST /candidate-memories`
- `POST /reviewed-memories`
- `POST /knowledge/generate`
- `POST /skills/generate`

## Verification

Run the automated checks with:

```bash
pnpm vitest run
pnpm tsc --noEmit
pnpm e2e
```

`pnpm e2e` runs the documented UI flow against the local fixture service in [`tests/e2e/fixtures/mirrorbrain-mvp-fixture.ts`](./tests/e2e/fixtures/mirrorbrain-mvp-fixture.ts). It verifies the operator flow and UI behavior without requiring real `ActivityWatch` and `OpenViking` processes. Real dependency startup is validated separately through `pnpm dev`.

## Storage Notes

- raw normalized `MemoryEvent` records are imported into OpenViking
- `CandidateMemory` and `ReviewedMemory` are also persisted as first-class artifacts
- the local runtime also writes generated web assets under a temporary output directory during startup

## Known Limitations

- Phase 1 currently supports only the browser source
- the UI is intentionally minimal and optimized for the first end-to-end workflow
- there is no authentication or multi-user support
- shell history, document ingestion, and `openclaw` conversation capture are not yet implemented
- skill execution is not part of this MVP

## Troubleshooting

`ActivityWatch is unreachable for the local MVP runtime.`

- make sure ActivityWatch is running on the configured base URL
- make sure the configured URL matches `MIRRORBRAIN_ACTIVITYWATCH_BASE_URL`

`OpenViking is unreachable for the local MVP runtime.`

- make sure OpenViking is running on the configured base URL
- make sure the configured URL matches `MIRRORBRAIN_OPENVIKING_BASE_URL`

The UI shows no useful memory after sync.

- make sure `aw-watcher-web` is installed and enabled
- make sure you have recent browser activity inside the configured backfill window

`pnpm e2e` fails because Chromium is missing.

- run `pnpm exec playwright install chromium`
