# File Sync Checkpoint Store

## Summary

This component persists source-specific sync checkpoints for MirrorBrain's polling workflows. In Phase 1 it uses the local workspace filesystem to keep operational state for browser ingestion runs.

## Responsibility Boundary

- stores and retrieves checkpoint state for sync workflows
- isolates filename generation and file layout for checkpoint persistence
- does not store MemoryEvent artifacts, knowledge artifacts, or skills

## Key Interfaces

- `createFileSyncCheckpointStore(...)`
- `getSyncCheckpointPath(...)`
- `SyncCheckpoint`

## Data Flow

1. A sync workflow derives a source key such as `activitywatch-browser:<bucketId>`.
2. The checkpoint store reads the last saved checkpoint before a sync run.
3. After a successful run, the workflow writes the new checkpoint back to disk.

## Test Strategy

- unit tests cover missing checkpoint reads
- unit tests cover checkpoint write/read roundtrips
- integration coverage verifies that a checkpoint written by one browser sync run is used by the next run

## Known Limitations

- checkpoints are local operational state rather than QMD-indexed artifacts
- there is no file locking yet for multi-process writers
