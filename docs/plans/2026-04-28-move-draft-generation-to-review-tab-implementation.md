# Move Draft Generation to Review Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move draft generation functionality from Artifacts tab to Review tab's SelectedCandidate component, consolidating workflow and removing DraftGeneration subtab.

**Architecture:** SelectedCandidate expands from 2 viewing modes to 4 modes. ArtifactsPanel simplifies to single HistoryTopics tab. ReviewPanel integrates useArtifacts hook for draft generation. Delete 6 component files.

**Tech Stack:** TypeScript, React, Vitest, useArtifacts hook, MirrorBrainContext

---

## Phase 1: Delete Unused Components

### Task 1: Delete SubtabNavigation Component Files

**Files:**
- Delete: `src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.tsx`
- Delete: `src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.test.tsx`

**Step 1: Delete component file**

Run: `rm src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.tsx`

**Step 2: Delete test file**

Run: `rm src/apps/mirrorbrain-web-react/src/components/artifacts/SubtabNavigation.test.tsx`

**Step 3: Verify files deleted**

Run: `ls src/apps/mirrorbrain-web-react/src/components/artifacts/`
Expected: Files not in list

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete SubtabNavigation component (moving to single tab)"
```

---

### Task 2: Delete DraftGeneration Component Files

**Files:**
- Delete: `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.tsx`
- Delete: `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.test.tsx`

**Step 1: Delete component files**

Run: 
```bash
rm src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.tsx
rm src/apps/mirrorbrain-web-react/src/components/artifacts/DraftGeneration.test.tsx
```

**Step 2: Verify deletion**

Run: `ls src/apps/mirrorbrain-web-react/src/components/artifacts/`
Expected: Files not in list

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete DraftGeneration component (logic moved to SelectedCandidate)"
```

---

### Task 3: Delete DraftEditor and CandidateContext Files

**Files:**
- Delete: `src/apps/mirrorbrain-web-react/src/components/artifacts/DraftEditor.tsx`
- Delete: `src/apps/mirrorbrain-web-react/src/components/artifacts/CandidateContext.tsx`

**Step 1: Delete files**

Run:
```bash
rm src/apps/mirrorbrain-web-react/src/components/artifacts/DraftEditor.tsx
rm src/apps/mirrorbrain-web-react/src/components/artifacts/CandidateContext.tsx
```

**Step 2: Verify deletion**

