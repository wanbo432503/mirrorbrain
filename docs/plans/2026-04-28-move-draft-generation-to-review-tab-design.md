# Move Draft Generation to Review Tab Design

**Date:** 2026-04-28
**Status:** Draft

## Overview

Move the draft generation functionality from Artifacts tab to Review tab by integrating it into the SelectedCandidate component. This consolidates the workflow and removes the DraftGeneration subtab from Artifacts.

**Key Changes:**
- SelectedCandidate expands from 2 viewing modes to 4 modes
- Artifacts tab simplifies to only show History & Topics
- Review tab becomes the primary interface for generating knowledge/skill drafts from kept candidates
- DraftGeneration, DraftEditor, and SubtabNavigation components are removed

## Section 1: Overall Architecture Changes

### SelectedCandidate Component Expansion

**Current:** 2 viewing modes
- `'detail'` - Show candidate details when clicking from main list
- `'kept-list'` - Show scrollable list of kept candidate cards

**New:** 4 viewing modes  
- `'detail'` - Show candidate details (unchanged)
- `'kept-list'` - Show kept candidate list with "Generate Knowledge" and "Generate Skill" buttons in header
- `'knowledge-draft'` - Show knowledge draft generation/editing interface
- `'skill-draft'` - Show skill draft generation/editing interface

### ArtifactsPanel Simplification

**Changes:**
- Remove `DraftGeneration` subtab completely
- Remove `SubtabNavigation` component (no longer needed with single tab)
- Remove all draft generation handlers (~100 lines)
- Simplify to only render `HistoryTopics` directly
- Remove draft state management from component

### ReviewPanel Enhancement

**Changes:**
- Import and use `useArtifacts` hook
- Add draft generation handlers (handleGenerateKnowledge, handleGenerateSkill, etc.)
- Get draft state from context (knowledgeDraft, skillDraft)
- Pass all draft generation props to SelectedCandidate (~30 new props)

### Component File Changes

**Files to Delete:**
- `src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.tsx`
- `src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.test.tsx`
- `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.tsx`
- `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.test.tsx`
- `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftEditor.tsx`
- `src/apps/mirrorbrain-web-react/src/components/artifacts/CandidateContext.tsx`

**Files to Modify:**
- `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx` - Major expansion
- `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.test.tsx` - Add draft mode tests
- `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx` - Add draft generation integration
- `src/apps/mirrorbrain-web-react/src/components/artifacts/ArtifactsPanel.tsx` - Simplify to single tab

## Section 2: SelectedCandidate Component Design

### Component Interface

**Current Props:**
```typescript
interface SelectedCandidateProps {
  candidate: CandidateMemory | undefined;
  viewingMode: 'detail' | 'kept-list';
  keptCandidates: ReviewedMemory[];
  onUndoKeep: (reviewedMemoryId: string) => void;
}
```

**New Props:**
```typescript
interface SelectedCandidateProps {
  candidate: CandidateMemory | undefined;
  viewingMode: 'detail' | 'kept-list' | 'knowledge-draft' | 'skill-draft';
  keptCandidates: ReviewedMemory[];
  onUndoKeep: (reviewedMemoryId: string) => void;
  
  // Draft generation props
  knowledgeDraft: KnowledgeArtifact | null;
  skillDraft: SkillArtifact | null;
  onGenerateKnowledge: () => void;
  onGenerateSkill: () => void;
  onRegenerateKnowledge: () => void;
  onApproveKnowledge: () => void;
  onSaveKnowledge: () => void;
  onSaveSkill: () => void;
  isGeneratingKnowledge: boolean;
  isGeneratingSkill: boolean;
  isRegeneratingKnowledge: boolean;
  isApprovingKnowledge: boolean;
  isSavingKnowledge: boolean;
  isSavingSkill: boolean;
  
  // Knowledge editing handlers
  onKnowledgeTitleChange: (title: string) => void;
  onKnowledgeSummaryChange: (summary: string) => void;
  onKnowledgeBodyChange: (body: string) => void;
  
  // Skill editing handlers
  onSkillApprovalStateChange: (state: 'draft' | 'approved') => void;
  onSkillRequiresConfirmationChange: (requiresConfirmation: boolean) => void;
}
```

### Rendering Logic per Mode

**'detail' mode:**
- Unchanged from current implementation
- Shows full candidate details (title, review state, time range, summary, formation reasons, etc.)

