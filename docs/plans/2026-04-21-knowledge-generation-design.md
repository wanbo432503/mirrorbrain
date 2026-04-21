# Knowledge Generation Feature Design

## Summary

Transform reviewed candidate memories into structured, intelligent knowledge notes through LLM-powered analysis. The system retrieves source content, analyzes it to classify note types, generates knowledge around a central theme, and auto-integrates into the topic knowledge system upon approval.

## Design Decisions

**Content retrieval:** Hybrid approach - prefer pre-captured browser page content artifacts from sync workflow, fall back to live URL fetching if artifact unavailable. More reliable, preserves what user actually saw.

**Note type classification:** Auto-classify by LLM analysis of page content patterns. Types: workflow, tutorial, insight report, development record. No manual user selection.

**Topic assignment:** Automatic analysis-based assignment. System analyzes theme/title, assigns to existing topic with matching keywords, or creates new topic if no match. No manual topic selection required.

**Regeneration behavior:** Iterative refinement. Use existing draft as additional context, ask LLM to improve/expand/adjust rather than starting fresh.

**Approval flow:** Direct approval without intermediate confirmation. Clicking "Approved" immediately promotes draft, assigns topic, and clears workspace.

**Architecture:** New isolated module for LLM orchestration. Clean separation between LLM logic and storage/retrieval concerns.

## Backend Architecture

### New Module: `src/modules/knowledge-generation-llm/`

**Responsibilities:**
- Content retrieval coordination (hybrid: artifacts + fallback fetch)
- LLM-powered knowledge extraction and synthesis
- Note type classification (workflow, tutorial, insight report, development record)
- Theme identification from URL content analysis
- Draft refinement for regeneration requests

**Key functions:**

```typescript
// Main generation entry point
generateKnowledgeFromReviewedMemories(
  reviewedMemories: ReviewedMemory[],
  existingDraft?: KnowledgeArtifact
): Promise<KnowledgeArtifact>

// Hybrid content retrieval
retrievePageContent(memoryEventId: string): Promise<string>

// LLM classification
classifyNoteType(content: string): Promise<'workflow' | 'tutorial' | 'insight-report' | 'development-record'>

// Theme extraction for topic assignment
extractThemeFromUrls(urls: string[]): Promise<string>
```

**Implementation notes:**
- Use existing `loadBrowserPageContentArtifactFromWorkspace()` for artifact retrieval
- Implement fallback fetcher for live URLs (respect privacy boundaries, handle failures gracefully)
- LLM prompts structured for each note type with specific output templates
- Classification logic based on content patterns (step-by-step → tutorial, repeated actions → workflow, problem-solving → development, analysis/observation → insight)

### Service Layer Integration

Extend `src/apps/mirrorbrain-service/index.ts`:

```typescript
// New service methods
generateKnowledgeFromReviewedMemories(reviewedMemories: ReviewedMemory[]): Promise<KnowledgeArtifact>
regenerateKnowledgeDraft(draftId: string, reviewedMemories: ReviewedMemory[]): Promise<KnowledgeArtifact>
approveKnowledgeDraft(draftId: string): Promise<{
  publishedArtifact: KnowledgeArtifact,
  assignedTopic: { topicKey: string, title: string }
}>
saveKnowledgeDraft(draft: KnowledgeArtifact): Promise<KnowledgeArtifact>
```

**Storage:**
- Use existing `ingestKnowledgeArtifactToOpenViking()` for persistence
- Draft artifacts stored with `artifactType: 'daily-review-draft'`, `draftState: 'draft'`
- Published artifacts transition to `artifactType: 'topic-knowledge'`, `draftState: 'published'`

**Topic integration:**
- Use existing `mergeDailyReviewIntoTopicKnowledge()` workflow
- Auto-generate topic key from extracted theme via `slugifyTopicKey()`
- Create version history: v1 for new topics, increment version for existing
- Set `isCurrentBest: true` for new published version, supersede previous current-best

**Workspace clearing:**
- After approval: clear knowledge draft from context
- Clear reviewed memories with `decision='keep'` from state
- Preserve discard decisions for audit trail

