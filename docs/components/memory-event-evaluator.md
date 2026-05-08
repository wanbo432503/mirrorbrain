# Memory Event Evaluation Module

## Overview

This module implements OpenWiki-inspired first-stage assessment for MirrorBrain memory events. It evaluates and filters raw memory events before they enter the clustering pipeline, ensuring only high-quality, worthy events are processed.

**Key Enhancement**: Evaluates URL page content quality to filter out junk pages (error pages, login screens, navigation-only pages, placeholder pages, etc.)

## Design Philosophy

Based on OpenWiki's two-stage knowledge graph construction:

1. **Stage 1 (Assessment)**: Evaluate raw material quality, apply deduplication and filtering
2. **Stage 2 (Compilation)**: Transform filtered material into structured knowledge

This module implements Stage 1, operating on memory events before clustering.

## Evaluation Pipeline

### Step 1: Basic Junk Filtering

Remove obvious noise:

- **Short text**: Shell events with < 20 characters
- **Code/path patterns**: File paths, shell commands, import statements
- **Pure commands**: npm install, git commit, cd, ls, etc.
- **Localhost URLs**: Browser debug URLs (handled differently)
- **URLs without content**: Browser events without URL metadata

### Step 2: Importance Scoring

Calculate importance score (0.0–1.0) based on multiple factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Source type | 0–0.25 | Browser (0.25) > Shell (0.15) |
| Text richness | 0–0.30 | Content length tiered scoring |
| **Page content quality** | **-0.20–0.35** | **Critical new factor: evaluates actual page text** |
| URL + title bonus | 0 or 0.10 | Browser event with both metadata |
| Page role | 0–0.15 | Issue/PR/debug (0.15) > docs (0.12) > repo (0.08) |
| Repeated access | 0–0.10 | Multiple access times suggest sustained interest |

**Page Content Quality Scoring** (NEW):

- **Junk pages (< 100 chars text)**: **-0.20 penalty** → Filtered out
- **Error/login/placeholder pages**: **-0.20 penalty** → Filtered out
- **Normal pages (100-500 chars)**: 0.05-0.10 quality score
- **Rich pages (500-2000 chars)**: 0.18-0.25 quality score
- **Very rich pages (> 2000 chars)**: 0.30 quality score
- **Technical content bonus**: +0.05 for pages with technical patterns (api, function, implementation, architecture, etc.)

**Example scores**:

- GitHub issue page with technical content: ~0.65
- Python API documentation page: ~0.70
- Google search page: ~0.30
- Error page (404): **Filtered out** (penalty score)
- Login page: **Filtered out** (penalty score)
- Loading/placeholder page (< 100 chars): **Filtered out** (penalty score)

### Step 3: Quality Filtering

Filter out browser events with total score < 0.25 (junk pages that got penalty scores).

This ensures low-quality pages are completely removed before deduplication.

### Step 4: Semantic Deduplication

Remove near-duplicate events using N-gram Jaccard similarity:

- **N-gram size**: 3 characters
- **Threshold**: 0.6 similarity
- **Strategy**: Keep higher-scored event when duplicates detected

This catches events with similar content but different URLs/timestamps.

### Step 5: Top-N + Source Balancing

Cap to maximum daily ingestion (50 events) while ensuring fair source representation:

- **Minimum per source**: 30% of slots (if available)
- **Remaining slots**: Highest importance events regardless of source

This prevents one source type from dominating the pipeline.

## Page Content Quality Detection

### Junk Page Patterns (Filtered Out)

The following page types are detected and filtered:

1. **Too-short pages (< 100 chars)**:
   - Loading screens
   - Placeholder content
   - Navigation-only pages
   - Minimal content fragments

2. **Error/placeholder pages**:
   - 404 Not Found
   - Page not found
   - Access denied
   - Unauthorized
   - Something went wrong
   - Oops messages

3. **Auth/login pages**:
   - Sign up / Log in
   - Create account
   - Forgot password
   - Login required

4. **Cookie/consent banners**:
   - Accept cookies
   - Privacy consent (very short, legal-sounding)

### Valuable Content Patterns (Boosted)

Pages containing these technical/informational keywords get a quality bonus:

- API, function, method, class, interface
- Implementation, architecture, design, pattern
- Algorithm, data structure, protocol
- Documentation, tutorial, guide, example
- Code, script, command, configuration
- Setup, install, deploy, build, test
- Debug, fix, issue, bug, feature
- Release, version, update, refactor, optimize

**Detection rule**: At least 2 technical patterns → +0.05 bonus

## Integration with MirrorBrain

### Before: Direct Merge

```typescript
// Old flow: All events → Cache → Clustering
mergeNewEventsToCache(cache, newEvents)
```

### After: Evaluation First

```typescript
// New flow: Events → Evaluation → Quality Filter → Dedup → Cache → Clustering
const { scoredEvents, stats } = evaluateMemoryEventsForIngestion(newEvents);
const filtered = scoredEvents.map(s => s.event);
mergeNewEventsToCache(cache, filtered);
```

Evaluation happens in `updateCacheWithNewEvents` before merging, ensuring only worthy events enter the system.

