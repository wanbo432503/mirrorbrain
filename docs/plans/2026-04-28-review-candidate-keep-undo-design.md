# Review Tab Candidate Selection and Keep Behavior Design

**Date:** 2026-04-28
**Status:** Draft

## Overview

Modify the Review tab UI to support a dual-mode display for candidate selection and keep operations:

1. **Detail View**: Shows full candidate details when clicking a candidate from the main list
2. **Kept Cards View**: Shows a scrollable list of kept candidate summary cards after reviewing candidates with "keep" decision

Key behaviors:
- Kept candidates are removed from the main candidates list
- Kept candidates accumulate in a dedicated "selected candidates" area
- Users can undo keep operations to move candidates back to the main list
- Clicking a new candidate temporarily switches back to detail view
- Undo operations revert the backend review decision (not just UI state)

## User Interaction Flow

### Normal Review Flow
1. User clicks candidate in main list → Detail view shows full candidate information
2. User clicks "Keep" button → Candidate moves to kept cards view, disappears from main list
3. User clicks another candidate → Temporarily switches to detail view for that candidate
4. User clicks "Keep" again → Switches back to kept cards view, new candidate joins the kept list

### Undo Flow
1. User clicks "Undo" button on a kept candidate card → Backend review is reverted
2. Candidate reappears in main candidates list
3. Kept cards view remains active (or switches to detail view if no kept cards remain)

### State Transitions
- **Main candidates list**: Shows unreviewed candidates (filtered to exclude kept ones)
- **Selected candidate area**: Shows either detail view OR kept cards list
- **Kept candidates**: Separate UI state tracked by ID set

## Architecture

### Frontend Components

#### ReviewPanel
- **New state**:
  - `keptCandidateIds: Set<string>` - tracks which candidates have been kept
  - `viewingMode: 'detail' | 'kept-list'` - controls which view is active in selected area

- **New handlers**:
  - `handleKeepCandidate(candidateId)` - calls review API, adds to kept set, switches to kept-list mode
  - `handleUndoKeep(reviewedMemoryId)` - calls undo API, removes from kept set
  - Modified `handleSelectCandidate` - switches viewing mode appropriately

- **Filtering logic**:
  - Main candidates list filtered: `candidates.filter(c => !keptCandidateIds.has(c.id))`

#### SelectedCandidate
- **New props**:
  - `keptCandidates: ReviewedMemory[]` - list of kept candidate data
  - `viewingMode: 'detail' | 'kept-list'` - which rendering mode to use
  - `onUndoKeep: (reviewedMemoryId: string) => void` - undo handler

- **Rendering modes**:
  - `'detail'`: Existing full detail display (unchanged)
  - `'kept-list'`: New scrollable list of kept candidate summary cards

#### Kept Candidate Cards
- Compact summary cards similar to CandidateCard but with:
  - Green "kept" badge
  - Title, duration, source count (condensed)
  - "Undo" button (no keep/discard buttons)

### Frontend State Management

#### useReviewWorkflow Hook
- **New function**:
  ```typescript
  async undoCandidateReview(reviewedMemoryId: string): Promise<void>
  ```
- Calls `api.undoCandidateReview(reviewedMemoryId)`
- Dispatches `REMOVE_REVIEWED_MEMORY` action to remove from global state

#### MirrorBrainContext
- **New action**:
  ```typescript
  { type: 'REMOVE_REVIEWED_MEMORY', payload: reviewedMemoryId: string }
  ```
- Removes reviewed memory from `state.reviewedMemories` array

#### API Client
- **New method**:
  ```typescript
  undoCandidateReview(reviewedMemoryId: string): Promise<void>
  ```
- HTTP call: `DELETE /reviewed-memories/:id`

### Backend API

#### HTTP Server Endpoint
```
DELETE /reviewed-memories/:id
```

- **Request**: reviewed memory ID in path parameter
- **Response**: 204 No Content
- **Behavior**: Deletes the reviewed memory JSON file from workspace storage

#### Service Interface
```typescript
undoCandidateReview(reviewedMemoryId: string): Promise<void>
```

#### Service Implementation
Located in `createMirrorBrainService` function:

1. Delete reviewed memory file:
   ```typescript
   const reviewedFilePath = join(
     workspaceDir,
     'mirrorbrain',
     'reviewed-memories',
     `${reviewedMemoryId}.json`
   );
   await unlink(reviewedFilePath);
   ```

2. Candidate automatically reappears:
   - Candidate file still exists in `mirrorbrain/candidate-memories/`
   - Candidate `reviewState` remains `'pending'` (never changed)
   - Listing candidates by date includes it again

## Data Flow

