# Shell Memory Sync

## Summary

This workflow connects the shell-history source plugin to MirrorBrain's generic memory-source sync pipeline so shell commands can be persisted into the QMD workspace as authorized memory events.

## Responsibility Boundary

This workflow is responsible for:

- choosing the shell-history source key for an authorized history path
- forwarding runtime source authorization policy to the generic sync workflow
- reading and updating sync checkpoints
- fetching shell-history entries for the active sync window
- normalizing and persisting shell memory events

This workflow is not responsible for:

- generating shell problem narratives
- ranking shell memories for retrieval
- broad shell-environment discovery or authorization UX

## Key Interfaces

- `runShellMemorySyncOnce(...)`
- `createShellHistoryMemorySourcePlugin(...)`
- `runMemorySourceSyncOnce(...)`

## Control Flow

1. The workflow resolves the source key from the authorized history path.
2. The generic sync workflow checks authorization for `scopeId`, `sourceKey`, and source category `shell`.
3. It loads the last checkpoint if one exists.
4. It creates an initial-backfill or incremental sync plan.
5. It reads shell-history entries within the plan window.
6. It normalizes and persists each entry as a shell memory event.
7. It advances the checkpoint to the newest imported timestamp or the current sync time.

## Test Strategy

- focused workflow coverage in [src/workflows/shell-memory-sync/index.test.ts](/Users/wanbo/Workspace/mirrorbrain/src/workflows/shell-memory-sync/index.test.ts)
- broader sync pipeline behavior remains covered in [src/workflows/memory-source-sync/index.test.ts](/Users/wanbo/Workspace/mirrorbrain/src/workflows/memory-source-sync/index.test.ts)

## Failure Modes And Limitations

- authorization enforcement is injectable and currently category-level; durable path-level authorization remains future work
- it currently imports command history only, without output or cwd context
- it does not yet schedule polling or expose a dedicated runtime entrypoint
