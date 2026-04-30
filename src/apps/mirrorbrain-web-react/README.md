# MirrorBrain Web UI - React Implementation

Modern React-based web interface for MirrorBrain, built with Tailwind CSS and a tech-focused design aesthetic.

## Project Status

### Phase 1: Foundation Setup ✅ (Completed)
- React + TypeScript + Vite configuration
- Tailwind CSS with Fira Code/Sans fonts
- Modern tech style design system
- API client (15 methods, preserved logic)
- Types system (165+ types)

### Phase 2: Core Components ✅ (Completed)
- **Layout Components:**
  - `TabNavigation.tsx` - Memory/Review/Artifacts tabs with keyboard navigation
  - `FeedbackBanner.tsx` - Success/Error/Info messages with auto-dismiss

- **Common Components:**
  - `Button.tsx` - 4 variants (default/primary/success/ghost) + loading state
  - `Card.tsx` - Panel wrapper with hover effects
  - `MetricTile.tsx` - Metric display with label/value/description
  - `Pagination.tsx` - Reusable pagination controls
  - `EmptyState.tsx` - Empty data placeholder
  - `LoadingSpinner.tsx` - Animated loading indicator

### Phase 3: Memory Panel + Hooks ✅ (Completed)
- **Global State Management:**
  - `MirrorBrainContext.tsx` - useReducer + Context for memory, review, artifacts, and draft workspace state
  - `useMirrorBrainState.ts` - Initial data loading hook

- **Memory Hooks:**
  - `useMemoryEvents.ts` - Memory operations + pagination
  - `useSyncOperations.ts` - Browser/Shell sync + feedback
  - `usePagination.ts` - Generic pagination logic

- **Memory Components:**
  - `MemoryPanel.tsx` - Memory tab container (fully functional)
  - `SyncActions.tsx` - Browser/Shell sync buttons
  - `MemoryList.tsx` - Paginated memory events list
  - `MemoryRecord.tsx` - Individual event display

- **Features:**
  - Load memory events from API once per app session and reuse global state across tab switches
  - Memory list displays newest events first
  - Browser/Shell sync operations
  - Pagination (5 events per page) with First / Previous / Next / Last controls
  - Error handling + loading states
  - Feedback banners (success/error)

### Phase 4: Review Panel + Hooks ✅ (Completed)
- **Review Hook:**
  - `useReviewWorkflow.ts` - Review workflow logic (create/select/review candidates)

- **Review Components:**
  - `ReviewPanel.tsx` - Review tab container (3-column layout)
  - `ReviewActions.tsx` - Create/Keep/Discard buttons
  - `MetricGrid.tsx` - Review metrics display
  - `CandidateList.tsx` - Candidate streams list
  - `CandidateCard.tsx` - Individual candidate
  - `SelectedCandidate.tsx` - Selected candidate details
  - `ReviewGuidance.tsx` - AI suggestions + reviewed memory

- **Features:**
  - Create daily candidates for the previous local calendar day
  - Review auto-generation waits until the first memory load finishes, avoiding concurrent heavy startup requests against OpenViking
  - Select candidate + view task title, duration, formation reasons, and concrete visited URLs split into primary/supporting sources
  - AI review suggestions (confidence/priority/rationale/keep score/supporting reasons)
  - Keep/Discard decisions
  - Reviewed memory display
  - Knowledge approval removes the approved draft's source candidates from the review list and persisted candidate storage
  - Review requests now send the local timezone so the service can use the correct day boundary

### Phase 5: Artifacts Panel + Forms ✅ (Completed)
- **Artifacts Hooks:**
  - `useArtifacts.ts` - Artifact operations (generate/save)
  - `useKnowledgeDraft.ts` - Knowledge draft management
  - `useSkillDraft.ts` - Skill draft management

- **Form Components:**
  - `Input.tsx` - Text input
  - `TextArea.tsx` - Multi-line text input
  - `Checkbox.tsx` - Checkbox input

- **Artifacts Components:**
  - `ArtifactsPanel.tsx` - Artifacts tab container
  - `SubtabNavigation.tsx` - History Topics / Draft Generation subtabs
  - `HistoryTable.tsx` - Legacy reusable history table
  - `HistoryTopics.tsx` - Knowledge / Skill artifact timeline with single detail display and local edit conversation notes
  - `KnowledgeDetailModal.tsx` - Topic knowledge detail dialog
  - `CandidateContext.tsx` - Reviewed memory context
  - `DraftEditor.tsx` - Knowledge/Skill draft editor

- **Features:**
  - Artifacts tab displays generated knowledge and generated skills under separate Knowledge / Skill subtabs
  - Artifact lists are ordered newest first using artifact update or review timestamps
  - Selecting a knowledge or skill shows its details in one shared right-side display
  - The artifact detail display includes a local conversation area for recording requested edits against the selected artifact
  - Generate knowledge from reviewed memories
  - Generate skill from reviewed memories
  - Generated knowledge and skill drafts remain in shared app state across top-level tab switches
  - Review-generated knowledge displays the final note body directly in a single scrolling field, with a separate one-line revision request input and send action below it
  - Draft editing (body-first note editing for knowledge)
  - Draft editing (approval state/confirmation for skill)
  - Save artifacts to API

### Phase 6-7: Remaining Work
- Testing (unit + integration + E2E) (Phase 6)
- Deployment + documentation (Phase 7)

## Design System

