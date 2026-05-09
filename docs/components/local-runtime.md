# Local Runtime

## Summary

The local runtime packages MirrorBrain into a single MVP entrypoint that:

- validates required local configuration and dependency readiness
- prepares standalone web assets from TypeScript source
- can launch MirrorBrain through a startup-oriented CLI flow
- starts the MirrorBrain service runtime
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
2. The CLI checks required local configuration, ActivityWatch browser-data availability, and OpenViking reachability.
3. If checks pass, the CLI launches MirrorBrain as a detached child process and prints a startup summary with service address, pid, and log path.
4. Inside the child process, the web app TypeScript entrypoint is transpiled into a local served asset directory.
5. The MirrorBrain service runtime starts, including optional shell-history sync wiring when `MIRRORBRAIN_SHELL_HISTORY_PATH` is set.
6. The HTTP server starts and serves both JSON APIs and static MVP UI assets.

## Failure Modes And Operational Constraints

- startup reports grouped issues for config, ActivityWatch, OpenViking, and runtime startup before exiting
- startup expects the local environment variables in `.env` to be present even when some runtime defaults exist in code
- `MIRRORBRAIN_LLM_API_BASE`, `MIRRORBRAIN_LLM_API_KEY`, and `MIRRORBRAIN_LLM_MODEL` configure the OpenAI-compatible chat model used by MirrorBrain title and knowledge generation
- `MIRRORBRAIN_EMBEDDING_API_BASE`, `MIRRORBRAIN_EMBEDDING_API_KEY`, `MIRRORBRAIN_EMBEDDING_MODEL`, and `MIRRORBRAIN_EMBEDDING_DIMENSION` document the embedding model that OpenViking should use for MirrorBrain resource indexing
- shell history remains opt-in and is only wired when `MIRRORBRAIN_SHELL_HISTORY_PATH` is explicitly configured
- the runtime assumes a local, single-user environment
- this startup flow is intended for the MVP and is not yet hardened for production

## Test Strategy

- configuration, dependency inspection, startup-cli behavior, asset preparation, and runtime assembly coverage in `scripts/start-mirrorbrain-dev.test.ts`
- static asset serving coverage in `src/apps/mirrorbrain-http-server/index.test.ts`
