# Memory Capture

## Summary

This component defines the normalized `MemoryEvent` boundary for MirrorBrain ingestion. In Phase 1 it still normalizes authorized ActivityWatch browser events, but it now also exposes the source-plugin registry and deduplication helpers used to expand memory ingestion beyond the browser source.

## Responsibility Boundary

This component is responsible for:

- converting upstream browser events into MirrorBrain-owned `MemoryEvent` records
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

- `normalizeActivityWatchBrowserEvent(...)`
- `createMemorySourceRegistry(...)`
- `deduplicateMemoryEvents(...)`
- `persistMemoryEvent(...)`

## Data Flow

1. A source workflow resolves a registered plugin from the source registry.
2. The plugin fetches upstream events and normalizes them into MirrorBrain `MemoryEvent` values.
3. The workflow applies source-specific deduplication before persistence when the plugin defines it.
4. The normalized event is wrapped for OpenViking-compatible persistence and written through the injected writer.

## Test Strategy

- unit coverage in `src/modules/memory-capture/index.test.ts`
- broader sync coverage in `src/workflows/memory-source-sync/index.test.ts` and `tests/integration/browser-memory-sync.test.ts`

## Known Risks Or Limitations

- the current implementation only ships one concrete source plugin, for ActivityWatch browser events
- persistence depends on the configured writer and does not retry failed writes itself
