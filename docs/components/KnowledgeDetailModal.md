# KnowledgeDetailModal Component

## Summary

Modal component for displaying full knowledge artifact details in the MirrorBrain history topics interface.

## Responsibility Boundary

This component is responsible for:
- Rendering a modal overlay with complete knowledge artifact content
- Displaying metadata (version, timestamps, source count, topic key)
- Showing draft state and current-best status badges
- Providing close functionality for modal dismissal

This component is NOT responsible for:
- Knowledge artifact retrieval (handled by HistoryTopics parent)
- Knowledge editing or modification
- Knowledge approval workflows
- Knowledge version history navigation

## Key Interfaces

```typescript
interface KnowledgeDetailModalProps {
  knowledge: KnowledgeArtifact | null
  onClose: () => void
}

interface KnowledgeArtifact {
  id?: string
  artifactType: 'topic-knowledge' | 'daily-review-draft'
  draftState: 'draft' | 'published'
  topicKey?: string
  title?: string
  summary?: string
  body?: string
  version?: number
  isCurrentBest?: boolean
  sourceReviewedMemoryIds: string[]
  createdAt?: string
  updatedAt?: string
  provenanceRefs: string[]
  supersedesKnowledgeId?: string
}
```

## Data Flow

```
HistoryTopics (parent)
  ↓
  [click on knowledge topic row]
  ↓
  fetch /knowledge/topics/:topicKey
  ↓
  setSelectedTopic(artifact)
  ↓
  KnowledgeDetailModal
    - Render modal with artifact content
    - User clicks Close
    - onClose() → setSelectedTopic(null)
  ↓
  Modal dismissed
```

## Dependencies

- React (hooks: none, just props)
- Button component from `../common/Button`
- KnowledgeArtifact type from `../../types/index`

## Failure Modes

**No knowledge data:**
- When `knowledge` prop is `null`, component renders nothing
- Prevents empty modal display

**Missing optional fields:**
- Title defaults to "Untitled Knowledge"
- Summary defaults to "No summary available"
- Body defaults to "No body content available"
- Version defaults to "N/A"
- Timestamp formatting handles invalid dates gracefully with fallback

## Test Strategy

**Unit tests (Vitest):**
- Component renders nothing when knowledge is null
- Component renders title when provided
- Component renders Close button
- Component renders Published/Draft badges based on draftState
- Component renders Current Best badge when isCurrentBest is true
- Close button triggers onClose callback

**Integration tests:**
- Covered by HistoryTopics parent component tests
- Modal integration with topic click handler

**Manual testing:**
1. Navigate to Artifacts → History Topics tab
2. Click on a knowledge topic row
3. Verify modal appears with full content
4. Verify Close button dismisses modal
5. Verify backdrop click dismisses modal
6. Verify all metadata fields display correctly
7. Verify badges match artifact state

## Known Risks and Limitations

**Risk: Modal overlay accessibility**
- Currently no explicit focus trap or keyboard navigation
- User must click Close button or backdrop to dismiss
- Future enhancement: Add ESC key dismiss and focus management

**Limitation: Large body content rendering**
- Body content rendered as plain text in `<pre>` tag
- No markdown rendering for structured body content
- Future enhancement: Add markdown rendering support

**Limitation: No version history navigation**
- Modal shows single artifact version
- Cannot navigate to previous versions from modal
- Future enhancement: Add version history timeline view

## Component Location

`src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeDetailModal.tsx`

## Usage Example

```tsx
import KnowledgeDetailModal from './KnowledgeDetailModal'

// In parent component
const [selectedTopic, setSelectedTopic] = useState<KnowledgeArtifact | null>(null)

// Render modal
<KnowledgeDetailModal
  knowledge={selectedTopic}
  onClose={() => setSelectedTopic(null)}
/>
```