# Manual Testing: Draft Generation in Review Tab

## Setup
- [ ] Start backend server
- [ ] Start frontend dev server
- [ ] Load memory events
- [ ] Create daily candidates
- [ ] Keep several candidates (2-5)

## Generate Knowledge Flow
- [ ] Navigate to Review tab
- [ ] View kept candidates list
- [ ] Verify "Generate Knowledge" button appears in header
- [ ] Click "Generate Knowledge" button
- [ ] Verify loading state shows "⟳ Loading..." with spinner
- [ ] Verify viewingMode switches to knowledge-draft
- [ ] Verify draft editing interface appears after generation
- [ ] Verify "Regenerate", "Approve", "Save" buttons appear
- [ ] Edit draft content in textarea
- [ ] Click "Regenerate" - verify new draft generated
- [ ] Click "Approve" - verify draft approved and mode switches back to kept-list
- [ ] Click "Save" - verify draft saved

## Generate Skill Flow
- [ ] Click "Generate Skill" button from kept-list
- [ ] Verify loading state shows "⟳ Loading..." with spinner
- [ ] Verify viewingMode switches to skill-draft
- [ ] Verify skill editing interface appears
- [ ] Verify approval state toggle (Draft/Approved)
- [ ] Toggle approval state - verify state changes
- [ ] Verify workflow evidence display shows reference count
- [ ] Verify "Requires Confirmation" checkbox
- [ ] Toggle checkbox - verify state changes
- [ ] Click "Save Draft" - verify skill saved

## Edge Cases
- [ ] Click Generate buttons when no kept candidates - verify buttons disabled
- [ ] Generate knowledge, then click candidate from main list - verify mode switches to detail
- [ ] Generate knowledge, then undo a kept candidate - verify keptCandidates updates
- [ ] Try generating multiple times - verify regenerate works

## Artifacts Tab Verification
- [ ] Navigate to Artifacts tab
- [ ] Verify only HistoryTopics shows (no subtab navigation)
- [ ] Verify no "Draft Generation" tab
- [ ] Verify no errors or missing components

## Backend Verification
- [ ] Check knowledge artifacts created after approve
- [ ] Check skill artifacts created after save
- [ ] Verify artifacts appear in HistoryTopics

## Cleanup
- [ ] All features work as expected
- [ ] No regressions in existing review workflow
- [ ] No regressions in candidate keep/undo flow