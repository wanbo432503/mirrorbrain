# Browser Memory Sync

## Summary

This workflow executes the live browser ingestion loop for Phase 1. It now acts as the browser-specific wrapper around the generic memory-source sync pipeline, wiring the ActivityWatch browser plugin into polling and on-demand sync entrypoints while enriching browser events with fetched page text.

## Responsibility Boundary

- owns timer-driven polling for the browser source and the browser-facing sync entrypoint
- wires the ActivityWatch browser source plugin into the generic memory-source sync workflow
- enriches browser events with fetched readable page text plus local/OpenViking references
- does not own candidate memory review, knowledge generation, or skill generation

## Key Interfaces

- `runBrowserMemorySyncOnce(...)`
- `startBrowserMemorySyncPolling(...)`

## Data Flow

1. Resolve the ActivityWatch browser bucket to sync, using the explicitly configured bucket when present or auto-discovering the most recently updated `aw-watcher-web*` bucket otherwise.
2. Build an ActivityWatch browser source plugin for the resolved browser bucket.
3. Register that plugin with the generic memory-source sync workflow.
4. Let the generic workflow read the checkpoint, compute the sync plan, and fetch browser events.
5. Normalize events, suppress near-duplicate browser page records, and fetch readable page text for each retained browser URL.
6. Persist the fetched page text locally and import it into OpenViking for indexing.
7. Persist the enriched browser memory events and return the imported-event summary.
8. Repeat on the configured polling interval when polling is enabled.

## Test Strategy

- unit tests cover initial sync behavior, incremental sync behavior, duplicate suppression, page-text enrichment, and timer-driven polling
- integration tests cover checkpoint persistence across repeated sync runs

## Known Limitations

- polling uses an in-process timer and does not yet have crash recovery beyond persisted checkpoints
- overlapping timer ticks are skipped instead of queued
- the service layer still exposes a browser-specific trigger even though the underlying sync path is now source-plugin-based
- bucket auto-discovery depends on ActivityWatch bucket `last_updated` metadata being present and comparable across browser watcher buckets
- page-text extraction is currently heuristic and does not use a dedicated readability library
