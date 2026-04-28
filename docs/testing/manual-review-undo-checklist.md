# Manual Testing Checklist: Review Candidate Keep/Undo

## Setup
- [ ] Start backend server
- [ ] Start frontend dev server
- [ ] Load memory events
- [ ] Create daily candidates

## Test Cases

### Keep Candidate Flow
- [ ] Click candidate in main list
- [ ] Verify detail view shows candidate details
- [ ] Click "Keep" button
- [ ] Verify candidate disappears from main list
- [ ] Verify kept list view appears with kept candidate
- [ ] Verify green "Kept" badge on card

### Multiple Keeps
- [ ] Keep first candidate
- [ ] Click another candidate from main list
- [ ] Verify detail view switches temporarily
- [ ] Click "Keep" again
- [ ] Verify kept list view returns
- [ ] Verify both kept candidates appear in list

### Undo Flow
- [ ] Keep one or more candidates
- [ ] Click "Undo" button on kept card
- [ ] Verify candidate reappears in main list
- [ ] Verify kept card disappears
- [ ] Verify backend reviewed memory deleted (check files)

### Edge Cases
- [ ] Keep all candidates, verify empty main list message
- [ ] Undo all kept candidates, verify empty kept list message
- [ ] Try undo on non-existent reviewed memory (should show error)

## Visual Checks
- [ ] Kept badge styling (green border/text)
- [ ] Undo button styling (gray -> red hover)
- [ ] Smooth transitions between views
- [ ] Scrollable kept list works correctly

## Backend Verification
- [ ] Reviewed memory files created after keep
- [ ] Reviewed memory files deleted after undo
- [ ] Candidate files still exist after undo
- [ ] DELETE endpoint returns 204 on success
- [ ] DELETE endpoint returns 404 for missing file

## Integration Verification
- [ ] State persists correctly across page refreshes
- [ ] Kept candidates count updates correctly
- [ ] Header text changes based on viewing mode
- [ ] Candidates filter correctly to exclude kept ones

## Notes
Record any issues found during testing:

### Issues Found
- Issue 1: [Description]
- Issue 2: [Description]

### Resolution
- Resolution 1: [How it was fixed or workaround]
- Resolution 2: [How it was fixed or workaround]