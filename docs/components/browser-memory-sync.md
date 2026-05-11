# Browser Memory Sync

## Summary

This workflow executes the live browser ingestion loop for Phase 1. It now acts as the browser-specific wrapper around the generic memory-source sync pipeline, wiring the ActivityWatch browser plugin into polling and on-demand sync entrypoints while enriching browser events with shared URL-level page-content references.

## Responsibility Boundary

- owns timer-driven polling for the browser source and the browser-facing sync entrypoint
- wires the ActivityWatch browser source plugin into the generic memory-source sync workflow
- forwards the runtime source authorization policy to the generic memory-source sync workflow
- checks a separate page-content authorization policy before exposing stored page
  text references or fetching readable page text
- groups repeated visits by URL and keeps per-URL access history on persisted browser memory events
- schedules shared page-content backfill after raw browser memory events have already been persisted
- does not own candidate memory review, knowledge generation, or skill generation

## Key Interfaces

- `runBrowserMemorySyncOnce(...)`
- `startBrowserMemorySyncPolling(...)`
- `BrowserPageContentCaptureAuthorizationDependency`

## Data Flow

1. Resolve the ActivityWatch browser bucket to sync, using the explicitly configured bucket when present or auto-discovering the most recently updated `aw-watcher-web*` bucket otherwise.
2. When the resolved bucket exposes a `created` timestamp, use it as the initial browser backfill start so the first sync can import the bucket's retained history.
3. Build an ActivityWatch browser source plugin for the resolved browser bucket.
4. Register that plugin with the generic memory-source sync workflow.
5. Let the generic workflow check authorization before ActivityWatch fetch.
6. Let the generic workflow read the checkpoint, compute the sync plan, and fetch browser events.
7. Normalize events, discard local development pages filtered by the browser source adapter, and suppress near-duplicate browser page records.
8. Group retained browser events by URL.
9. Build URL-level `accessTimes` and `latestAccessedAt` metadata for the retained browser events before persistence.
10. Let the generic workflow check authorization again before persistence.
11. Persist the browser memory events first so large historical backfills can make `/memory` visible quickly.
12. Check page-content authorization separately before adding existing
    `textStorage` references to browser events.
13. In a follow-up background step, check page-content authorization again,
    then either reuse an existing shared page artifact or fetch readable page
    text once per URL and update the page-content artifact in OpenViking.
14. Repeat on the configured polling interval when polling is enabled.

## Test Strategy

- unit tests cover initial sync behavior, incremental sync behavior, duplicate suppression, access-time merging, non-blocking page-content backfill, shared URL artifact reuse, page-content authorization denial, and timer-driven polling
- integration tests cover checkpoint persistence across repeated sync runs

## Known Limitations

- polling uses an in-process timer and does not yet have crash recovery beyond persisted checkpoints
- overlapping timer ticks are skipped instead of queued
- the service layer still exposes a browser-specific trigger even though the underlying sync path is now source-plugin-based
- bucket auto-discovery depends on ActivityWatch bucket `last_updated` metadata being present and comparable across browser watcher buckets
- page-text extraction is currently heuristic and does not use a dedicated readability library
- background page-content backfill is best-effort and can lag behind raw browser memory visibility during large imports
- page-content backfill is not scheduled when the generic sync workflow rejects the source before fetch
- page-content authorization currently decides at URL level through an injected
  dependency; durable domain/path allowlists and visible UI state belong to a
  later authorization-management slice