**'kept-list' mode:**
- Shows header with title and buttons:
```typescript
<div className="mb-2 flex items-center justify-between">
  <div>
    <h3 className="font-heading font-bold text-xs text-slate-900 uppercase tracking-wide">
      Kept Candidates ({keptCandidates.length})
    </h3>
  </div>
  <div className="flex gap-2">
    <Button
      variant="primary"
      onClick={onGenerateKnowledge}
      disabled={isGeneratingKnowledge || keptCandidates.length === 0}
      loading={isGeneratingKnowledge}
    >
      {isGeneratingKnowledge ? 'Generating...' : 'Generate Knowledge'}
    </Button>
    <Button
      variant="primary"
      onClick={onGenerateSkill}
      disabled={isGeneratingSkill || keptCandidates.length === 0}
      loading={isGeneratingSkill}
    >
      {isGeneratingSkill ? 'Generating...' : 'Generate Skill'}
    </Button>
  </div>
</div>
```
- Shows scrollable list of `KeptCandidateCard` components below

**'knowledge-draft' mode:**
- Shows loading state during generation:
```typescript
<Card className="h-full">
  <div className="text-center py-12">
    <LoadingSpinner />
    <p className="font-heading font-semibold text-base text-slate-600 mt-4">
      Generating knowledge draft...
    </p>
  </div>
</Card>
```

- Shows draft editing interface after generation:
```typescript
<Card className="h-full overflow-y-auto max-h-[540px]">
  <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-heading font-bold text-base text-slate-900">
        Knowledge Draft
      </h3>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onRegenerateKnowledge} loading={isRegeneratingKnowledge}>
          Regenerate
        </Button>
        <Button variant="success" onClick={onApproveKnowledge} loading={isApprovingKnowledge}>
          Approve
        </Button>
        <Button variant="primary" onClick={onSaveKnowledge} loading={isSavingKnowledge}>
          Save
        </Button>
      </div>
    </div>
    
    {/* Edit Form */}
    <TextArea
      value={knowledgeDraft?.body || ''}
      onChange={(e) => onKnowledgeBodyChange(e.target.value)}
      rows={20}
      className="w-full"
    />
  </div>
</Card>
```

**'skill-draft' mode:**
- Similar pattern to knowledge-draft
- Shows skill-specific editing form:
```typescript
<Card className="h-full overflow-y-auto max-h-[540px]">
  <div className="space-y-4">
    {/* Header with Regenerate/Save buttons */}
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-heading font-bold text-base text-slate-900">
        Skill Draft
      </h3>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onRegenerateSkill}>
          Regenerate
        </Button>
        <Button variant="success" onClick={onSaveSkill} loading={isSavingSkill}>
          Save Draft
        </Button>
      </div>
    </div>
    
    {/* Approval State toggle */}
    <div className="space-y-2">
      <p className="text-sm font-heading font-semibold text-slate-900 uppercase">
        Approval State
      </p>
      <div className="flex border-b border-slate-200">
        <button onClick={() => onSkillApprovalStateChange('draft')} ...>
          Draft
        </button>
        <button onClick={() => onSkillApprovalStateChange('approved')} ...>
          Approved
        </button>
      </div>
    </div>
    
    {/* Workflow Evidence display */}
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <p className="text-xs font-heading font-semibold text-slate-600 uppercase mb-2">
        Workflow Evidence
      </p>
      <p className="font-body text-sm text-slate-700">
        {skillDraft?.workflowEvidenceRefs.length} references attached
      </p>
    </div>
    
    {/* Execution Safety checkbox */}
    <Checkbox
      label="Requires Confirmation"
      description="Skill execution must be explicitly confirmed by user"
      checked={skillDraft?.executionSafetyMetadata.requiresConfirmation}
      onChange={(e) => onSkillRequiresConfirmationChange(e.target.checked)}
    />
  </div>
</Card>
```

## Section 3: ReviewPanel Component Changes

### New Imports

```typescript
import { useArtifacts } from '../../hooks/useArtifacts'
import type { KnowledgeArtifact, SkillArtifact } from '../../types/index'
```

### New Hook Usage

```typescript
const {
  knowledgeArtifacts,
  skillArtifacts,
  knowledgeTopics,
  feedback: artifactsFeedback,
  isGeneratingKnowledge,
  isRegeneratingKnowledge,
  isApprovingKnowledge,
  isGeneratingSkill,
  isSavingKnowledge,
  isSavingSkill,
  generateKnowledge,
  regenerateKnowledge,
  approveKnowledge,
  generateSkill,
  saveKnowledgeArtifact,
  saveSkillArtifact,
} = useArtifacts(api)
```

