# AccessTimes and Candidate Generation Consistency Design

## Summary

This design document addresses the consistency between future memory storage model evolution (URL deduplication with `accessTimes` history) and current review candidate generation logic. The goal is to ensure candidate generation remains correct and efficient as the underlying memory storage model evolves from raw events to deduplicated URL-based memory items.

## Problem Context

### Current Memory Model

- **Storage**: Each browser visit creates a separate `MemoryEvent` with:
  - `id`: unique event identifier
  - `timestamp`: visit timestamp
  - `content.url`: visited URL
  - `content.title`: page title
  - `content.pageTitle`: optional page content title
  - `content.pageText`: optional captured page text

- **Candidate Generation**: `createCandidateMemories()` processes raw `MemoryEvent[]`:
  - Groups events by semantic similarity (tokens, host, time)
  - Each candidate includes `memoryEventIds` array referencing raw events
  - Each candidate's `timeRange` is calculated from first/last raw event timestamps
  - Each candidate's `sourceRefs` preserves individual event metadata

### Future Memory Model Evolution

- **URL Deduplication**: Retrieval layer already compresses repeated URL visits into:
  - Single memory item per unique URL
  - `accessTimes` array preserving all visit timestamps
  - Most recent timestamp as display timestamp
  - Deduplication happens at display/retrieval, not at storage

- **Storage Transition**: Future storage model may:
  - Store deduplicated URL-based memory items directly
  - Each item includes `accessTimes` array instead of separate raw events
  - Raw events may become historical artifacts or be consolidated

### Candidate Generation Challenge

Current candidate generation assumes:
1. Raw events are the primary storage unit
2. Each event has a single timestamp
3. Event count and event IDs are stable references

Future model changes could affect:
1. Should candidates reference deduplicated URL items or raw events?
2. How should `timeRange` be calculated from `accessTimes`?
3. How should `durationMinutes` account for repeated visits?
4. How should `sourceRefs` represent URL-level vs event-level provenance?

## Design Goals

1. **Backward Compatibility**: Candidate generation should work with current raw-event storage
2. **Forward Compatibility**: Candidate generation should gracefully transition to deduplicated storage
3. **Provenance Preservation**: URL-level deduplication should not hide visit-level provenance
4. **Duration Accuracy**: Repeated visits to same URL should not distort task duration
5. **Review Correctness**: Candidates should still represent coherent work tasks, not URL buckets

## Proposed Solution: Hybrid Event/URL Model

### Core Design Principle

Candidate generation should operate on **normalized memory items** that:
- Abstract away whether the underlying storage is raw events or deduplicated URLs
- Preserve both URL-level and visit-level metadata
- Allow candidate logic to remain stable across storage evolution

### Normalized Memory Item Interface

Introduce an intermediate memory-item abstraction for candidate generation:

```typescript
interface NormalizedMemoryItem {
  // Unique identifier (URL-level or event-level depending on storage)
  id: string;
  
  // URL and page metadata
  url: string;
  title?: string;
  pageTitle?: string;
  pageText?: string;
  host: string;
  
  // Time information preserving all visits
  firstVisitTime: string;          // Earliest access timestamp
  lastVisitTime: string;           // Most recent access timestamp
  accessTimes: string[];           // All visit timestamps in chronological order
  
  // Role and contribution classification
  role: 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'web';
  
  // Provenance references
  sourceEventIds: string[];        // All raw event IDs that contributed to this URL item
  
  // Source attribution
  sourceType: string;
}
```

### Conversion Layer

Add a normalization function that converts storage-layer data to normalized items:

```typescript
// Current: Convert raw events to normalized items
function normalizeRawEvents(events: MemoryEvent[]): NormalizedMemoryItem[] {
  const urlGroups = new Map<string, MemoryEvent[]>();
  
  for (const event of events) {
    const url = event.content.url;
    if (!url) continue;
    
    const group = urlGroups.get(url) ?? [];
    group.push(event);
    urlGroups.set(url, group);
  }
  
  return Array.from(urlGroups.entries()).map(([url, events]) => {
    const timestamps = events.map(e => e.timestamp).sort();
    const representative = events[events.length - 1]; // Use most recent for metadata
    
    return {
      id: `normalized-url:${url}`,
      url,
      title: representative.content.title,
      pageTitle: representative.content.pageTitle,
      pageText: representative.content.pageText,
      host: getEventHost(url),
      firstVisitTime: timestamps[0],
      lastVisitTime: timestamps[timestamps.length - 1],
      accessTimes: timestamps,
      role: inferPageRole({ url, title: representative.content.title }),
      sourceEventIds: events.map(e => e.id),
      sourceType: representative.sourceType,
    };
  });
}

// Future: Convert deduplicated storage items to normalized items
function normalizeDeduplicatedItems(items: DeduplicatedMemoryItem[]): NormalizedMemoryItem[] {
  return items.map(item => ({
    id: item.id,
    url: item.url,
    title: item.title,
    pageTitle: item.pageTitle,
    pageText: item.pageText,
    host: getEventHost(item.url),
    firstVisitTime: item.accessTimes[0],
    lastVisitTime: item.accessTimes[item.accessTimes.length - 1],
    accessTimes: item.accessTimes,
    role: inferPageRole({ url: item.url, title: item.title }),
    sourceEventIds: item.sourceEventIds ?? [], // May be empty if storage consolidated
    sourceType: item.sourceType,
  }));
}
```

