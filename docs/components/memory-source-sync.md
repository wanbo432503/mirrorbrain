# Memory Source Sync

## Summary

This workflow is MirrorBrain's generic ingestion pipeline for memory sources. It resolves a registered source plugin, computes a sync window from checkpoint state, fetches upstream events, normalizes them into `MemoryEvent` records, applies source-specific sanitization such as deduplication, persists the remaining events, and finally advances the checkpoint.

## Responsibility Boundary

- owns source-agnostic one-shot sync execution
- depends on source plugins for planning, fetch, normalization, and sanitization rules
- persists only already-normalized `MemoryEvent` values
- does not own timer-based polling, review, knowledge generation, or skill generation

## Key Interfaces

- `runMemorySourceSyncOnce(...)`

## Data Flow

1. A caller selects a source key and passes it to the workflow.
2. The workflow resolves that key through the memory source registry.
3. The plugin derives an initial or incremental sync plan from config and checkpoint state.
4. The plugin fetches upstream source events for that plan.
5. The plugin normalizes upstream events into MirrorBrain `MemoryEvent` records.
6. The workflow applies the plugin's sanitization step, which can remove duplicates before persistence.
7. The workflow persists sanitized events and advances the checkpoint to the latest observed sync boundary.

## Test Strategy

- unit coverage in `src/workflows/memory-source-sync/index.test.ts`
- browser-specific coverage through `src/workflows/browser-memory-sync/index.test.ts`

## Known Risks Or Limitations

- Phase 1 still exposes only the browser sync trigger at the service layer
- sanitization is source-defined, so low-quality source plugins can still introduce noisy records
- checkpoint advancement is timestamp-based and assumes source timestamps are trustworthy enough for Phase 1
