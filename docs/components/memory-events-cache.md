# Memory Events Cache

## Summary

The memory events cache is the presentation cache used by the service-backed
Memory tab. It loads raw workspace or OpenViking memory events, applies display
deduplication and browser blacklist filtering, and stores the resulting event
list in `<workspaceDir>/mirrorbrain/cache/memory-events-cache.json`.

## Responsibility Boundary

This component is responsible for:

- loading and saving the local memory-event cache
- initializing the cache from workspace memory-event files before falling back
  to OpenViking reads
- filtering browser events that should not be shown in the Memory tab
- deduplicating repeated browser URL events while preserving access times
- returning paginated and source-filtered event slices for API/UI callers

It is not responsible for source capture, source-ledger parsing, OpenViking
resource writes, candidate-memory generation, knowledge synthesis, or skill
generation.

## Key Interfaces

- `initializeCacheFromOpenViking(...)`
- `updateCacheWithNewEvents(...)`
- `getEventsFromCache(...)`
- `MemoryEventsCache`

## Data Flow

1. Source import or sync writes durable `MemoryEvent` records.
2. The service refreshes or updates the memory-event cache.
3. The cache filters blacklisted browser URLs such as `localhost`,
   `127.0.0.1`, `0.0.0.0`, IPv6 loopback, and Chrome internal pages such as
   `chrome://settings`.
4. Browser events with the same normalized URL are merged into one display
   event, with `accessTimes` and `latestAccessedAt` preserving repeated visits.
5. `GET /memory` reads paginated events from this cache for the Memory tab.

## Failure Modes And Constraints

- If the cache file is missing or corrupt, loading returns `null` so the service
  can rebuild it.
- Filtering is a presentation-cache rule; raw memory-event files remain on disk
  with source attribution intact.
- The blacklist is intentionally conservative and should be extended through
  tests when new low-value browser sources appear.

## Test Strategy

Unit tests live in `src/modules/memory-events-cache/index.test.ts`. They cover
cache loading, initialization, pagination, source filtering, source-ledger
browser URL deduplication, and browser blacklist filtering.
