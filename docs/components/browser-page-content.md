# Browser Page Content

## Summary

This component fetches readable page text for browser URLs, extracts a normalized title plus plain text body, and prepares that shared content for local storage and OpenViking indexing.

## Responsibility Boundary

- fetches browser page HTML directly over HTTP from the recorded browser URL
- prefers `article` / `main` regions and strips scripts, styles, and markup to derive readable plain text
- creates a stable browser-page content artifact keyed by URL rather than by individual browser event
- maintains a descending `accessTimes` list plus `latestAccessedAt` for each shared URL artifact
- enriches browser memory events with storage/index references plus shared access-time metadata
- does not own browser event polling, authorization policy, or downstream retrieval ranking

## Key Interfaces

- `extractReadableTextFromHtml(...)`
- `fetchBrowserPageContent(...)`
- `buildBrowserPageContentArtifact(...)`
- `loadBrowserPageContentArtifactFromWorkspace(...)`
- `wasBrowserPageAccessedOnReviewDate(...)`
- `enrichBrowserMemoryEventWithPageContent(...)`

## Data Flow

1. Browser sync produces normalized `MemoryEvent` records with `url` and `title`.
2. The sync groups repeated visits by URL.
3. For a URL not already stored locally, this component fetches the recorded URL over HTTP.
4. HTML is reduced to a readable title and plain-text body, preferring `article` first, then `main`, then a cleaned whole-page fallback.
5. A shared browser-page artifact is created or updated for that URL, with `accessTimes` sorted from newest to oldest.
6. The caller persists that shared artifact locally and imports it into OpenViking once per URL.
7. Each source `MemoryEvent` content is enriched with:
   - local `filePath`
   - OpenViking `openVikingUri`
   - `vectorizationSource` metadata indicating OpenViking-backed indexing
   - `latestAccessedAt`
   - shared `accessTimes`

## Test Strategy

- unit tests verify HTML title/text extraction
- unit tests verify HTTP fetch and cleaned text output
- browser sync tests verify repeated URL visits share one stored page artifact and carry shared access-time metadata

## Known Limitations

- extraction is heuristic and intentionally simple; it prefers `article` / `main` regions but is still not a full readability pipeline
- only `http` and `https` URLs are fetched
- failed page fetches currently degrade back to the original browser event instead of failing the full sync
- the artifact title/text are preserved once per URL; later visits update access times but do not refetch or overwrite stored page text by default
