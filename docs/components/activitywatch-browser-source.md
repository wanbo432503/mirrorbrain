# ActivityWatch Browser Source

## Summary

This component adapts browser activity coming from `ActivityWatch`, with `aw-watcher-web` as the initial capture mechanism. It covers sync planning, HTTP event retrieval, the legacy browser source plugin used by the generic memory-source sync workflow, and the Phase 4 browser ledger bridge that converts ActivityWatch events into browser ledger payloads.

## Responsibility Boundary

- owns sync planning for browser event import
- exposes a browser source plugin with source-specific normalization, local-page filtering, and deduplication rules
- exposes an ActivityWatch-to-browser-ledger capture bridge for Phase 4 recorders
- stores browser-ledger capture checkpoints separately from direct browser-memory sync checkpoints
- treats `ActivityWatch` as an upstream source only
- does not own long-term storage, review state, or downstream artifact generation

## Key Interfaces

- `createInitialBrowserSyncPlan(...)`
- `createIncrementalBrowserSyncPlan(...)`
- `getBrowserSyncSchedule(...)`
- `fetchActivityWatchBrowserEvents(...)`
- `createActivityWatchBrowserMemorySourcePlugin(...)`
- `captureActivityWatchBrowserLedgerRecords(...)`
- `getActivityWatchBrowserLedgerSourceKey(...)`
- `runBrowserMemorySyncOnce(...)` consumes this plugin through the generic source-sync workflow

## Data Flow

1. MirrorBrain reads config for backfill window and polling interval.
2. The adapter builds a controlled initial backfill request or an incremental request from checkpoint state.
3. When ActivityWatch bucket metadata includes `created`, the first browser sync prefers that timestamp so MirrorBrain can backfill the whole authorized bucket history instead of truncating to the last 24 hours.
4. The adapter fetches browser events from the ActivityWatch HTTP API.
5. The source plugin normalizes browser events, filters local development pages such as `localhost`, `*.localhost`, `127.x.x.x`, `0.0.0.0`, and `::1`, and suppresses near-duplicate page records that repeat the same page signature within a short time window before persistence.
6. The browser sync workflow attaches URL-level access history to sanitized events before persistence.
7. Shared page-text backfill happens after the raw browser memory events have already been persisted.
8. The generic source-sync workflow persists the raw browser events and advances the checkpoint store.

## Phase 4 Ledger Bridge

The Phase 4 runtime recorder uses `captureActivityWatchBrowserLedgerRecords(...)`
for the default browser source. The manual Source Import path also calls this
bridge before running the ledger importer so the Web UI can pull the latest
ActivityWatch browser events into `browser.jsonl` on demand. The bridge:

1. Uses the same initial-backfill and incremental planning rules as the browser
   memory source.
2. Fetches ActivityWatch events from the configured browser bucket.
3. Converts each event into a browser ledger record payload:
   `id`, `title`, `url`, and `page_content`.
4. Advances a checkpoint under
   `activitywatch-browser-ledger:<bucket-id>` so later recorder ticks fetch only
   new browser activity.

ActivityWatch itself only provides page title and URL. Until a richer browser
content recorder is added, `page_content` is a conservative text projection of
the title and URL. The downstream source-ledger importer still receives a valid
`browser` ledger entry and can normalize it into a source-attributed
`MemoryEvent` with `contentKind = "browser-page"`.

## Operational Note

For the local MVP environment and required browser extension setup, see the repository [README](../../README.md).

## Test Strategy

- unit tests cover initial backfill range calculation
- unit tests cover incremental checkpoint usage
- unit tests cover configurable polling schedule behavior
- unit tests cover ActivityWatch HTTP request construction and response parsing
- service tests cover the default runtime bridge from ActivityWatch browser
  events into browser ledger records
- unit tests cover local browser page filtering before memory-event persistence
- workflow tests cover initial backfill, incremental checkpoint usage, and duplicate suppression against this adapter contract

## Known Limitations

- only browser-source retrieval is covered so far
- authentication and retry behavior are not implemented yet
- scheduling currently relies on local timer-driven polling without distributed coordination
