# Browser Page Content

## Summary

This component fetches readable page text for browser memory events, extracts a normalized title plus plain text body, and prepares that content for local storage and OpenViking indexing.

## Responsibility Boundary

- fetches browser page HTML directly over HTTP from the recorded browser URL
- strips scripts, styles, and markup to derive readable plain text
- creates a stable browser-page content artifact tied back to the source `MemoryEvent`
- enriches browser memory events with fetched text plus storage/index references
- does not own browser event polling, authorization policy, or downstream retrieval ranking

## Key Interfaces

- `extractReadableTextFromHtml(...)`
- `fetchBrowserPageContent(...)`
- `createBrowserPageContentArtifact(...)`
- `enrichBrowserMemoryEventWithPageContent(...)`

## Data Flow

1. Browser sync produces a normalized `MemoryEvent` with `url` and `title`.
2. This component fetches the recorded URL over HTTP.
3. HTML is reduced to a readable title and plain-text body.
4. A browser-page artifact is created for the source event.
5. The caller persists that artifact locally and imports it into OpenViking.
6. The source `MemoryEvent` content is enriched with:
   - fetched `text`
   - local `filePath`
   - OpenViking `openVikingUri`
   - `vectorizationSource` metadata indicating OpenViking-backed indexing

## Test Strategy

- unit tests verify HTML title/text extraction
- unit tests verify HTTP fetch and cleaned text output
- browser sync tests verify enriched browser events carry page text and storage references

## Known Limitations

- extraction is heuristic and intentionally simple; it is not a full readability pipeline
- only `http` and `https` URLs are fetched
- failed page fetches currently degrade back to the original browser event instead of failing the full sync
- the enriched event stores full fetched text inline, which can increase memory-event payload size for long pages
