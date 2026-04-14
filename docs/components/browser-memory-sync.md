# Browser Memory Sync

## Summary

This workflow executes the live browser ingestion loop for Phase 1. It now acts as the browser-specific wrapper around the generic memory-source sync pipeline, wiring the ActivityWatch browser plugin into polling and on-demand sync entrypoints while enriching browser events with shared URL-level page-content references.

## Responsibility Boundary

- owns timer-driven polling for the browser source and the browser-facing sync entrypoint
- wires the ActivityWatch browser source plugin into the generic memory-source sync workflow
- groups repeated visits by URL and enriches browser events with shared page-content references
- does not own candidate memory review, knowledge generation, or skill generation

## Key Interfaces

- `runBrowserMemorySyncOnce(...)`
- `startBrowserMemorySyncPolling(...)`

## Data Flow

1. Resolve the ActivityWatch browser bucket to sync, using the explicitly configured bucket when present or auto-discovering the most recently updated `aw-watcher-web*` bucket otherwise.
2. When the resolved bucket exposes a `created` timestamp, use it as the initial browser backfill start so the first sync can import the bucket's retained history.
3. Build an ActivityWatch browser source plugin for the resolved browser bucket.
4. Register that plugin with the generic memory-source sync workflow.
5. Let the generic workflow read the checkpoint, compute the sync plan, and fetch browser events.
6. Normalize events and suppress near-duplicate browser page records.
7. Group retained browser events by URL.
8. For each URL, either load the existing shared page artifact or fetch readable page text once and create it.
9. Update the URL artifact `accessTimes` list, persist it locally, and import it into OpenViking for indexing.
10. Persist the enriched browser memory events and return the imported-event summary.
11. Repeat on the configured polling interval when polling is enabled.

## Test Strategy

- unit tests cover initial sync behavior, incremental sync behavior, duplicate suppression, shared URL artifact reuse, access-time merging, and timer-driven polling
- integration tests cover checkpoint persistence across repeated sync runs

## Known Limitations

- polling uses an in-process timer and does not yet have crash recovery beyond persisted checkpoints
- overlapping timer ticks are skipped instead of queued
- the service layer still exposes a browser-specific trigger even though the underlying sync path is now source-plugin-based
- bucket auto-discovery depends on ActivityWatch bucket `last_updated` metadata being present and comparable across browser watcher buckets
- page-text extraction is currently heuristic and does not use a dedicated readability library