### State from Context

```typescript
const { state, dispatch } = useMirrorBrain()
const knowledgeDraft = state.knowledgeDraft
const skillDraft = state.skillDraft
```

### New Handlers

**Knowledge Generation Handlers:**
```typescript
const handleGenerateKnowledge = async () => {
  try {
    const artifact = await generateKnowledge(keptCandidates)
    dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: artifact })
    setViewingMode('knowledge-draft')
  } catch (error) {
    // Error already handled by useArtifacts
  }
}

const handleRegenerateKnowledge = async () => {
  if (!knowledgeDraft || !regenerateKnowledge) return
  try {
    const artifact = await regenerateKnowledge(knowledgeDraft, keptCandidates)
    if (artifact) {
      dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: artifact })
    }
  } catch (error) {
    // Error handled by useArtifacts
  }
}

const handleApproveKnowledge = async () => {
  if (!knowledgeDraft?.id || !approveKnowledge) return
  try {
    const result = await approveKnowledge(knowledgeDraft)
    if (result) {
      dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: null })
      setViewingMode('kept-list')
    }
  } catch (error) {
    // Error handled by useArtifacts
  }
}

const handleSaveKnowledge = async () => {
  if (!knowledgeDraft) return
  try {
    await saveKnowledgeArtifact(knowledgeDraft)
  } catch (error) {
    // Error handled by useArtifacts
  }
}

const handleKnowledgeTitleChange = (title: string) => {
  if (!knowledgeDraft) return
  dispatch({
    type: 'SET_KNOWLEDGE_DRAFT',
    payload: { ...knowledgeDraft, title }
  })
}

const handleKnowledgeSummaryChange = (summary: string) => {
  if (!knowledgeDraft) return
  dispatch({
    type: 'SET_KNOWLEDGE_DRAFT',
    payload: { ...knowledgeDraft, summary }
  })
}

const handleKnowledgeBodyChange = (body: string) => {
  if (!knowledgeDraft) return
  dispatch({
    type: 'SET_KNOWLEDGE_DRAFT',
    payload: { ...knowledgeDraft, body }
  })
}
```

**Skill Generation Handlers:**
```typescript
const handleGenerateSkill = async () => {
  try {
    const artifact = await generateSkill(keptCandidates)
    dispatch({ type: 'SET_SKILL_DRAFT', payload: artifact })
    setViewingMode('skill-draft')
  } catch (error) {
    // Error handled by useArtifacts
  }
}

const handleSaveSkill = async () => {
  if (!skillDraft) return
  try {
    await saveSkillArtifact(skillDraft)
  } catch (error) {
    // Error handled by useArtifacts
  }
}

const handleSkillApprovalStateChange = (approvalState: 'draft' | 'approved') => {
  if (!skillDraft) return
  dispatch({
    type: 'SET_SKILL_DRAFT',
    payload: { ...skillDraft, approvalState }
  })
}

const handleSkillRequiresConfirmationChange = (requiresConfirmation: boolean) => {
  if (!skillDraft) return
  dispatch({
    type: 'SET_SKILL_DRAFT',
    payload: {
      ...skillDraft,
      executionSafetyMetadata: { requiresConfirmation }
    }
  })
}
```

### Props Passed to SelectedCandidate

```typescript
<SelectedCandidate
  candidate={selectedCandidate}
  viewingMode={viewingMode}
  keptCandidates={keptCandidates}
  onUndoKeep={handleUndoKeep}
  
  // Draft generation props (all new)
  knowledgeDraft={knowledgeDraft}
  skillDraft={skillDraft}
  onGenerateKnowledge={handleGenerateKnowledge}
  onGenerateSkill={handleGenerateSkill}
  onRegenerateKnowledge={handleRegenerateKnowledge}
  onApproveKnowledge={handleApproveKnowledge}
  onSaveKnowledge={handleSaveKnowledge}
  onSaveSkill={handleSaveSkill}
  isGeneratingKnowledge={isGeneratingKnowledge}
  isGeneratingSkill={isGeneratingSkill}
  isRegeneratingKnowledge={isRegeneratingKnowledge}
  isApprovingKnowledge={isApprovingKnowledge}
  isSavingKnowledge={isSavingKnowledge}
  isSavingSkill={isSavingSkill}
  onKnowledgeTitleChange={handleKnowledgeTitleChange}
  onKnowledgeSummaryChange={handleKnowledgeSummaryChange}
  onKnowledgeBodyChange={handleKnowledgeBodyChange}
  onSkillApprovalStateChange={handleSkillApprovalStateChange}
  onSkillRequiresConfirmationChange={handleSkillRequiresConfirmationChange}
/>
```