### Candidate Generation Changes

Update candidate generation to use normalized items:

1. **Input Change**: Accept `NormalizedMemoryItem[]` instead of `MemoryEvent[]`
2. **Grouping Logic**: Group by normalized item metadata instead of raw events
3. **TimeRange Calculation**: Use `firstVisitTime` and `lastVisitTime` from earliest and latest items in group
4. **Duration Calculation**: Consider visit gaps from `accessTimes` to avoid inflating duration from repeated visits
5. **SourceRefs**: Preserve both URL-level refs and visit-level provenance

```typescript
function createCandidateMemories(input: {
  reviewDate: string;
  normalizedMemoryItems: NormalizedMemoryItem[];
}): CandidateMemory[] {
  
  // Group normalized items by task similarity
  const groups = groupNormalizedItemsByTask(input.normalizedMemoryItems);
  
  return groups.map(group => {
    // Calculate time range from all item access times
    const allTimestamps = group.items.flatMap(item => item.accessTimes).sort();
    const timeRange = {
      startAt: allTimestamps[0],
      endAt: allTimestamps[allTimestamps.length - 1],
    };
    
    // Calculate true duration accounting for visit gaps
    const durationMinutes = calculateTaskDuration(allTimestamps);
    
    // Build source refs preserving both URL and event provenance
    const sourceRefs = group.items.map(item => ({
      id: item.id,                    // URL-level reference
      url: item.url,
      title: item.title,
      role: item.role,
      contribution: inferSourceContribution(item, group),
      visitCount: item.accessTimes.length,
      sourceEventIds: item.sourceEventIds,  // Visit-level provenance
      sourceType: item.sourceType,
      timestamp: item.lastVisitTime,        // Display timestamp
    }));
    
    return {
      id: `candidate:${input.reviewDate}:${group.key}`,
      memoryEventIds: group.items.flatMap(item => item.sourceEventIds),  // Preserve raw event IDs
      sourceRefs,
      title: group.title,
      summary: createCandidateSummary(group, durationMinutes),
      theme: group.theme,
      formationReasons: group.reasons,
      timeRange,
      reviewDate: input.reviewDate,
      reviewState: 'pending',
    };
  });
}

function calculateTaskDuration(timestamps: string[]): number {
  // Calculate actual working time, not inflated by repeated visits
  // Consider gaps between visits as break time if gap > threshold
  const thresholdMinutes = 5;  // Gap threshold
  
  let totalMinutes = 0;
  for (let i = 0; i < timestamps.length - 1; i++) {
    const current = new Date(timestamps[i]);
    const next = new Date(timestamps[i + 1]);
    const gapMinutes = (next.getTime() - current.getTime()) / 60000;
    
    // Only count continuous work, not long gaps
    if (gapMinutes <= thresholdMinutes) {
      totalMinutes += gapMinutes;
    }
  }
  
  return Math.max(1, Math.round(totalMinutes));
}
```

### CandidateMemory Schema Extension

Extend `CandidateMemory` to preserve both URL-level and event-level provenance:

```typescript
export interface CandidateMemory {
  id: string;
  
  // Legacy field - preserve for backward compatibility
  memoryEventIds: string[];
  
  // New: URL-level source references
  sourceRefs: Array<{
    id: string;                     // Normalized item ID
    url: string;
    title?: string;
    role?: string;
    contribution?: 'primary' | 'supporting';
    visitCount: number;             // NEW: Number of visits to this URL
    sourceEventIds: string[];       // NEW: Raw events that contributed
    sourceType: string;
    timestamp: string;              // Display timestamp (last visit)
  }>;
  
  // Standard candidate fields
  title: string;
  summary: string;
  theme: string;
  formationReasons?: string[];
  timeRange: {
    startAt: string;
    endAt: string;
  };
  reviewDate: string;
  reviewState: 'pending';
}
```

## Implementation Phases

### Phase 1: Introduce Normalization Layer (Current Priority)

