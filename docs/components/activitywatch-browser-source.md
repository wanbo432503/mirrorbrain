# ActivityWatch Browser Source

## Summary

This component adapts browser activity coming from `ActivityWatch`, with `aw-watcher-web` as the initial capture mechanism for Phase 1. It now covers sync planning, HTTP event retrieval, and the browser source plugin that plugs into MirrorBrain's generic memory-source sync workflow.

## Responsibility Boundary

- owns sync planning for browser event import
- exposes a browser source plugin with source-specific normalization and deduplication rules
- treats `ActivityWatch` as an upstream source only
- does not own long-term storage, review state, or downstream artifact generation

## Key Interfaces

- `createInitialBrowserSyncPlan(...)`
- `createIncrementalBrowserSyncPlan(...)`
- `getBrowserSyncSchedule(...)`
- `fetchActivityWatchBrowserEvents(...)`
- `createActivityWatchBrowserMemorySourcePlugin(...)`
- `runBrowserMemorySyncOnce(...)` consumes this plugin through the generic source-sync workflow

## Data Flow

1. MirrorBrain reads config for backfill window and polling interval.
2. The adapter builds a controlled initial backfill request or an incremental request from checkpoint state.
3. The adapter fetches browser events from the ActivityWatch HTTP API.
4. The source plugin normalizes browser events and suppresses near-duplicate page records that repeat the same page signature within a short time window before persistence.
5. The generic source-sync workflow persists sanitized events and advances the checkpoint store.

## Operational Note

For the local MVP environment and required browser extension setup, see the repository [README](../../README.md).

## Test Strategy

- unit tests cover initial backfill range calculation
- unit tests cover incremental checkpoint usage
- unit tests cover configurable polling schedule behavior
- unit tests cover ActivityWatch HTTP request construction and response parsing
- workflow tests cover initial backfill, incremental checkpoint usage, and duplicate suppression against this adapter contract

## Known Limitations

- only browser-source retrieval is covered so far
- authentication and retry behavior are not implemented yet
- scheduling currently relies on local timer-driven polling without distributed coordination
