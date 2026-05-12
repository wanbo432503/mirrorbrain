# Memory Capture

## Summary

This component defines the normalized `MemoryEvent` boundary and generic source-plugin registry for MirrorBrain ingestion. Concrete source plugins now live in integrations, including ActivityWatch browser events and configured shell history files.

## Responsibility Boundary

This component is responsible for:

- defining the source-plugin contract used by browser and shell source adapters
- converting upstream source events into MirrorBrain-owned `MemoryEvent` records
- registering source plugins behind a stable registry lookup by source key
- providing source-specific pre-persistence deduplication helpers
- attaching source attribution and checkpoint metadata
- allowing source-specific enrichment to extend normalized events before final persistence
- forwarding normalized events to persistence through the configured writer

This component is not responsible for:

- fetching ActivityWatch events from HTTP
- deciding whether a source is authorized
- candidate creation or review-state transitions

## Key Interfaces

- `createMemorySourceRegistry(...)`
- `MemorySourceSyncPlan`
- `MemorySourcePlugin`
- `MemorySourceRegistry`
- `normalizeActivityWatchBrowserEvent(...)`
- `deduplicateMemoryEvents(...)`
- `persistMemoryEvent(...)`

## Data Flow

1. A source workflow resolves a registered plugin from the source registry.
2. The plugin fetches upstream events and normalizes them into MirrorBrain `MemoryEvent` values.
3. The workflow applies source-specific deduplication before persistence when the plugin defines it.
4. The normalized event is wrapped for OpenViking-compatible persistence and written through the injected writer.

## Test Strategy

- unit coverage in `src/modules/memory-capture/index.test.ts`
- broader sync coverage in `src/workflows/memory-source-sync/index.test.ts`, `src/workflows/browser-memory-sync/index.test.ts`, `src/workflows/shell-memory-sync/index.test.ts`, and `tests/integration/browser-memory-sync.test.ts`

## Known Risks Or Limitations

- this module still owns the legacy ActivityWatch browser event normalizer while
  newer concrete source plugins are implemented in source-specific integrations
- persistence depends on the configured writer and does not retry failed writes itself