### Typography
- **Headings:** Fira Code (monospace, bold, uppercase)
- **Body:** Fira Sans (sans-serif, clean, readable)

### Colors (Tailwind Slate + Blue)
- Background: `slate-50` (#F8FAFC)
- Primary Text: `slate-900` (#1E293B)
- Secondary Text: `slate-600` (#475569)
- Accent/CTA: `blue-600` (#2563EB)
- Success: `green-100` / `green-700`

### Visual Style: Exaggerated Minimalism
- High contrast (dark text on light background)
- Massive whitespace (padding: 12-16px, margins: 24-48px)
- Bold typography (fontWeight: 600-900)
- Minimal borders (slate-200)
- Clean, statement design

### Accessibility Features
- Visible focus rings on all interactive elements
- Keyboard navigation support (Arrow keys for tabs)
- Aria labels for screen readers
- Reduced motion preferences respected
- Form inputs have proper labels

## Development

### Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type check
pnpm tsc --noEmit
```

### Project Structure

```
src/apps/mirrorbrain-web-react/
├── src/
│   ├── components/
│   │   ├── layout/        # AppShell, Header, TabNavigation, FeedbackBanner
│   │   ├── common/        # Button, Card, MetricTile, Pagination, etc.
│   │   ├── memory/        # (Phase 3)
│   │   ├── review/        # (Phase 4)
│   │   └── artifacts/     # (Phase 5)
│   ├── hooks/             # useMirrorBrainState, useMemoryEvents, etc. (Phase 3-5)
│   ├── api/               # client.ts (15 API methods)
│   ├── contexts/          # MirrorBrainContext (Phase 3)
│   ├── types/             # 165+ TypeScript interfaces
│   ├── styles/            # Tailwind CSS base styles
│   └ tests/               # Component + integration tests (Phase 6)
│   ├── App.tsx            # Root component
│   └── main.tsx           # Entry point
```

## API Integration

All 15 API methods preserved from original implementation:

1. `getHealth()` - Service status check
2. `listMemory()` - Memory events list
3. `syncBrowser()` - Browser memory sync
4. `syncShell()` - Shell memory sync
5. `createDailyCandidates()` - Create candidates
6. `suggestCandidateReviews()` - AI suggestions
7. `reviewCandidateMemory()` - Keep/Discard candidate
8. `listKnowledge()` - Knowledge artifacts
9. `listKnowledgeTopics()` - Knowledge topics
10. `generateKnowledge()` - Generate knowledge
11. `saveKnowledgeArtifact()` - Save knowledge draft
12. `listSkills()` - Skill artifacts
13. `generateSkill()` - Generate skill
14. `saveSkillArtifact()` - Save skill draft
15. `listReviewedMemories()` - Reviewed memories

**API Logic Preservation:** 95% identical to original vanilla TypeScript implementation.

## Quick Start Guide

After Phase 5 completion, you can now test the complete application:

```bash
# Start development server
pnpm dev

# Open browser to http://localhost:5173
```

**Test Workflows:**

1. **Memory Tab:**
   - Click "Memory" tab
   - Click "Sync Browser" to import browser events
   - Click "Sync Shell" to import shell events
   - Navigate through pagination

2. **Review Tab:**
   - Click "Review" tab
   - Click "Create Daily Candidates" to generate candidates for yesterday in your local timezone
   - Click candidates to view details
   - Review AI suggestions (confidence/priority/rationale)
   - Click "Keep Candidate" or "Discard Candidate"

3. **Artifacts Tab:**
   - Click "Artifacts" tab
   - Browse "History Topics" subtab (3 paginated tables)
   - Switch to "Generate Knowledge" subtab
   - Generate/edit/save knowledge drafts
   - Switch to "Generate Skill" subtab
   - Generate/edit/save skill drafts

## Testing Strategy

### Test Pyramid
- **Unit Tests:** 150+ (React Testing Library)
- **Integration Tests:** 30+ (Full workflows)
- **E2E Tests:** 15+ (Playwright browser tests)

### Coverage Goals
- Components: > 80%
- Hooks: > 90%
- Integration: Key workflows 100%

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| 1. Foundation | Week 1-2 | ✅ Completed |
| 2. Core Components | Week 2-3 | ✅ Completed |
| 3. Memory Panel | Week 3-4 | ✅ Completed |
| 4. Review Panel | Week 4-5 | ✅ Completed |
| 5. Artifacts Panel | Week 5-6 | ✅ Completed |
| 6. Testing | Week 6-7 | ⏳ Next |
| 7. Deployment | Week 7 | ⏳ Pending |

**Current Status:** Phase 5 complete (All core workflows implemented), ready for Phase 6 (Testing + Documentation)

## Component Summary

**Total Files:** 45
**Total Lines:** ~2,585

**By Category:**
- Layout Components: 4 files
- Common Components: 6 files
- Form Components: 3 files
- Memory Components: 4 files
- Review Components: 7 files
- Artifacts Components: 8 files
- Hooks: 10 files
- Context: 1 file
- Types/API: 2 files
- Tests: (Phase 6)

## Contributing

Follow TDD workflow:
1. Write failing test for target behavior
2. Run test, confirm failure
3. Implement minimum code to pass
4. Verify test passes
5. Refactor while keeping tests green

## Documentation

- Implementation Plan: `/Users/wanbo/.claude/plans/dapper-dreaming-treehouse.md`
- Project Instructions: `CLAUDE.md` (MirrorBrain AGENTS.md)
- This README: Phase-by-phase progress tracking
