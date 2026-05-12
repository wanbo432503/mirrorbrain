# MirrorBrain Web UI - React Implementation

Modern React-based web interface for MirrorBrain, built with Tailwind CSS and an Apple-style control, review, and artifact inspection surface.

## Project Status

### Phase 1: Foundation Setup ✅ (Completed)
- React + TypeScript + Vite configuration
- Tailwind CSS with Apple-style design tokens
- Refined light/dark-ready product UI styling
- API client (15 methods, preserved logic)
- Types system (165+ types)

### Phase 2: Core Components ✅ (Completed)
- **Layout Components:**
  - `TabNavigation.tsx` - Memory/Review/Knowledge/Skill/Sources tabs with keyboard navigation
  - `FeedbackBanner.tsx` - Success/Error/Info messages with auto-dismiss
  - `Header.tsx` - App brand row aligned to the main content container with a light/dark theme toggle

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
  - `SyncActions.tsx` - Browser/Shell/Filesystem/Screenshot sync buttons
  - `MemoryList.tsx` - Paginated memory events list
  - `MemoryRecord.tsx` - Individual event display

- **Features:**
  - Load memory events from API once per app session and reuse global state across tab switches
  - Memory list displays newest events first
  - Memory tab requests 10 URL records per page by default
  - Memory content scrolls inside the active tab area instead of expanding the full page height
  - Browser sync runs against the backend; Shell / Filesystems / Screenshot buttons currently surface explicit not-configured info feedback until those runtimes are wired up
  - Pagination footer stays anchored at the bottom of the Memory tab with First / Previous / Next / Last controls
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
  - Create daily candidates for the current user-local calendar day
  - Review auto-generation waits until the first memory load finishes, avoiding concurrent heavy startup requests against OpenViking
  - Select candidate + view task title, duration, formation reasons, and concrete visited URLs split into primary/supporting sources
  - AI review suggestions (confidence/priority/rationale/keep score/supporting reasons)
  - Keep/Discard decisions
  - Reviewed memory display
  - Knowledge approval removes the approved draft's source candidates from the review list and persisted candidate storage
  - Review requests derive and send the user's IANA timezone so both the default review date and backend day boundary match the user's local calendar day
  - Memory, candidate, reviewed-memory, knowledge, and skill timestamps are stored as UTC ISO strings but rendered in the user's IANA timezone, with `Asia/Shanghai` as the fallback
  - Knowledge approval errors preserve the backend error detail in the review feedback banner
  - Candidate lists, selected candidate details, and draft editors stretch to available viewport height and scroll internally

### Phase 5: Knowledge / Skill Panels + Forms ✅ (Completed)
- **Artifacts Hooks:**
  - `useArtifacts.ts` - Artifact operations (generate/save)
  - `useKnowledgeDraft.ts` - Knowledge draft management
  - `useSkillDraft.ts` - Skill draft management

- **Form Components:**
  - `Input.tsx` - Text input
  - `TextArea.tsx` - Multi-line text input
  - `Checkbox.tsx` - Checkbox input

- **Knowledge / Skill Components:**
  - `KnowledgeTabPanel.tsx` - Knowledge tab container and graph loading
  - `KnowledgePanel.tsx` - Approved knowledge list, List/Graph subtabs, detail display, and local edit conversation notes
  - `SkillTabPanel.tsx` - Skill tab container
  - `SkillPanel.tsx` - Skill artifact timeline, detail display, and local edit conversation notes
  - `ArtifactsPanel.tsx` - Legacy combined artifacts tab container kept for compatibility while the top-level tab split settles
  - `SubtabNavigation.tsx` - History Topics / Draft Generation subtabs
  - `HistoryTable.tsx` - Legacy reusable history table
  - `HistoryTopics.tsx` - Legacy combined Knowledge / Skill artifact timeline
  - `KnowledgeGraphPanel.tsx` - SVG knowledge graph renderer supporting global and selected-artifact-focused views
  - `KnowledgeDetailModal.tsx` - Topic knowledge detail dialog
  - `CandidateContext.tsx` - Reviewed memory context
  - `DraftEditor.tsx` - Knowledge/Skill draft editor

  - **Features:**
  - Top-level Knowledge and Skill tabs replace the former combined Artifacts tab
  - Knowledge tab displays approved knowledge under stable left-side List / Graph subtabs
  - Knowledge List mode defaults the detail panel to the newest approved knowledge item and updates on item selection
  - Knowledge Graph mode defaults the right panel to the global knowledge graph and switches to a selected-artifact-centered SVG graph when a knowledge item is clicked
  - Skill tab displays generated skills in a separate timeline and detail panel
  - Artifact lists are ordered newest first using artifact update or review timestamps
  - Artifact timestamps are displayed in the user's IANA timezone instead of raw UTC ISO strings
  - The app loads persisted knowledge and skill artifacts on startup so the Knowledge and Skill tabs restore after refresh
  - Approved knowledge drafts are replaced by their published topic artifact in the Knowledge timeline, while older published topic versions remain available as history
  - Selecting a knowledge or skill shows its details in the corresponding right-side display
  - Knowledge details render the artifact body as Markdown with wiki-links, tags, related knowledge refs, lifecycle metadata, topic/version metadata, source refs, derived refs, and provenance refs
  - The artifact detail display includes a local conversation area for recording requested edits against the selected artifact
  - Generate knowledge from reviewed memories
  - Generate skill from reviewed memories
  - Generated knowledge and skill drafts remain in shared app state across top-level tab switches and are written back through the artifact API so refresh restores them; the service reads back from merged OpenViking and workspace copies so newly generated artifacts are not lost if OpenViking is briefly behind
  - Review-generated knowledge displays the final note body directly in a single scrolling field, with a separate full-width one-line revision request input and send action below it
  - Artifact edit message uses the same single-line full-width input + send row pattern in the knowledge and skill detail panels
  - Artifact history and detail panels stretch to the available tab height and scroll internally instead of using fixed pixel heights
  - Draft editing (body-first note editing for knowledge)
  - Draft editing (approval state/confirmation for skill)
  - Save artifacts to API

