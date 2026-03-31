# Local Runtime

## Summary

The local runtime packages MirrorBrain into a single MVP entrypoint that:

- validates local dependency reachability
- prepares standalone web assets from TypeScript source
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
- `prepareMirrorBrainWebAssets(...)`
- `startMirrorBrainDevRuntime(...)`
- `pnpm dev`

## Data Flow

1. The local runtime loads the project-root `.env` file when present and then overlays explicit shell environment variables on top of it.
2. The script checks ActivityWatch and OpenViking reachability.
3. The web app TypeScript entrypoint is transpiled into a local served asset directory.
4. The MirrorBrain service runtime starts.
5. The HTTP server starts and serves both JSON APIs and static MVP UI assets.

## Failure Modes And Operational Constraints

- startup fails fast if ActivityWatch or OpenViking is unreachable
- the runtime assumes a local, single-user environment
- this startup flow is intended for the MVP and is not yet hardened for production

## Test Strategy

- configuration, reachability, asset preparation, and runtime assembly coverage in `scripts/start-mirrorbrain-dev.test.ts`
- static asset serving coverage in `src/apps/mirrorbrain-http-server/index.test.ts`