## API Contract

### Enhanced Existing Endpoint

```
POST /knowledge/generate
Body: { reviewedMemories: ReviewedMemory[] }
Response: { artifact: KnowledgeArtifact }
```

**Behavior:**
- Calls new LLM module for intelligent generation
- Retrieves page content via hybrid strategy
- Auto-classifies note type, embeds classification in body structure
- Returns draft artifact with `draftState: 'draft'`

### New Endpoints

```
POST /knowledge/regenerate
Body: {
  existingDraft: KnowledgeArtifact,
  reviewedMemories: ReviewedMemory[]
}
Response: { artifact: KnowledgeArtifact }
```

**Behavior:**
- Refinement generation with existing draft context
- LLM receives current draft as additional input
- Improves/adjusts based on existing structure
- Returns updated draft

```
POST /knowledge/approve
Body: { draftId: string }
Response: {
  publishedArtifact: KnowledgeArtifact,
  assignedTopic: { topicKey: string, title: string }
}
```

**Behavior:**
- Promotes draft to published state
- Auto-assigns to topic (creates new topic if needed)
- Returns topic assignment info for UI feedback
- Clears workspace: removes draft and kept reviewed memories from context
- Preserves audit trail for review decisions

```
POST /knowledge/save
Body: { artifact: KnowledgeArtifact }
Response: { artifact: KnowledgeArtifact }
```

**Behavior:**
- Saves edited draft without approval
- Keeps `draftState: 'draft'`
- Preserves existing topic assignment metadata if present
- Does not clear workspace

### Draft State Management

**Lifecycle:**
- Generated draft: `artifactType: 'daily-review-draft'`, `draftState: 'draft'`
- After approval: `artifactType: 'topic-knowledge'`, `draftState: 'published'`
- Topic version: `version` increments, `isCurrentBest: true`, `supersedesKnowledgeId` references previous
- Provenance preserved: `sourceReviewedMemoryIds`, `provenanceRefs` link back to reviewed inputs

## Frontend Integration

### ArtifactsPanel State Management

**Extend MirrorBrainContext:**

```typescript
interface MirrorBrainState {
  // Existing
  reviewedMemories: ReviewedMemory[]
  // New
  knowledgeDraft: KnowledgeArtifact | null
  skillDraft: SkillArtifact | null
  isGeneratingKnowledge: boolean
  isRegeneratingKnowledge: boolean
  isSavingKnowledge: boolean
  isApprovingKnowledge: boolean
}
```

**New action types:**
- `SET_KNOWLEDGE_DRAFT` - set generated/regenerated draft
- `CLEAR_KNOWLEDGE_DRAFT` - clear after approval
- `CLEAR_KEPT_REVIEWED_MEMORIES` - remove kept memories after approval

### ArtifactsPanel Handlers

```typescript
// In ArtifactsPanel or parent component
const handleGenerateKnowledge = async () => {
  const keptMemories = reviewedMemories.filter(m => m.decision === 'keep')
  setIsGeneratingKnowledge(true)

  const response = await fetch('/knowledge/generate', {
    method: 'POST',
    body: JSON.stringify({ reviewedMemories: keptMemories })
  })

  const { artifact } = await response.json()
  setKnowledgeDraft(artifact)
  setIsGeneratingKnowledge(false)
}

const handleRegenerateKnowledge = async () => {
  if (!knowledgeDraft) return

  setIsRegeneratingKnowledge(true)
  const keptMemories = reviewedMemories.filter(m => m.decision === 'keep')

  const response = await fetch('/knowledge/regenerate', {
    method: 'POST',
    body: JSON.stringify({
      existingDraft: knowledgeDraft,
      reviewedMemories: keptMemories
    })
  })

  const { artifact } = await response.json()
  setKnowledgeDraft(artifact)
  setIsRegeneratingKnowledge(false)
}

const handleSaveKnowledge = async () => {
  if (!knowledgeDraft) return

  setIsSavingKnowledge(true)

  const response = await fetch('/knowledge/save', {
    method: 'POST',
    body: JSON.stringify({ artifact: knowledgeDraft })
  })

  const { artifact } = await response.json()
  setKnowledgeDraft(artifact) // Update with any server-side changes
  setIsSavingKnowledge(false)
}

const handleApproveKnowledge = async () => {
  if (!knowledgeDraft?.id) return

  setIsApprovingKnowledge(true)

  const response = await fetch('/knowledge/approve', {
    method: 'POST',
    body: JSON.stringify({ draftId: knowledgeDraft.id })
  })

  const { publishedArtifact, assignedTopic } = await response.json()

  // Clear workspace
  setKnowledgeDraft(null)
  setReviewedMemories(prev => prev.filter(m => m.decision !== 'keep'))

  // Show success feedback
  showFeedback({
    kind: 'success',
    message: `Knowledge published and assigned to topic: ${assignedTopic.title}`
  })

  setIsApprovingKnowledge(false)
}
```