### Phase 6-7: Remaining Work
- Testing (unit + integration + E2E) (Phase 6)
- Deployment + documentation (Phase 7)

### Current Phase 4: Source Management Surface
- **Source Components:**
  - `SourceManagementPanel.tsx` - Source status, audit, recent memory placeholder, and settings surface for Phase 4 ledger imports

- **Features:**
  - Top-level Sources tab for operational source inspection
  - Source instance list backed by `/sources/status`
  - Recent memory records backed by `/memory` source filters
  - Source-specific audit events backed by `/sources/audit`
  - Enable / disable source action backed by `/sources/config`
  - Manual `Import Now` action backed by `/sources/import`
  - Operational source UI remains separate from memory, knowledge, and skill outputs

## Design System

### Typography
- **Headings:** Apple-style tight sans-serif scale
- **Body:** Apple-style 17px readable body rhythm

### Colors
- Background: `canvas.parchment` (`#f5f5f7`)
- Primary surface: `canvas` (`#ffffff`)
- Primary text: `ink` (`#1d1d1f`)
- Muted text: `inkMuted`
- Accent/CTA: Apple blue (`#0066cc` / `#0071e3`)

### Visual Style: Apple-Inspired Control Surface
- Calm light canvas with restrained product panels
- Tight typography, soft borders, and clear primary actions
- Light and dark themes driven by `data-theme` design tokens, with a header toggle for switching modes
- Full-screen flex layout where each tab owns its scrollable content regions

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
│   │   ├── artifacts/     # (Phase 5)
│   │   └── sources/       # Source Management UI
│   ├── hooks/             # useMirrorBrainState, useMemoryEvents, etc. (Phase 3-5)
│   ├── api/               # client.ts (API methods)
│   ├── contexts/          # MirrorBrainContext (Phase 3)
│   ├── types/             # 165+ TypeScript interfaces
│   ├── styles/            # Tailwind CSS base styles
│   └ tests/               # Component + integration tests (Phase 6)
│   ├── App.tsx            # Root component
│   └── main.tsx           # Entry point
```

## API Integration

Core API methods include:

1. `getHealth()` - Service status check
2. `listMemory()` - Memory events list
3. `importSourceLedgers()` - Phase 4 source-ledger import
4. `syncShell()` - Shell memory sync
5. `createDailyCandidates()` - Create candidates
6. `suggestCandidateReviews()` - AI suggestions
7. `reviewCandidateMemory()` - Keep/Discard candidate
8. `listKnowledge()` - Knowledge artifacts
9. `listKnowledgeTopics()` - Knowledge topics
10. `generateKnowledge()` - Generate knowledge and immediately expose the generated draft in shared artifact state
11. `saveKnowledgeArtifact()` - Save edited knowledge draft; follow-up save failures must not hide a draft that generation already returned
12. `listSkills()` - Skill artifacts
13. `generateSkill()` - Generate skill
14. `saveSkillArtifact()` - Save skill draft
15. `listReviewedMemories()` - Reviewed memories
16. `listSourceAuditEvents()` - List operational source audit records
17. `listSourceStatuses()` - List source instance status summaries
18. `analyzeWorkSessions()` - Run Phase 4 manual work-session analysis
19. `reviewWorkSessionCandidate()` - Keep or discard a work-session candidate with explicit project assignment

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
   - Click "Import Sources" to import source-ledger events, including browser events recorded as daily JSONL ledgers
   - Click "Sync Shell" to import shell events
   - Navigate through pagination

2. **Review Tab:**
   - Click "Review" tab
   - Click "Create Daily Candidates" to generate candidates for yesterday in your local timezone
   - Click candidates to view details
   - Review AI suggestions (confidence/priority/rationale)
   - Click "Keep Candidate" or "Discard Candidate"

3. **Work Sessions Tab:**
   - Click an analysis window
   - Confirm or edit the project name on a candidate
   - Click "Keep as project" or "Discard"

4. **Knowledge / Skill Tabs:**
   - Click the "Knowledge" tab to browse approved knowledge in List mode or switch to Graph mode
   - In Knowledge Graph mode, leave the list unselected for the global graph or click a knowledge item for a centered graph
   - Click the "Skill" tab to browse generated skills separately
   - Select an artifact to inspect its detail panel and local edit conversation notes
   - Keep generating knowledge and skill from the Review tab, where drafts are written back through the artifact API so they survive refresh

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
| 5. Knowledge / Skill Panels | Week 5-6 | ✅ Completed |
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
- Knowledge / Skill Components: 12 files
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
