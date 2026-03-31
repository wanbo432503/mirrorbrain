# Browser Memory Sync

## Summary

This workflow executes the live browser ingestion loop for Phase 1. It decides whether to run an initial backfill or incremental sync, fetches ActivityWatch browser events, normalizes them into `MemoryEvent` records, persists them, and commits the resulting checkpoint.

## Responsibility Boundary

- owns one-shot browser sync execution and timer-driven polling
- coordinates between ActivityWatch, memory capture, OpenViking persistence, and checkpoint persistence
- does not own candidate memory review, knowledge generation, or skill generation

## Key Interfaces

- `runBrowserMemorySyncOnce(...)`
- `startBrowserMemorySyncPolling(...)`

## Data Flow

1. Read the last checkpoint for the browser source key.
2. Build an initial backfill or incremental sync window.
3. Fetch ActivityWatch browser events for that window.
4. Normalize each event into a `MemoryEvent`.
5. Persist each normalized event through the configured writer.
6. Advance the checkpoint to the latest observed sync boundary.
7. Repeat on the configured polling interval when polling is enabled.

## Test Strategy

- unit tests cover initial sync behavior, incremental sync behavior, and timer-driven polling
- integration tests cover checkpoint persistence across repeated sync runs

## Known Limitations

- polling uses an in-process timer and does not yet have crash recovery beyond persisted checkpoints
- overlapping timer ticks are skipped instead of queued
