# Browser Theme Narratives

## Summary

This component generates offline browser-theme memory narratives from raw browser `MemoryEvent` records. It turns repeated same-day browser activity into theme-oriented memory units that MirrorBrain can store and later prefer for `昨天/今天我做了什么？` style recall.

## Responsibility Boundary

- groups browser events into same-day theme units
- normalizes display titles for browser work themes
- compresses repeated URLs into representative source refs
- generates deterministic offline summaries for stored browser theme narratives
- does not fetch browser data, persist artifacts, or answer queries directly

## Key Interfaces

- `generateBrowserThemeNarratives(...)`

## Data Flow

1. Receive raw browser `MemoryEvent` records.
2. Group them by local day and normalized theme title.
3. Detect lightweight narrative intent such as documentation, research, comparison, or debugging.
4. Compress repeated URLs into a small representative source-ref set.
5. Produce a `MemoryNarrative` artifact per browser theme/day.

## Test Strategy

- focused unit coverage in `src/workflows/browser-theme-narratives/index.test.ts`
- retrieval integration coverage through `src/integrations/agent-memory-api/memory-narratives.test.ts`
- service publishing coverage through `src/apps/mirrorbrain-service/memory-narratives.test.ts`

## Known Risks And Limitations

- theme grouping is still heuristic and starts from title normalization rather than page-text embeddings
- narrative summaries are deterministic today; they are structured to stay compatible with a later LLM-backed enrichment pass
- grouping currently works best for repeated same-day browser activity, not long multi-day research threads