**Goal**: Add normalization conversion without changing storage or candidate logic yet.

**Files**:
- `src/modules/memory-review/normalize-memory-items.ts` (new)
- `src/modules/memory-review/normalize-memory-items.test.ts` (new)
- `src/modules/memory-review/index.ts` (update to use normalization)

**Steps**:
1. Create `normalizeRawEvents()` function with tests
2. Verify normalized items preserve all raw event metadata
3. Keep candidate generation using raw events internally
4. Document the transition plan

**Acceptance Criteria**:
- Normalization layer tested and documented
- Candidate generation still works with raw events
- Clear documentation of transition path

### Phase 2: Update Candidate Generation (After Phase 1)

**Goal**: Make candidate generation use normalized items.

**Files**:
- `src/modules/memory-review/index.ts` (major update)
- `src/modules/memory-review/index.test.ts` (extend tests)
- `src/shared/types/index.ts` (extend CandidateMemory schema)

**Steps**:
1. Update `createCandidateMemories()` to accept normalized items
2. Update duration calculation to account for visit gaps
3. Extend `sourceRefs` with visit-level provenance
4. Add tests for deduplicated URL scenarios
5. Update integration tests

**Acceptance Criteria**:
- Candidate generation works with normalized items
- Duration calculation accounts for repeated visits
- SourceRefs preserve both URL and event provenance
- All existing tests pass

### Phase 3: Storage Model Transition (Future)

**Goal**: When storage evolves to deduplicated items, candidate generation adapts seamlessly.

**Steps**:
1. Add `normalizeDeduplicatedItems()` function
2. Switch normalization call based on storage model
3. Update persistence layer to handle new schema
4. Verify backward compatibility with historical candidates

**Acceptance Criteria**:
- Candidate generation works with both storage models
- Historical candidates remain readable
- No breaking changes to review workflow

## Migration Path

### For Existing Candidates

- **Read**: Existing candidates use legacy `memoryEventIds`, convert to normalized view
- **Write**: New candidates use extended schema with `visitCount` and `sourceEventIds`
- **Review**: UI adapts to display visit counts for URL-level sources

### For Knowledge Generation

- Knowledge generation already uses `candidateSourceRefs` through `ReviewedMemory`
- Extended `sourceRefs` naturally flows into knowledge drafts
- Knowledge body can show "visited 3 times" context for important URLs

## Non-Goals

- This design does not change the actual storage layer immediately
- This design does not remove raw events from the system
- This design does not force immediate migration of existing candidates
- This design does not change review approval workflow

## Verification Strategy

### Phase 1 Tests

- Verify normalization preserves all event metadata
- Verify normalization produces correct `accessTimes` arrays
- Verify normalization handles edge cases (missing URLs, empty events)

### Phase 2 Tests

- Verify candidate grouping works with normalized items
- Verify duration calculation handles visit gaps correctly
- Verify sourceRefs preserve provenance
- Verify backward compatibility with raw-event input

### Integration Tests

- Verify service contract works with normalized items
- Verify HTTP API schemas handle extended sourceRefs
- Verify review UI displays visit counts correctly

## Open Questions

1. **Visit Gap Threshold**: What's the right threshold to distinguish continuous work from breaks?
   - Current proposal: 5 minutes
   - May need tuning based on real usage patterns

2. **Duration Calculation**: Should we count all time or only continuous time?
   - Current proposal: Only continuous time (gaps <= threshold)
   - Alternative: Total span regardless of gaps
   - Recommendation: Use continuous time for more accurate task duration

3. **Event vs URL Priority**: Should candidates primarily reference URLs or events?
   - Current proposal: URLs as primary refs, events as provenance
   - Alternative: Keep events as primary refs, URLs as metadata
   - Recommendation: URLs as primary for human readability, events for provenance

## Recommendations

**Immediate Next Step**: Implement Phase 1 normalization layer as foundation.

**Priority Reasoning**:
1. Normalization layer creates abstraction boundary
2. Allows candidate logic to evolve independently from storage
3. Provides testing ground for deduplication scenarios
4. Non-breaking addition to existing system

**Timeline Suggestion**:
- Phase 1: ~2-3 days (add normalization, no breaking changes)
- Phase 2: ~3-5 days (update candidate generation, schema extension)
- Phase 3: Later when storage model actually changes

## References

- `docs/components/openviking-store.md` - Current retrieval deduplication behavior
- `docs/plans/2026-04-14-review-candidate-semantic-clustering-plan.md` - Candidate enhancement plan
- `src/modules/memory-review/index.ts` - Current candidate generation implementation
- `src/integrations/openviking-store/index.test.ts` - Deduplication tests