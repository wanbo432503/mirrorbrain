# Manual Testing: Approve Knowledge/Skill and Delete Candidates

## Test Setup
- [ ] Start backend server: `npm run dev`
- [ ] Start frontend dev server: `cd src/apps/mirrorbrain-web-react && npm run dev`
- [ ] Load memory events (sync browser memory)
- [ ] Create daily candidates for a date (e.g., 2026-04-29)
- [ ] Verify candidates appear in Review tab candidates list

## Approve Knowledge Flow

### Keep Candidates
- [ ] Review 2-3 candidates in the candidates list
- [ ] Click "Keep" button on each candidate
- [ ] Verify candidates disappear from main candidates list
- [ ] Verify candidates appear in KEPT CANDIDATES section
- [ ] Verify "Generate Knowledge" and "Generate Skill" buttons appear in KEPT CANDIDATES header

### Generate Knowledge
- [ ] Click "Generate Knowledge" button in KEPT CANDIDATES header
- [ ] Verify loading state shows "⟳ Loading..." with spinner
- [ ] Verify viewingMode switches to knowledge-draft
- [ ] Verify knowledge draft editing interface appears after generation
- [ ] Verify TextArea shows draft content
- [ ] Verify "Regenerate", "Approve", "Save" buttons appear

### Approve Knowledge
- [ ] Click "Approve" button in knowledge draft interface
- [ ] Verify approve operation succeeds
- [ ] Verify success feedback shows "Knowledge approved and candidates deleted" (if all candidates deleted successfully)
- [ ] Verify viewingMode switches back to kept-list
- [ ] **Critical:** Verify KEPT CANDIDATES list is now empty (or shows remaining kept candidates not used in this draft)
- [ ] **Critical:** Verify candidates deleted from main candidates list
- [ ] Verify knowledge artifact appears in Artifacts tab (HistoryTopics)

### Verify Candidate Deletion (Backend)
- [ ] Navigate to workspace directory
- [ ] Check `mirrorbrain/candidate-memories/` directory
- [ ] Verify candidate JSON files for the approved draft are deleted
- [ ] Verify candidate files for other kept candidates still exist (if any)

## Error Scenarios

### Partial Deletion Failure
- [ ] Keep 3 candidates
- [ ] Generate knowledge from all 3
- [ ] Simulate network error during candidate deletion (disconnect server during delete)
- [ ] Approve knowledge
- [ ] Verify warning feedback: "Knowledge approved, but N candidate deletion(s) failed"
- [ ] Verify knowledge is approved successfully
- [ ] Verify some candidates remain in candidates list

### Approve Failure
- [ ] Keep candidates and generate knowledge
- [ ] Simulate approve API failure (e.g., backend error)
- [ ] Click approve
- [ ] Verify error feedback: "Knowledge approval failed"
- [ ] **Critical:** Verify NO candidates deleted (all kept candidates still in list)
- [ ] Verify candidates remain in workspace files

## Edge Cases

### Empty SourceReviewedMemoryIds
- [ ] Create a knowledge draft with no source reviewed memories (edge case)
- [ ] Approve the draft
- [ ] Verify no deletion errors occur
- [ ] Verify approve succeeds normally

### Concurrent Approve Operations
- [ ] Keep candidates and generate 2 knowledge drafts from same candidates
- [ ] Approve first draft
- [ ] Verify candidates deleted
- [ ] Approve second draft
- [ ] Verify approve succeeds (idempotent deletion)

## Skill Draft Testing (Optional)

### Generate and Approve Skill
- [ ] Keep candidates
- [ ] Click "Generate Skill" button
- [ ] Verify skill draft editing interface appears
- [ ] Verify workflow evidence display
- [ ] Toggle approval state (Draft/Approved)
- [ ] Toggle "Requires Confirmation" checkbox
- [ ] Click "Save Draft" or approve skill
- [ ] Verify candidates deleted from list

## UI State Verification

### Real-time Updates
- [ ] Keep candidate A and candidate B
- [ ] Generate knowledge from both
- [ ] Approve knowledge
- [ ] Verify candidate A and B immediately removed from candidates list (no page refresh needed)
- [ ] Verify candidate A and B files deleted from workspace (check file system)

### Feedback Messages
- [ ] Verify success message on successful approve+delete
- [ ] Verify warning message on partial deletion failure
- [ ] Verify error message on approve failure
- [ ] Verify messages are clear and actionable

## Artifacts Tab Verification

### Knowledge Published
- [ ] After approve knowledge
- [ ] Navigate to Artifacts tab
- [ ] Verify only HistoryTopics shows (no subtab navigation)
- [ ] Verify published knowledge appears in knowledge topics list
- [ ] Verify no candidate remnants in artifacts

## Backend API Verification

### DELETE Endpoint Test
- [ ] Use HTTP client (curl or browser dev tools)
- [ ] DELETE /candidate-memories/:id for a test candidate
- [ ] Verify 204 response
- [ ] Verify candidate file deleted
- [ ] Repeat DELETE for same ID (idempotent)
- [ ] Verify 204 response again (no error)

### Invalid ID Test
- [ ] DELETE /candidate-memories/invalid-id-format
- [ ] Verify 400 response
- [ ] Verify error message: "Invalid candidate memory ID format"

## Cleanup and Reset

### Test Data Cleanup
- [ ] Delete all test candidates from workspace
- [ ] Delete test reviewed memories
- [ ] Delete test knowledge artifacts
- [ ] Reset browser memory events cache

### Verify Clean State
- [ ] Refresh application
- [ ] Verify Review tab candidates list empty
- [ ] Verify Artifacts tab clean
- [ ] No leftover test artifacts

## Performance Check

### Multiple Candidates
- [ ] Keep 10 candidates
- [ ] Generate knowledge from all 10
- [ ] Approve knowledge
- [ ] Verify all 10 candidates deleted efficiently
- [ ] Verify no UI lag during batch deletion

## Success Criteria

✅ **Primary requirement met:** Approve knowledge successfully deletes candidates
✅ **Backend deletion:** Candidate files removed from workspace storage
✅ **UI state sync:** Candidates disappear from list immediately
✅ **Error handling:** Deletion failures don't break approve flow
✅ **Idempotency:** Repeated deletions succeed without error
✅ **Feedback clarity:** User receives appropriate success/warning/error messages