Run: `ls src/apps/mirrorbrain-web-react/src/components/artifacts/`
Expected: Files not in list, only remaining files should be ArtifactsPanel.tsx, ArtifactsPanel.test.tsx, HistoryTopics.tsx, HistoryTable.tsx, DraftGeneration.tsx (wait, that's deleted too)

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete DraftEditor and CandidateContext (editing logic moved to SelectedCandidate)"
```

---

### Task 4: Simplify ArtifactsPanel Component

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/artifacts/ArtifactsPanel.tsx`

**Step 1: Remove imports**

Remove these imports:
```typescript
import SubtabNavigation from './SubtabNavigation'
import DraftGeneration from './DraftGeneration'
```

**Step 2: Remove subtab state**

Remove:
```typescript
const [activeSubtab, setActiveSubtab] = useState<ArtifactsSubtab>('history-topics')
type ArtifactsSubtab = 'history-topics' | 'draft-generation'
```

**Step 3: Remove draft handlers (~100 lines)**

Delete all these handlers:
```typescript
const handleGenerateKnowledge = async () => { ... }
const handleRegenerateKnowledge = async () => { ... }
const handleApproveKnowledge = async () => { ... }
const handleSaveKnowledge = async () => { ... }
const handleGenerateSkill = async () => { ... }
const handleSaveSkill = async () => { ... }
const handleKnowledgeTitleChange = ...
const handleKnowledgeSummaryChange = ...
const handleKnowledgeBodyChange = ...
const handleSkillApprovalStateChange = ...
const handleSkillRequiresConfirmationChange = ...
```

**Step 4: Remove draft state**

Delete:
```typescript
const knowledgeDraft = state.knowledgeDraft
const skillDraft = state.skillDraft
```

**Step 5: Simplify component rendering**

Replace entire return block with:
```typescript
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
```

**Step 6: Verify compilation**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No errors (or only pre-existing unrelated errors)

**Step 7: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/artifacts/ArtifactsPanel.tsx
git commit -m "refactor: simplify ArtifactsPanel to single HistoryTopics tab"
```

---

## Phase 2: Extend SelectedCandidate Component

### Task 5: Update SelectedCandidate ViewingMode Type

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx`

**Step 1: Update viewing mode type**

Find line 5-7 and update:
```typescript
interface SelectedCandidateProps {
  candidate: CandidateMemory | undefined;
  viewingMode: 'detail' | 'kept-list' | 'knowledge-draft' | 'skill-draft';
  keptCandidates: ReviewedMemory[];
  onUndoKeep: (reviewedMemoryId: string) => void;
  
  // Add draft generation props
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

**Step 2: Add new imports**

Add at top:
```typescript
import Button from '../common/Button'
import TextArea from '../forms/TextArea'
import Checkbox from '../forms/Checkbox'
import LoadingSpinner from '../common/LoadingSpinner'
import type { KnowledgeArtifact, SkillArtifact } from '../../types/index'
```

**Step 3: Verify compilation**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: Type errors in ReviewPanel (missing new props), but SelectedCandidate interface valid

**Step 4: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx
git commit -m "feat: expand SelectedCandidate props for draft generation modes"
```

---

### Task 6: Add Generate Buttons to Kept-List Mode

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx`

**Step 1: Update kept-list mode header**

Find the kept-list mode rendering (around line 20-30). Replace header with:
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
      size="sm"
      onClick={onGenerateKnowledge}
      disabled={isGeneratingKnowledge || keptCandidates.length === 0}
      loading={isGeneratingKnowledge}
    >
      {isGeneratingKnowledge ? 'Generating...' : 'Generate Knowledge'}
    </Button>
    <Button
      variant="primary"
      size="sm"
      onClick={onGenerateSkill}
      disabled={isGeneratingSkill || keptCandidates.length === 0}
      loading={isGeneratingSkill}
    >
      {isGeneratingSkill ? 'Generating...' : 'Generate Skill'}
    </Button>
  </div>
</div>
```

**Step 2: Verify buttons render**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx
git commit -m "feat: add Generate Knowledge/Generate Skill buttons to kept-list header"
```

---

### Task 7: Add Knowledge-Draft Mode Rendering

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx`

**Step 1: Add knowledge-draft mode case**

Add after kept-list mode (around line 45):
```typescript
// Knowledge draft mode
if (viewingMode === 'knowledge-draft') {
  // Loading state during generation
  if (isGeneratingKnowledge) {
    return (
      <Card className="h-full">
        <div className="text-center py-12">
          <LoadingSpinner />
          <p className="font-heading font-semibold text-base text-slate-600 mt-4">
            Generating knowledge draft...
          </p>
        </div>
      </Card>
    )
  }
  
  // Draft editing interface
  return (
    <Card className="h-full overflow-y-auto max-h-[540px]">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-base text-slate-900">
            Knowledge Draft
          </h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerateKnowledge}
              loading={isRegeneratingKnowledge}
              disabled={isRegeneratingKnowledge || isSavingKnowledge || isApprovingKnowledge}
            >
              {isRegeneratingKnowledge ? 'Regenerating...' : 'Regenerate'}
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={onApproveKnowledge}
              loading={isApprovingKnowledge}
              disabled={isApprovingKnowledge || isSavingKnowledge || isRegeneratingKnowledge}
            >
              {isApprovingKnowledge ? 'Approving...' : 'Approve'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onSaveKnowledge}
              loading={isSavingKnowledge}
              disabled={isSavingKnowledge || isRegeneratingKnowledge || isApprovingKnowledge}
            >
              {isSavingKnowledge ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        
        {/* Edit Form */}
        <TextArea
          value={knowledgeDraft?.body || ''}
          onChange={(e) => onKnowledgeBodyChange(e.target.value)}
          rows={20}
          className="w-full font-body text-sm"
          placeholder="Knowledge draft content will appear here..."
        />
      </div>
    </Card>
  )
}
```

**Step 2: Verify compilation**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx
git commit -m "feat: add knowledge-draft mode rendering in SelectedCandidate"
```

---

### Task 8: Add Skill-Draft Mode Rendering

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx`

**Step 1: Add skill-draft mode case**

Add after knowledge-draft mode:
```typescript
// Skill draft mode
if (viewingMode === 'skill-draft') {
  // Loading state during generation
  if (isGeneratingSkill) {
    return (
      <Card className="h-full">
        <div className="text-center py-12">
          <LoadingSpinner />
          <p className="font-heading font-semibold text-base text-slate-600 mt-4">
            Generating skill draft...
          </p>
        </div>
      </Card>
    )
  }
  
  // Draft editing interface
  return (
    <Card className="h-full overflow-y-auto max-h-[540px]">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-base text-slate-900">
            Skill Draft
          </h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerateKnowledge}
              disabled={isSavingSkill}
            >
              Regenerate
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={onSaveSkill}
              loading={isSavingSkill}
              disabled={isSavingSkill}
            >
              {isSavingSkill ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </div>
        
        {/* Approval State toggle */}
        <div className="space-y-2">
          <p className="text-sm font-heading font-semibold text-slate-900 uppercase">
            Approval State
          </p>
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => onSkillApprovalStateChange('draft')}
              className={`
                px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
                cursor-pointer transition-colors duration-200
                focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
                border-b-2 -mb-px
                ${skillDraft?.approvalState === 'draft'
                  ? 'border-yellow-500 text-yellow-700 bg-yellow-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }
              `}
            >
              Draft
            </button>
            <button
              onClick={() => onSkillApprovalStateChange('approved')}
              className={`
                px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
                cursor-pointer transition-colors duration-200
                focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
                border-b-2 -mb-px
                ${skillDraft?.approvalState === 'approved'
                  ? 'border-green-500 text-green-700 bg-green-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }
              `}
            >
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
            {skillDraft?.workflowEvidenceRefs?.length || 0} references attached
          </p>
        </div>
        
        {/* Execution Safety checkbox */}
        <Checkbox
          label="Requires Confirmation"
          description="Skill execution must be explicitly confirmed by user"
          checked={skillDraft?.executionSafetyMetadata?.requiresConfirmation || true}
          onChange={(e) => onSkillRequiresConfirmationChange(e.target.checked)}
        />
      </div>
    </Card>
  )
}
```

**Step 2: Verify compilation**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx
git commit -m "feat: add skill-draft mode rendering in SelectedCandidate"
```

---

### Task 9: Write Tests for Draft Modes

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.test.tsx`

**Step 1: Add test for Generate buttons**

Add new test:
```typescript
it('should render Generate Knowledge/Generate Skill buttons in kept-list mode', () => {
  const mockKeptCandidates: ReviewedMemory[] = [
    {
      id: 'reviewed:candidate:test-1',
      candidateMemoryId: 'candidate:test-1',
      candidateTitle: 'Test',
      candidateSummary: 'Summary',
      candidateTheme: 'test',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-28',
      decision: 'keep',
      reviewedAt: '2026-04-28T10:00:00Z',
    },
  ]
  
  render(
    <SelectedCandidate
      viewingMode="kept-list"
      keptCandidates={mockKeptCandidates}
      knowledgeDraft={null}
      skillDraft={null}
      onGenerateKnowledge={() => {}}
      onGenerateSkill={() => {}}
      onRegenerateKnowledge={() => {}}
      onApproveKnowledge={() => {}}
      onSaveKnowledge={() => {}}
      onSaveSkill={() => {}}
      isGeneratingKnowledge={false}
      isGeneratingSkill={false}
      isRegeneratingKnowledge={false}
      isApprovingKnowledge={false}
      isSavingKnowledge={false}
      isSavingSkill={false}
      onUndoKeep={() => {}}
      onKnowledgeTitleChange={() => {}}
      onKnowledgeSummaryChange={() => {}}
      onKnowledgeBodyChange={() => {}}
      onSkillApprovalStateChange={() => {}}
      onSkillRequiresConfirmationChange={() => {}}
      candidate={undefined}
    />
  )
  
  expect(screen.getByText('Generate Knowledge')).toBeInTheDocument()
  expect(screen.getByText('Generate Skill')).toBeInTheDocument()
})
```

**Step 2: Add test for button click handler**

```typescript
it('should call onGenerateKnowledge when button clicked', async () => {
  const user = userEvent.setup()
  const onGenerateKnowledge = vi.fn()
  
  const mockKeptCandidates: ReviewedMemory[] = [ ... ]
  
  render(<SelectedCandidate ... onGenerateKnowledge={onGenerateKnowledge} />)
  
  await user.click(screen.getByText('Generate Knowledge'))
  
  expect(onGenerateKnowledge).toHaveBeenCalled()
})
```

**Step 3: Add test for loading state**

```typescript
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
```

**Step 4: Add test for draft editing interface**

```typescript
it('should show draft editing interface in knowledge-draft mode', () => {
  const mockKnowledgeDraft: KnowledgeArtifact = {
    artifactType: 'daily-review-draft',
    id: 'knowledge:test',
    draftState: 'draft',
    topicKey: null,
    title: 'Test Knowledge',
    summary: 'Test summary',
    body: 'Test body content',
    sourceReviewedMemoryIds: [],
    derivedFromKnowledgeIds: [],
    version: 1,
    isCurrentBest: false,
    supersedesKnowledgeId: null,
    updatedAt: '2026-04-28T10:00:00Z',
    reviewedAt: null,
    recencyLabel: 'recent',
    provenanceRefs: [],
  }
  
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
```

**Step 5: Run tests**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- SelectedCandidate.test.tsx`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.test.tsx
git commit -m "test: add tests for draft generation modes in SelectedCandidate"
```

---

## Phase 3: Enhance ReviewPanel Component

### Task 10: Add useArtifacts Hook to ReviewPanel

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx`

**Step 1: Add imports**

Add at top:
```typescript
import { useArtifacts } from '../../hooks/useArtifacts'
import type { KnowledgeArtifact, SkillArtifact } from '../../types/index'
```

**Step 2: Use artifacts hook**

Add after useReviewWorkflow:
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

**Step 3: Get draft state from context**

Add after line 34:
```typescript
const { state, dispatch } = useMirrorBrain()
const knowledgeDraft = state.knowledgeDraft
const skillDraft = state.skillDraft
```

**Step 4: Verify compilation**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx
git commit -m "feat: add useArtifacts hook to ReviewPanel for draft generation"
```

---

### Task 11: Add Knowledge Generation Handlers to ReviewPanel

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx`

**Step 1: Add handleGenerateKnowledge**

Add after handleDiscardCandidate:
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
```

**Step 2: Add handleRegenerateKnowledge**

```typescript
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
```

**Step 3: Add handleApproveKnowledge**

```typescript
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
```

**Step 4: Add handleSaveKnowledge**

```typescript
const handleSaveKnowledge = async () => {
  if (!knowledgeDraft) return
  try {
    await saveKnowledgeArtifact(knowledgeDraft)
  } catch (error) {
    // Error handled by useArtifacts
  }
}
```

**Step 5: Add editing handlers**

```typescript
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

**Step 6: Verify compilation**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx
git commit -m "feat: add knowledge generation handlers to ReviewPanel"
```

---

### Task 12: Add Skill Generation Handlers to ReviewPanel

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx`

**Step 1: Add handleGenerateSkill**

Add after knowledge handlers:
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
```

**Step 2: Add handleSaveSkill**

```typescript
const handleSaveSkill = async () => {
  if (!skillDraft) return
  try {
    await saveSkillArtifact(skillDraft)
  } catch (error) {
    // Error handled by useArtifacts
  }
}
```

**Step 3: Add skill editing handlers**

```typescript
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

**Step 4: Verify compilation**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx
git commit -m "feat: add skill generation handlers to ReviewPanel"
```

---

### Task 13: Pass Draft Props to SelectedCandidate

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx`

**Step 1: Update SelectedCandidate props**

Find the SelectedCandidate component rendering and replace with:
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

**Step 2: Verify compilation**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: All type errors resolved

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx
git commit -m "feat: pass draft generation props to SelectedCandidate"
```

---

## Phase 4: Testing and Verification

### Task 14: Run All Tests

**Step 1: Run component tests**

Run: `cd src/apps/mirrorbrain-web-react && npm test`
Expected: All tests pass

**Step 2: Run integration tests**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- review-to-artifacts.test.ts`
Expected: All integration tests pass

**Step 3: Verify no TypeScript errors**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: Clean compilation

**Step 4: Commit if needed**

If any test updates required:
```bash
git add -A
git commit -m "test: verify all tests pass after draft generation refactor"
```

---

### Task 15: Manual Testing Checklist

**Files:**
- Create: `docs/testing/manual-draft-generation-review-tab-checklist.md`

**Step 1: Create checklist**

```markdown
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
- [ ] Verify loading state shows "Generating knowledge draft..."
- [ ] Verify viewingMode switches to knowledge-draft
- [ ] Verify draft editing interface appears after generation
- [ ] Verify "Regenerate", "Approve", "Save" buttons appear
- [ ] Edit draft content in textarea
- [ ] Click "Regenerate" - verify new draft generated
- [ ] Click "Approve" - verify draft approved and mode switches back to kept-list
- [ ] Click "Save" - verify draft saved

## Generate Skill Flow
- [ ] Click "Generate Skill" button from kept-list
- [ ] Verify loading state shows "Generating skill draft..."
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
```

**Step 2: Save checklist**

Save to `docs/testing/manual-draft-generation-review-tab-checklist.md`

**Step 3: Commit**

```bash
git add docs/testing/manual-draft-generation-review-tab-checklist.md
git commit -m "docs: add manual testing checklist for draft generation refactor"
```

---

## Success Verification

After completing all tasks, verify:

1. ✅ Generate Knowledge/Generate Skill buttons appear in kept-list header
2. ✅ Clicking buttons switches SelectedCandidate to draft mode
3. ✅ Loading states display during generation
4. ✅ Draft editing interfaces show after generation
5. ✅ Regenerate/Approve/Save buttons work
6. ✅ Artifacts tab shows only HistoryTopics
7. ✅ All 6 deleted components removed
8. ✅ All tests pass
9. ✅ No regressions in review workflow

## Implementation Notes

- Delete components first (Phase 1) to avoid confusion
- Add all handlers before passing props (prevents type errors)
- Test each phase before moving to next
- Commit frequently for easy rollback if needed
- SelectedCandidate receives ~30 new props (large but clear)
- UseArtifacts hook provides all generation logic (no new backend needed)