### DraftEditor Component

**Knowledge mode button logic:**

```tsx
// In DraftEditor.tsx knowledge mode section
{!draft && (
  <Button
    variant="primary"
    onClick={onGenerate}
    loading={isGenerating}
    disabled={isGenerating}
  >
    {isGenerating ? 'Generating...' : 'Generate Draft'}
  </Button>
)}

{draft && (
  <>
    <Button
      variant="ghost"
      onClick={onGenerate} // Regenerate handler
      loading={isGenerating}
      disabled={isGenerating || isSaving}
    >
      Regenerate
    </Button>
    <Button
      variant="success"
      onClick={onApprove}
      loading={isApproving}
      disabled={isApproving || isSaving || isGenerating}
    >
      {isApproving ? 'Approving...' : 'Approved'}
    </Button>
    <Button
      variant="primary"
      onClick={onSave}
      loading={isSaving}
      disabled={isSaving || isGenerating || isApproving}
    >
      {isSaving ? 'Saving...' : 'Save'}
    </Button>
  </>
)}
```

**Editor fields:**
- Markdown textarea for `body` content (existing)
- Note type badge extracted from body structure (new visual indicator)
- Inline editable title/summary in header area (optional enhancement)

### HistoryTopics Modal Feature

**Add click handler:**

```tsx
// In HistoryTopics.tsx
const [selectedTopic, setSelectedTopic] = useState<KnowledgeArtifact | null>(null)

const handleTopicClick = async (topicKey: string) => {
  const response = await fetch(`/knowledge/topics/${topicKey}`)
  const { topic } = await response.json()
  setSelectedTopic(topic)
}

// Update HistoryTable to accept onClick handler
<HistoryTable
  title="Knowledge Topics"
  items={topicsItems}
  onItemClick={(id) => handleTopicClick(id)}
  currentPage={topicsPage}
  totalPages={Math.ceil(knowledgeTopics.length / HISTORY_PAGE_SIZE)}
  onPageChange={setTopicsPage}
/>
```

**Modal component:**

```tsx
// New KnowledgeDetailModal component
interface KnowledgeDetailModalProps {
  knowledge: KnowledgeArtifact | null
  onClose: () => void
}

function KnowledgeDetailModal({ knowledge, onClose }: KnowledgeDetailModalProps) {
  if (!knowledge) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <h2 className="font-heading font-bold text-xl text-slate-900">
              {knowledge.title}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <p className="font-body text-sm text-slate-600">
              {knowledge.summary}
            </p>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="prose prose-sm max-w-none">
                {/* Render markdown body */}
                <ReactMarkdown>{knowledge.body}</ReactMarkdown>
              </div>
            </div>

            <div className="text-xs font-body text-slate-500">
              <p>Version: {knowledge.version}</p>
              <p>Updated: {knowledge.recencyLabel}</p>
              <p>Sources: {knowledge.sourceReviewedMemoryIds.length} reviewed memories</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

## Knowledge Note Type Templates

Each note type has specific structure embedded in body markdown:

**Workflow template:**
```markdown
# [Theme/Task Name]

## Overview
[Brief description of when/why this workflow is useful]

## Steps
1. [First action]
2. [Second action]
...

