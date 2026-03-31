# Memory Capture

## Summary

This component normalizes authorized ActivityWatch browser events into MirrorBrain `MemoryEvent` records and persists them through the configured OpenViking writer.

## Responsibility Boundary

This component is responsible for:

- converting upstream browser events into MirrorBrain-owned `MemoryEvent` records
- attaching source attribution and checkpoint metadata
- forwarding normalized events to persistence through the configured writer

This component is not responsible for:

- fetching ActivityWatch events from HTTP
- deciding whether a source is authorized
- candidate creation or review-state transitions

## Key Interfaces

- `normalizeActivityWatchBrowserEvent(...)`
- `persistMemoryEvent(...)`

## Data Flow

1. Browser sync logic supplies an authorized ActivityWatch event and scope id.
2. The component converts that event into a normalized `MemoryEvent`.
3. The normalized event is wrapped for OpenViking-compatible persistence and written through the injected writer.

## Test Strategy

- unit coverage in `src/modules/memory-capture/index.test.ts`
- broader sync coverage in `tests/integration/browser-memory-sync.test.ts`

## Known Risks Or Limitations

- the current implementation only handles the initial ActivityWatch browser event shape
- persistence depends on the configured writer and does not retry failed writes itself
