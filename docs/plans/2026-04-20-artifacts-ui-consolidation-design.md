# Artifacts UI Consolidation Design

**Date:** 2026-04-20
**Status:** Approved for implementation

## Problem

The Artifacts tab currently has 3 subtabs: History Topics, Generate Knowledge, and Generate Skill. Both "Generate Knowledge" and "Generate Skill" display the same Source Context (reviewed memories) in a 2-column layout. This creates visual duplication and forces users to switch between tabs when working with both drafts.

## Solution

Consolidate the two generation subtabs into a single "Draft Generation" subtab with a 3-column layout showing Source Context, Knowledge Draft, and Skill Draft side-by-side.

## Component Structure Changes

### Current Structure
```
ArtifactsPanel
├── SubtabNavigation (3 tabs)
├── HistoryTopics
├── KnowledgeGenerator (2-col: Context + Knowledge)
└── SkillGenerator (2-col: Context + Skill)
```

### Proposed Structure
```
ArtifactsPanel
├── SubtabNavigation (2 tabs)
├── HistoryTopics
└── DraftGeneration (3-col: Context | Knowledge | Skill)
```

### Components to Create
- **DraftGeneration**: New component implementing 3-column layout
  - Renders CandidateContext once (left column)
  - Renders DraftEditor twice (middle for knowledge, right for skill)
  - Receives state and handlers from ArtifactsPanel as props

### Components to Delete
- **KnowledgeGenerator**: No longer needed, logic moves to DraftGeneration
- **SkillGenerator**: No longer needed, logic moves to DraftGeneration

### Components to Modify
- **SubtabNavigation**: Update SUBTABS array from 3 items to 2
- **ArtifactsPanel**: Replace KnowledgeGenerator/SkillGenerator with DraftGeneration

## Layout Implementation

### 3-Column Grid
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Column 1: Source Context */}
  <div className="col-span-1">
    <CandidateContext reviewedMemories={reviewedMemories} />
  </div>

  {/* Column 2: Knowledge Draft */}
  <div className="col-span-1">
    <DraftEditor mode="knowledge" ... />
  </div>

  {/* Column 3: Skill Draft */}
  <div className="col-span-1">
    <DraftEditor mode="skill" ... />
  </div>
</div>
```

**Width distribution:** Equal thirds (33% each column)

**Responsive behavior:**
- **Desktop (≥1024px):** 3 columns horizontal
- **Mobile/Tablet (<1024px):** 1 column vertical stack
  - Stack order: Source Context → Knowledge Draft → Skill Draft

### Column Headers

Each column needs a header for clarity:
- **Column 1:** "Source Context" (already in CandidateContext)
- **Column 2:** "Knowledge Draft" header
- **Column 3:** "Skill Draft" header

Headers should match existing styling from KnowledgeGenerator/SkillGenerator:
```tsx
<h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
  Knowledge Draft
</h2>
<p className="font-body text-sm text-slate-600">
  Edit generated knowledge artifact
</p>
```

## Interaction Behavior

### Independent Generation
- Each draft has its own "Generate" button
- Knowledge generation does not affect skill generation
- Skill generation does not affect knowledge generation
- Both use the same Source Context as input

### Independent Save Operations
- Each draft has its own "Save" button
- Users can save knowledge without saving skill, or vice versa
- Success feedback specifies which artifact was saved: "Knowledge artifact saved successfully" or "Skill artifact saved successfully"

### Loading States
Each DraftEditor manages its own loading indicators:
- Knowledge: `isGeneratingKnowledge`, `isSavingKnowledge`
- Skill: `isGeneratingSkill`, `isSavingSkill`
- Buttons disabled while their respective operation is in progress

## State Management

### Centralized in ArtifactsPanel
No changes to existing state structure:
```tsx
const [activeSubtab, setActiveSubtab] = useState<ArtifactsSubtab>('history-topics')
const [knowledgeDraft, setKnowledgeDraft] = useState<KnowledgeArtifact | null>(null)
const [skillDraft, setSkillDraft] = useState<SkillArtifact | null>(null)
```

### Props Flow
DraftGeneration receives from ArtifactsPanel:
- `reviewedMemories` (source context data)
- `knowledgeDraft`, `skillDraft` (draft state)
- `onGenerateKnowledge`, `onGenerateSkill` (generate handlers)
- `onSaveKnowledge`, `onSaveSkill` (save handlers)
- Loading flags: `isGeneratingKnowledge`, `isGeneratingSkill`, `isSavingKnowledge`, `isSavingSkill`
- Change handlers: `onTitleChange`, `onSummaryChange`, `onBodyChange` for knowledge; `onApprovalStateChange`, `onRequiresConfirmationChange` for skill

## Error Handling

Preserve existing error handling:
- useArtifacts hook manages API errors
- ArtifactsPanel displays feedback banner
- No changes to error flow or user feedback

## Files to Modify

### Create
- `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.tsx`

### Delete
- `src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeGenerator.tsx`
- `src/apps/mirrorbrain-web-react/src/components/artifacts/SkillGenerator.tsx`

### Modify
- `src/apps/mirrorbrain-web-react/src/components/artifacts/ArtifactsPanel.tsx`
  - Update `ArtifactsSubtab` type to 2 values
  - Import DraftGeneration instead of KnowledgeGenerator/SkillGenerator
  - Replace conditional rendering logic
- `src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.tsx`
  - Update `SUBTABS` array to 2 items
  - Change labels to "History Topics", "Draft Generation"

### Test Updates
- `src/apps/mirrorbrain-web-react/src/integration/review-to-artifacts.test.ts`
  - Update subtab navigation test expectations
  - Update rendering assertions for new component structure

## Testing Strategy

### Component Tests
- DraftGeneration renders 3 columns correctly
- Each DraftEditor receives correct props
- Responsive behavior: grid-cols-1 on small screens, grid-cols-3 on large screens

### Integration Tests
- Users can generate knowledge independently
- Users can generate skill independently
- Users can save knowledge independently
- Users can save skill independently
- Loading states disable correct buttons
- Success feedback shows correct artifact type

### Manual Testing
- Verify visual layout matches design (equal thirds)
- Test responsive breakpoints (stacked vs horizontal)
- Test independent generation workflows
- Test independent save workflows
- Verify no regression in History Topics tab

## Implementation Notes

- Use Tailwind `grid-cols-3` for equal column distribution
- Preserve existing DraftEditor component - no changes needed
- Preserve existing CandidateContext component - no changes needed
- Move column headers from deleted components into DraftGeneration wrapper
- Keep all business logic in ArtifactsPanel and useArtifacts hook
- Maintain TDD workflow: update tests before implementation changes

## Success Criteria

- UI shows 2 subtabs instead of 3
- Draft Generation displays 3-column layout on desktop
- Source Context appears once (not duplicated)
- Knowledge and Skill drafts generate independently
- Knowledge and Skill drafts save independently
- Layout stacks vertically on mobile/tablet
- All existing functionality preserved
- Tests updated and passing