## Evidence
- [Link to reviewed memory showing workflow execution]

## Notes
[Any caveats or variations observed]
```

**Tutorial template:**
```markdown
# [Topic/Tool Name] Setup Guide

## Prerequisites
- [Required setup before starting]

## Installation Steps
1. [Step with details]
...

## Verification
[How to confirm setup succeeded]

## Troubleshooting
[Common issues and solutions observed]

## Sources
- [Primary reference URL]
```

**Insight Report template:**
```markdown
# [Insight/Observation Title]

## Key Finding
[Core insight or pattern noticed]

## Evidence
[Data or observations supporting the insight]

## Implications
[What this means for future work]

## Context
[Background from reviewed activity]

## References
- [Source URLs for deeper reading]
```

**Development Record template:**
```markdown
# [Feature/Change Title] Development Log

## Problem
[Issue or requirement being addressed]

## Approach
[Solution strategy chosen]

## Implementation
[Key decisions and steps taken]

## Results
[Outcome and verification]

## Lessons Learned
[What worked or didn't]

## Related Work
- [Links to related reviewed activities]
```

## Testing Strategy

### Unit Tests

**`src/modules/knowledge-generation-llm/` tests:**
- `classifyNoteType()` - test classification logic with sample content patterns
- `extractThemeFromUrls()` - test theme extraction from URL arrays
- `retrievePageContent()` - test hybrid retrieval (artifact + fallback)
- Mock LLM responses for generation tests

### Integration Tests

**Service integration:**
- `POST /knowledge/generate` - test end-to-end generation with reviewed memories
- `POST /knowledge/regenerate` - test refinement with existing draft
- `POST /knowledge/approve` - test promotion, topic assignment, workspace clearing
- `POST /knowledge/save` - test draft persistence without approval

**Topic integration:**
- Approve draft → verify topic created or existing topic version incremented
- Verify `isCurrentBest` and `supersedesKnowledgeId` relationships
- Verify provenance links preserved

### End-to-End Tests

**Playwright user flow:**
1. Start service, load memory events
2. Create candidates, review and keep at least one
3. Navigate to Artifacts → Draft Generation
4. Verify reviewed memories appear in Source Context
5. Click Generate → verify knowledge draft appears
6. Edit draft body content
7. Click Regenerate → verify refinement
8. Click Approved → verify success toast with topic info
9. Navigate to History Topics → verify new knowledge appears
10. Click topic row → verify modal shows full content
11. Verify Source Context and Knowledge Draft are cleared

## Implementation Notes

**LLM provider choice:**
- Follow existing project patterns if LLM integration exists
- Default to Claude API via Anthropic SDK if no existing pattern
- Use prompt caching for efficiency on repeated similar requests
- Handle rate limits and failures gracefully

**Privacy boundaries:**
- Content retrieval respects authorization scopes
- Live URL fetching only for URLs in authorized reviewed memories
- No arbitrary web scraping outside captured scope
- Fail gracefully if URLs unavailable or require authentication

**Error handling:**
- Generation failures show user-friendly error feedback
- Regeneration preserves previous draft if refinement fails
- Approval failures preserve draft state for retry
- Save failures show error but keep editor content

**Performance considerations:**
- Content retrieval parallelized for multiple reviewed memories
- LLM response streaming if provider supports (better UX for long generations)
- Cache retrieved content artifacts for regeneration reuse
- Debounce auto-save on editor changes (optional future enhancement)

## Open Questions

- Exact LLM provider and model selection for generation
- Maximum content length limits for LLM input
- How to handle reviewed memories with no URL content (e.g., shell-only memories)
- Whether to support multi-language knowledge generation
- Retention policy for draft artifacts that never get approved

## Success Criteria

- User can generate knowledge from reviewed memories with single click
- Generated knowledge shows appropriate note type classification
- Regeneration improves draft without losing useful content
- Approval correctly integrates into topic knowledge system
- Topic click modal shows full content for review
- Workspace clearing prevents confusion with stale draft state
- End-to-end Playwright test validates complete flow
- Unit and integration tests cover key business logic
- Privacy and authorization boundaries preserved throughout