## Benefits

### Quality Control

- **Noise reduction**: Remove commands, paths, short fragments
- **Page content evaluation**: Filter out error pages, login screens, junk navigation
- **Semantic deduplication**: Catch similar content across different URLs
- **Importance ranking**: Focus on high-value pages (issues, docs, technical content)

### Pipeline Efficiency

- **Reduced load**: Only 50 events/day enter clustering
- **Better clustering**: Higher-quality input produces better candidate memories
- **Resource savings**: Less AI processing for low-value content

### Transparency

- **Evaluation stats**: Track filtered count, quality filtered count, deduped count, final kept count
- **Importance reasons**: Explain why each event was kept
- **Source balance**: Ensure fair representation across browser/shell

## Configuration

Constants can be adjusted in `memory-event-evaluator.ts`:

```typescript
const MIN_TEXT_LENGTH = 20;          // Minimum shell text length
const MIN_PAGE_TEXT_LENGTH = 100;    // Minimum page content length
const MAX_DAILY_INGESTION = 50;      // Maximum events per day
const NGRAM_SIZE = 3;                // N-gram size for similarity
const SIMILARITY_THRESHOLD = 0.6;    // Dedup threshold
const PAGE_QUALITY_THRESHOLD = 0.25; // Minimum score to keep browser events
```

## Example Evaluation

### Input

```typescript
[
  { id: '1', url: 'https://github.com/project/issues/123', title: 'Fix authentication bug', pageText: '...' },
  { id: '2', url: 'https://google.com/search?q=test', title: 'test - Google Search', pageText: '...' },
  { id: '3', url: 'https://example.com/404', title: '404 Not Found', pageText: '404 Not Found' },
  { id: '4', url: 'https://docs.python.org/api', title: 'API Guide', pageText: 'Comprehensive API documentation...' },
  { id: '5', shell, text: 'npm install react' }
]
```

### Output

```typescript
{
  scoredEvents: [
    { event: {...}, importance: 0.65, reasons: ['Primary development activity (issue)'] },
    { event: {...}, importance: 0.70, reasons: ['Contains technical/informational content'] },
    { event: {...}, importance: 0.30, reasons: ['General browsing activity'] }
  ],
  stats: {
    total: 5,
    basicFiltered: 2,    // npm install (command) + example.com/404 (junk page) filtered
    qualityFiltered: 1,   // example.com/404 penalty score → removed
    dedupRemoved: 0,
    finalKept: 3          // GitHub issue + Python docs + Google search
  }
}
```

## Comparison with OpenWiki

| Aspect | OpenWiki | MirrorBrain |
|--------|----------|-------------|
| Content type | Text, URL, Image | Browser events, Shell events |
| Page content evaluation | Text richness + user note | **Page content quality + technical patterns** |
| Importance factors | Type, richness, user note, preference match | Source type, richness, **page quality**, page role, repeated access |
| Junk filtering | Short text, code, paths | **Short text, code, paths, junk pages (error/login/placeholder)** |
| Dedup method | N-gram Jaccard similarity | N-gram Jaccard similarity |
| Balancing | Content type balance (text/url/image) | Source type balance (browser/shell) |
| Max limit | 50 items | 50 events |

## Key Innovation: Page Content Quality Evaluation

This module introduces **URL page content evaluation**, addressing a critical gap:

**Problem**: Browser events often have URL + title, but the actual page content is low-quality (error pages, login screens, navigation-only pages).

**Solution**:
1. Extract page text content (from `pageText`, `text`, or `pageTitle` fields)
2. Apply junk detection patterns (error, login, placeholder, too-short)
3. Apply valuable content detection (technical patterns)
4. Assign quality scores or penalty scores
5. Filter out pages with total score < 0.25

**Impact**: Ensures only substantive, informational pages enter the clustering pipeline, reducing noise and improving knowledge quality.

## Future Improvements

Potential enhancements:

1. **User preference matching**: Boost events matching user's known interests (like OpenWiki)
2. **Page content fetching**: For browser events without `pageText`, fetch full page content asynchronously
3. **Cross-day deduplication**: Prevent similar content from being ingested across multiple days
4. **Adaptive thresholds**: Adjust importance thresholds based on user feedback
5. **Source-specific tuning**: Different evaluation rules for different source types
6. **Machine learning patterns**: Learn valuable/junk page patterns from user review decisions

## Testing

Unit tests cover:

- Basic filtering (short text, commands, paths)
- Importance scoring (issue > search, rich > short)
- **Page content quality evaluation** (junk pages filtered, technical pages boosted)
- Semantic deduplication (similar titles)
- Source balancing (browser/shell quota)
- Evaluation reasons (transparency)

Run tests:

```bash
npm test -- src/modules/memory-events-cache/memory-event-evaluator.test.ts
```

## References

- OpenWiki `content_filter.rs`: First-stage assessment logic
- OpenWiki `wiki_engine.rs`: Content importance scoring
- MirrorBrain `browser-page-content`: Page text extraction
- MirrorBrain `memory-review`: Second-stage clustering logic
- MirrorBrain PRD: Phase 2B focus on memory retrieval quality