## Section 4: ArtifactsPanel Simplification

### Removed Imports

```typescript
// DELETE these imports
import SubtabNavigation from './SubtabNavigation'
import DraftGeneration from './DraftGeneration'
```

### Removed State

```typescript
// DELETE this state
const [activeSubtab, setActiveSubtab] = useState<ArtifactsSubtab>('history-topics')
type ArtifactsSubtab = 'history-topics' | 'draft-generation' // DELETE this type
```

### Removed Handlers (~100 lines)

```typescript
// DELETE all these handlers
const handleGenerateKnowledge = async () => { ... }
const handleRegenerateKnowledge = async () => { ... }
const handleApproveKnowledge = async () => { ... }
const handleSaveKnowledge = async () => { ... }
const handleGenerateSkill = async () => { ... }
const handleSaveSkill = async () => { ... }
```

### Simplified Component

```typescript
export default function ArtifactsPanel() {
  const api: MirrorBrainWebAppApi = createMirrorBrainBrowserApi(window.location.origin)
  
  const {
    knowledgeArtifacts,
    skillArtifacts,
    knowledgeTopics,
    feedback,
  } = useArtifacts(api)
  
  return (
    <div>
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-3 p-3 rounded-lg border ${
            feedback.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-700'
              : feedback.kind === 'error'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-blue-100 border-blue-300 text-blue-700'
          }`}
          role="alert"
        >
          <p className="font-body font-medium text-sm">{feedback.message}</p>
        </div>
      )}
      
      {/* Directly show HistoryTopics - no subtab navigation needed */}
      <HistoryTopics
        knowledgeTopics={knowledgeTopics}
        knowledgeArtifacts={knowledgeArtifacts}
        skillArtifacts={skillArtifacts}
      />
    </div>
  )
}
```

## Section 5: Files to Delete

### Component Files

**Delete these files completely:**
1. `src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.tsx` - No longer needed (single tab)
2. `src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.test.tsx` - Test for deleted component
3. `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.tsx` - Logic moved to SelectedCandidate
4. `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.test.tsx` - Test for deleted component
5. `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftEditor.tsx` - Editing logic moved to SelectedCandidate
6. `src/apps/mirrorbrain-web-react/src/components/artifacts/CandidateContext.tsx` - Not needed in review tab context

### Import Cleanup

**Files to clean imports:**
- `src/apps/mirrorbrain-web-react/src/components/artifacts/ArtifactsPanel.tsx` - Remove deleted component imports

## Section 6: Testing Updates

### SelectedCandidate.test.tsx

**Add new test cases:**
```typescript
describe('SelectedCandidate draft modes', () => {
  it('should render Generate Knowledge/Generate Skill buttons in kept-list mode', () => {
    render(
      <SelectedCandidate
        viewingMode="kept-list"
        keptCandidates={mockKeptCandidates}
        onGenerateKnowledge={() => {}}
        onGenerateSkill={() => {}}
        isGeneratingKnowledge={false}
        isGeneratingSkill={false}
        ...
      />
    )
    
    expect(screen.getByText('Generate Knowledge')).toBeInTheDocument()
    expect(screen.getByText('Generate Skill')).toBeInTheDocument()
  })
  
  it('should call onGenerateKnowledge when button clicked', async () => {
    const user = userEvent.setup()
    const onGenerateKnowledge = vi.fn()
    
    render(<SelectedCandidate ... onGenerateKnowledge={onGenerateKnowledge} />)
    
    await user.click(screen.getByText('Generate Knowledge'))
    
    expect(onGenerateKnowledge).toHaveBeenCalled()
  })
  
  it('should show loading state in knowledge-draft mode', () => {
    render(
      <SelectedCandidate
        viewingMode="knowledge-draft"
        isGeneratingKnowledge={true}
        ...
      />
    )
    
    expect(screen.getByText('Generating knowledge draft...')).toBeInTheDocument()
  })
  
  it('should show draft editing interface in knowledge-draft mode', () => {
    render(
      <SelectedCandidate
        viewingMode="knowledge-draft"
        knowledgeDraft={mockKnowledgeDraft}
        isGeneratingKnowledge={false}
        ...
      />
    )
    
    expect(screen.getByText('Knowledge Draft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
  })
  
  // Similar tests for skill-draft mode
})
```

### ReviewPanel.test.tsx

**Add new test cases:**
```typescript
describe('ReviewPanel draft generation', () => {
  it('should have generate knowledge handler', () => {
    // Mock useArtifacts hook
    // Verify handler is passed to SelectedCandidate
  })
  
  it('should switch to knowledge-draft mode after generating', async () => {
    // Test mode switching logic
  })
})
```

### ArtifactsPanel.test.tsx

**Remove draft generation tests:**
- Remove all test cases related to DraftGeneration
- Remove subtab navigation tests
- Keep HistoryTopics rendering tests

### Delete Test Files

- Delete `SubtabNavigation.test.tsx`
- Delete `DraftGeneration.test.tsx`

## Section 7: Type Definitions

### ViewingMode Type

**Update type definition:**
```typescript
export type ViewingMode = 
  | 'detail' 
  | 'kept-list' 
  | 'knowledge-draft' 
  | 'skill-draft'
```

### Context State

**Existing state (no changes needed):**
```typescript
interface State {
  ...
  knowledgeDraft: KnowledgeArtifact | null
  skillDraft: SkillArtifact | null
  ...
}
```

**Existing actions (already implemented):**
```typescript
type Action =
  | { type: 'SET_KNOWLEDGE_DRAFT'; payload: KnowledgeArtifact | null }
  | { type: 'SET_SKILL_DRAFT'; payload: SkillArtifact | null }
```

## Section 8: Implementation Strategy

### Phase 1: Delete Components
1. Delete the 6 component files
2. Clean imports in ArtifactsPanel
3. Simplify ArtifactsPanel to only render HistoryTopics

### Phase 2: Extend SelectedCandidate
1. Update ViewingMode type to 4 modes
2. Add all new props to interface
3. Add 'kept-list' mode rendering with Generate buttons
4. Add 'knowledge-draft' mode rendering
5. Add 'skill-draft' mode rendering
6. Write tests for new modes

### Phase 3: Enhance ReviewPanel
1. Add useArtifacts hook import and usage
2. Add all draft generation handlers
3. Pass all new props to SelectedCandidate
4. Write tests for handlers

### Phase 4: Testing and Verification
1. Run all tests
2. Manual testing checklist
3. Verify functionality in dev environment

## Success Criteria

1. ✅ Generate Knowledge/Generate Skill buttons appear in Kept Candidates header
2. ✅ Clicking buttons switches SelectedCandidate to draft mode
3. ✅ Draft generation loading state displays correctly
4. ✅ Draft editing interface shows after generation completes
5. ✅ Regenerate/Approve/Save buttons work correctly
6. ✅ Artifacts tab shows only HistoryTopics (no subtab navigation)
7. ✅ All deleted components removed from codebase
8. ✅ All tests pass (existing + new)
9. ✅ No regressions in existing review workflow

## Design Rationale

**Why move to Review tab?**
- Consolidates workflow: review candidates → keep them → generate artifacts in one place
- Removes unnecessary navigation between tabs
- More intuitive: artifacts are generated from kept candidates, so generation should be in review tab

**Why remove DraftGeneration subtab?**
- Reduces UI complexity (no subtab navigation needed)
- Single-purpose Artifacts tab (view history and topics)
- Draft editing happens where drafts are generated (in SelectedCandidate)

**Why 4 viewing modes instead of separate components?**
- SelectedCandidate already handles mode switching elegantly
- Keeps all "selected area" logic in one component
- Clean state management through viewingMode prop
- Follows existing patterns from kept-list implementation

## Risks and Considerations

**Large prop list:**
- SelectedCandidate will receive ~30 props for draft generation
- Consider: Create a separate `DraftGenerationProps` interface and spread it
- Mitigation: Group related props, use clear naming

**Mode switching complexity:**
- 4 modes increases complexity
- Consider: Add mode transition diagram in comments
- Mitigation: Keep mode switching logic simple and well-tested

**Deleted code:**
- Once deleted, cannot easily restore
- Consider: Tag commit with clear message before deletion
- Mitigation: Implementation can be done in stages (delete after new implementation works)

**Feedback display:**
- Both ReviewPanel and ArtifactsPanel show feedback
- Consider: Should feedback be unified?
- Mitigation: Each panel manages its own feedback through useArtifacts hook