### Keep Operation
```mermaid
sequenceDiagram
    User>>ReviewPanel: Click Keep
    ReviewPanel>>useReviewWorkflow: reviewCandidateMemory('keep')
    useReviewWorkflow>>Backend: POST /reviewed-memories
    Backend>>Storage: Write reviewed memory JSON
    Backend>>ReviewPanel: Return ReviewedMemory
    ReviewPanel>>ReviewPanel: Add candidateId to keptCandidateIds
    ReviewPanel>>ReviewPanel: Set viewingMode = 'kept-list'
    ReviewPanel>>UI: Show kept cards view
```

### Undo Operation
```mermaid
sequenceDiagram
    User>>ReviewPanel: Click Undo
    ReviewPanel>>useReviewWorkflow: undoCandidateReview(id)
    useReviewWorkflow>>Backend: DELETE /reviewed-memories/:id
    Backend>>Storage: Delete reviewed memory JSON
    Backend>>ReviewPanel: Success
    ReviewPanel>>ReviewPanel: Remove from keptCandidateIds
    ReviewPanel>>MirrorBrainContext: REMOVE_REVIEWED_MEMORY
    ReviewPanel>>UI: Candidate reappears in main list
```

## Error Handling

### Backend Errors
- **File not found**: If reviewed memory file doesn't exist, return 404
- **Permission errors**: Return 500 with descriptive error message
- **Invalid ID**: Return 400 if ID format is malformed

### Frontend Error Handling
- Display error feedback banner (existing mechanism)
- Keep UI state consistent even if backend call fails
- Don't remove from `keptCandidateIds` until backend confirms success

### Edge Cases
- **Empty kept list**: If all kept candidates are undone, switch back to detail view
- **Concurrent operations**: Disable buttons during async operations (existing loading states)
- **Missing candidate data**: Handle gracefully if candidate disappears from storage

## Testing Strategy

### Backend Tests
- **Unit tests** for `undoCandidateReview` service function
- **HTTP endpoint tests** for `DELETE /reviewed-memories/:id`
- **Integration tests**: Keep → Undo → Verify candidate reappears

### Frontend Tests

#### Component Tests
- **SelectedCandidate.test.tsx**: Test dual rendering modes
- **KeptCandidateCard** (new component): Test undo button behavior
- **ReviewPanel.test.tsx**: Test mode switching logic

#### Integration Tests
- **review-to-artifacts.test.ts**: Add undo workflow scenarios
- Test sequence: create candidates → keep → undo → verify candidate back in list

#### State Management Tests
- **useReviewWorkflow**: Test `undoCandidateReview` function
- **MirrorBrainContext.test.tsx**: Test `REMOVE_REVIEWED_MEMORY` action

### Test Scenarios
1. Keep single candidate → verify in kept list → undo → verify back in main list
2. Keep multiple candidates → verify accumulation → undo each one
3. Keep candidates → click new candidate → verify detail view → keep → verify kept list
4. Keep candidates → undo all → verify empty kept list behavior
5. Error scenarios: undo non-existent reviewed memory

## Implementation Steps

### Phase 1: Backend
1. Add `undoCandidateReview` to service interface
2. Implement service function (delete reviewed memory file)
3. Add HTTP endpoint `DELETE /reviewed-memories/:id`
4. Write backend tests

### Phase 2: Frontend State
1. Add `undoCandidateReview` to API client
2. Update `useReviewWorkflow` hook
3. Add `REMOVE_REVIEWED_MEMORY` action to context
4. Write state management tests

### Phase 3: UI Components
1. Create KeptCandidateCard component
2. Modify SelectedCandidate to support dual modes
3. Update ReviewPanel with new state and handlers
4. Write component tests

### Phase 4: Integration
1. End-to-end testing of full workflow
2. Update existing tests to account for new behavior
3. Manual testing in development environment

## Success Criteria

1. ✅ Kept candidates disappear from main list immediately
2. ✅ Kept candidates appear in scrollable list in selected area
3. ✅ Multiple kept candidates accumulate correctly
4. ✅ Undo moves candidate back to main list
5. ✅ Undo actually reverts backend review decision
6. ✅ Clicking new candidate switches to detail view temporarily
7. ✅ All tests pass (backend, frontend, integration)
8. ✅ No regressions in existing review functionality

## Risks and Considerations

### Data Integrity
- Reviewed memory deletion is irreversible (no version history)
- Consider: Should we add a "deleted" flag instead of removing file?
- Current approach: Simple deletion matches discard behavior

### User Experience
- Mode switching might feel jarring initially
- Consider: Add transition animation between views
- Current approach: Immediate switching for clarity

### Performance
- Kept candidates stored in Set for fast filtering
- No performance concern for typical daily review (≤10 candidates)

### Future Enhancements
- Batch undo operations (undo multiple kept candidates)
- Keyboard shortcuts for keep/undo operations
- Drag-and-drop to reorder kept candidates
- Persist kept list across page refreshes (localStorage)