# Candidate Review Flow Implementation

## Implementation Summary

This document describes the implementation of the candidate review workflow that connects the Review tab's candidates to the Artifacts tab's knowledge and skill generation.

## Requirements (from Chinese description)

在前端界面中，review tab下的 candidates 栏目中，会生成不超过 10 个的 candidates，这些 candidates 将用于artifacts tab 中的 knowledge 和 skill generated的 source context。

1）当选中 candidate 卡片，并点击 keep 按钮时，将在 artifacts 中的 generate knowledge 和 generate skill 的 source context 中呈现，这些 source context 将作为 knowledge draft 和 skill draft 的生成的数据来源；

2）当选中 candidate 卡片，并点击 discard 按钮时，将在 candidates 栏目中永久删除该 candidate 卡片，并在持久化存储的后端也删除该卡片，不会再加载。

## Implementation

### Global State Management

**Added to MirrorBrainContext**:
- `reviewedMemories: ReviewedMemory[]` - stores all reviewed memories (both keep and discard decisions)
- New reducer actions:
  - `ADD_REVIEWED_MEMORY` - adds a reviewed memory to global state
  - `REMOVE_CANDIDATE` - removes a candidate from the candidates list

### Review Workflow (ReviewPanel → useReviewWorkflow)

**Keep Button Flow**:
1. User clicks "Keep" button on candidate card
2. `reviewCandidateMemory('keep')` called in useReviewWorkflow
3. Backend creates `ReviewedMemory` with `decision='keep'` and persists it
4. Frontend dispatches `ADD_REVIEWED_MEMORY` action to add to global state
5. Candidate remains in candidates list (for reference)
6. Reviewed memory becomes available in ArtifactsPanel

**Discard Button Flow**:
1. User clicks "Discard" button on candidate card
2. `reviewCandidateMemory('discard')` called in useReviewWorkflow
3. Backend creates `ReviewedMemory` with `decision='discard'` and persists it
4. Frontend dispatches:
   - `ADD_REVIEWED_MEMORY` action (records discard decision)
   - `REMOVE_CANDIDATE` action (removes from UI candidates list)
5. Candidate card permanently removed from candidates display
6. Discard decision recorded but NOT shown in ArtifactsPanel

### Artifacts Generation (ArtifactsPanel)

**Source Context Display**:
- ArtifactsPanel reads from `state.reviewedMemories`
- Filters to show only `decision='keep'` memories
- These become the `reviewedMemories` prop for KnowledgeGenerator and SkillGenerator
- Displayed in CandidateContext component as "Source Context"
- Used as data source for generating knowledge drafts and skill drafts

### Backend Behavior

**Important Note**: The backend does NOT automatically delete candidates when discarded.
- Backend persists the `ReviewedMemory` record with `decision='discard'`
- Candidate remains in backend storage (for audit trail)
- Frontend removes candidate from UI state (no longer shown in candidates list)
- If candidates are regenerated for the same date, discarded candidates will not reappear because they already have a review record

## Test Coverage

### Tests Added

**MirrorBrainContext.test.tsx**:
- `adds a reviewed memory to the reviewedMemories array`
- `removes a candidate from candidateMemories array`
- `does not remove other candidates when removing one`

**review-to-artifacts.test.ts** (Integration):
- `keeps a candidate and makes it available in artifacts`
- `discards a candidate and removes it from UI`

All tests verify:
- State transitions are correct
- Kept memories appear in artifacts
- Discarded candidates are removed from UI
- Discarded memories are NOT shown in artifacts generation context

## Files Changed

1. `src/contexts/MirrorBrainContext.tsx`:
   - Added `reviewedMemories` to state
   - Added `ADD_REVIEWED_MEMORY` and `REMOVE_CANDIDATE` action types
   - Updated reducer to handle new actions
   - Exported reducer and initialState for testing

2. `src/hooks/useReviewWorkflow.ts`:
   - Updated `reviewCandidateMemory` to dispatch actions
   - Keep: adds reviewed memory to global state
   - Discard: removes candidate from global state

3. `src/components/artifacts/ArtifactsPanel.tsx`:
   - Changed from local state to global state for reviewedMemories
   - Filters to show only `decision='keep'` memories

## Verification

All tests pass:
- 16 tests total (including new reducer and integration tests)
- TypeScript compilation succeeds with no errors
- Implementation matches user requirements exactly

## Usage Flow

**User Workflow**:
1. Open Review tab
2. Click "Create Daily Candidates" (generates ≤10 candidates)
3. Review each candidate:
   - Click "Keep" → appears in Artifacts source context
   - Click "Discard" → permanently removed from candidates list
4. Navigate to Artifacts tab
5. Select "Generate Knowledge" or "Generate Skill" subtab
6. See kept reviewed memories in "Source Context" panel
7. Click "Generate" to create knowledge/skill draft from these sources
8. Edit and save the draft

## Data Flow

```
Review Candidates → Keep/Discard → ReviewedMemory → Global State → Artifacts → Knowledge/Skill Drafts
```

- Kept memories: Candidate → ReviewedMemory(keep) → Global State → Artifacts Source Context → Knowledge/Skill Generation
- Discarded memories: Candidate → ReviewedMemory(discard) → Global State (recorded) → UI Candidate Removed → NOT shown in artifacts