# Browser Memory Sync

## Summary

This workflow executes the live browser ingestion loop for Phase 1. It now acts as the browser-specific wrapper around the generic memory-source sync pipeline, wiring the ActivityWatch browser plugin into polling and on-demand sync entrypoints.

## Responsibility Boundary

- owns timer-driven polling for the browser source and the browser-facing sync entrypoint
- wires the ActivityWatch browser source plugin into the generic memory-source sync workflow
- does not own candidate memory review, knowledge generation, or skill generation

## Key Interfaces

- `runBrowserMemorySyncOnce(...)`
- `startBrowserMemorySyncPolling(...)`

## Data Flow

1. Build an ActivityWatch browser source plugin for the configured browser bucket.
2. Register that plugin with the generic memory-source sync workflow.
3. Let the generic workflow read the checkpoint, compute the sync plan, fetch events, normalize them, deduplicate duplicate browser page records, and persist sanitized events.
4. Repeat on the configured polling interval when polling is enabled.

## Test Strategy

- unit tests cover initial sync behavior, incremental sync behavior, duplicate suppression, and timer-driven polling
- integration tests cover checkpoint persistence across repeated sync runs

## Known Limitations

- polling uses an in-process timer and does not yet have crash recovery beyond persisted checkpoints
- overlapping timer ticks are skipped instead of queued
- the service layer still exposes a browser-specific trigger even though the underlying sync path is now source-plugin-based
