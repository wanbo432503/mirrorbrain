# Local Runtime

## Summary

The local runtime packages MirrorBrain into a single MVP entrypoint that:

- validates required local configuration and dependency readiness
- prepares standalone web assets from TypeScript source
- supports isolated web asset output directories for test fixtures and other
  local callers
- can launch MirrorBrain through a startup-oriented CLI flow
- starts the MirrorBrain service runtime
- starts scheduled Phase 4 source-ledger imports
- starts the local HTTP server that serves both APIs and the standalone UI

## Responsibility Boundary

This component is responsible for local development and MVP startup only.

It is not responsible for:

- production deployment packaging
- remote infrastructure
- enterprise operations

## Key Interfaces

- `getMirrorBrainDevConfig(...)`
- `assertMirrorBrainDependenciesReachable(...)`
- `inspectMirrorBrainStartupDependencies(...)`
- `runMirrorBrainStartupCli(...)`
- `startMirrorBrainDetachedProcess(...)`
- `prepareMirrorBrainWebAssets(...)`
- `startMirrorBrainDevRuntime(...)`
- `pnpm dev`

## Data Flow

1. The startup flow loads the project-root `.env` file when present and then overlays explicit shell environment variables on top of it.
2. The CLI checks required local configuration, ActivityWatch browser-data
   availability, and QMD workspace writability.
3. If checks pass, the CLI launches MirrorBrain as a detached child process and prints a startup summary with service address, pid, and log path.
4. Inside the child process, the React web app is built by a Vite watcher into
   the default app `dist/` directory or a caller-provided isolated output
   directory.
5. The MirrorBrain service runtime starts, including optional shell-history sync wiring when `MIRRORBRAIN_SHELL_HISTORY_PATH` is set.
6. The service starts the Phase 4 source recorder supervisor. The default
   browser source uses ActivityWatch as its acquisition mechanism, converts new
   ActivityWatch browser events into browser ledger entries, writes them under
   `<workspaceDir>/mirrorbrain/ledgers/YYYY-MM-DD/browser.jsonl`, and repeats
   capture every minute while the service is running.
7. The service starts source-ledger import polling. It imports once immediately
   and then scans changed ledgers every minute in the local runtime so recently
   captured browser ledger entries reach MirrorBrain memory without waiting for
   a manual Import Sources action.
8. The HTTP server starts and serves both JSON APIs and static MVP UI assets.

## Failure Modes And Operational Constraints

- startup reports grouped issues for config, ActivityWatch, QMD workspace
  readiness, and runtime startup before exiting
- startup expects the local environment variables in `.env` to be present even when some runtime defaults exist in code
- startup and runtime service construction require an explicit
  `MIRRORBRAIN_WORKSPACE_DIR` or injected `workspaceDir`; MirrorBrain refuses
  to fall back to the repository working directory for durable storage
- `MIRRORBRAIN_BROWSER_BUCKET_ID` pins the ActivityWatch browser bucket used by
  browser source-ledger capture; when omitted, MirrorBrain auto-discovers the
  most recently updated `aw-watcher-web*` bucket
- `MIRRORBRAIN_LLM_API_BASE`, `MIRRORBRAIN_LLM_API_KEY`, and `MIRRORBRAIN_LLM_MODEL` configure the OpenAI-compatible chat model used by MirrorBrain title and knowledge generation
- the web UI `configure` tab can store LLM, embedding, and Tavily provider
  resource settings under `<workspaceDir>/mirrorbrain/state/`; current
  knowledge-generation code still uses the explicit LLM environment variables
  until runtime consumers are migrated to the resource-configuration API
- QMD stores derived SQLite/vector index state under
  `<workspaceDir>/mirrorbrain/qmd/`; deleting that directory should be treated
  as index loss, not durable data loss
- shell history remains opt-in and is only wired when `MIRRORBRAIN_SHELL_HISTORY_PATH` is explicitly configured
- source-ledger import polling reads only MirrorBrain-owned ledger files under
  `<workspaceDir>/mirrorbrain/ledgers`; source acquisition remains behind
  recorder authorization and ledger writers
- the runtime assumes a local, single-user environment
- this startup flow is intended for the MVP and is not yet hardened for production

## Test Strategy

- configuration, dependency inspection, startup-cli behavior, asset preparation, and runtime assembly coverage in `scripts/start-mirrorbrain-dev.test.ts`
- static asset serving coverage in `src/apps/mirrorbrain-http-server/index.test.ts`
