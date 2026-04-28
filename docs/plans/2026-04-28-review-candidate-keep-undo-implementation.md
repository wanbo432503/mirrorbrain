# Review Candidate Keep/Undo Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement dual-mode review UI with kept candidates list and undo functionality that reverts backend review decisions.

**Architecture:** Backend adds DELETE endpoint for reviewed memories. Frontend tracks kept candidates separately, switches between detail/kept-list views, and supports undo operations through API calls and state management.

**Tech Stack:** TypeScript, React, Vitest, Fastify, Node.js fs/promises

---

## Phase 1: Backend

### Task 1: Add undoCandidateReview to HTTP Server Interface

**Files:**
- Modify: `src/apps/mirrorbrain-http-server/index.ts:21-86`

**Step 1: Add interface method**

Add to `MirrorBrainHttpService` interface after `reviewCandidateMemory`:

```typescript
reviewCandidateMemory(
  candidate: CandidateMemory,
  review: {
    decision: ReviewedMemory['decision'];
    reviewedAt: string;
  },
): Promise<ReviewedMemory>;
undoCandidateReview(reviewedMemoryId: string): Promise<void>;
```

**Step 2: Verify interface compiles**

Run: `cd src/apps/mirrorbrain-http-server && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-http-server/index.ts
git commit -m "feat: add undoCandidateReview to HTTP service interface"
```

---

### Task 2: Implement undoCandidateReview Service Function

**Files:**
- Modify: `src/apps/mirrorbrain-service/index.ts:68-78, 104-146, 301-857`

**Step 1: Add dependencies import**

Add `unlink` to existing imports at line 68:

```typescript
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
```

**Step 2: Add to CreateMirrorBrainServiceDependencies interface**

Add after line 131:

```typescript
publishReviewedMemory?: typeof ingestReviewedMemoryToOpenViking;
undoReviewedMemory?: (reviewedMemoryId: string, workspaceDir: string) => Promise<void>;
```

**Step 3: Implement undo service function in createMirrorBrainService**

Add after the `reviewCandidateMemory` function (around line 755):

```typescript
undoCandidateReview: async (reviewedMemoryId: string): Promise<void> => {
  const reviewedFilePath = join(
    workspaceDir,
    'mirrorbrain',
    'reviewed-memories',
    `${reviewedMemoryId}.json`
  );

  try {
    await unlink(reviewedFilePath);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      // File doesn't exist - already deleted, treat as success
      return;
    }
    throw error;
  }
},
```

**Step 4: Verify service compiles**

Run: `cd src/apps/mirrorbrain-service && npx tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/apps/mirrorbrain-service/index.ts
git commit -m "feat: implement undoCandidateReview service function"
```

---

### Task 3: Add HTTP DELETE Endpoint

**Files:**
- Modify: `src/apps/mirrorbrain-http-server/index.ts:924-969`

**Step 1: Add DELETE endpoint after POST /reviewed-memories**

Add after line 969 (after the POST endpoint):

```typescript
app.delete<{ Params: { id: string } }>(
  '/reviewed-memories/:id',
  {
    schema: {
      summary: 'Undo a candidate memory review by deleting the reviewed memory',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        204: { type: 'null' },
        404: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
      }
    }
  },
  async (request, reply) => {
    try {
      await input.service.undoCandidateReview(request.params.id);
      reply.code(204);
    } catch (error) {
      reply.code(404);
      return {
        message: `Reviewed memory ${request.params.id} not found`,
      };
    }
  }
);
```

**Step 2: Verify endpoint compiles**

Run: `cd src/apps/mirrorbrain-http-server && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-http-server/index.ts
git commit -m "feat: add DELETE /reviewed-memories/:id endpoint"
```

---

### Task 4: Write Backend Tests for undoCandidateReview

**Files:**
- Modify: `src/apps/mirrorbrain-http-server/index.test.ts`

**Step 1: Write test for DELETE endpoint**

Add new test section to the test file:

```typescript
describe('DELETE /reviewed-memories/:id', () => {
  it('should delete reviewed memory file', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));

    // Setup: create a reviewed memory file
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed:candidate:test-1',
      candidateMemoryId: 'candidate:test-1',
      candidateTitle: 'Test Candidate',
      candidateSummary: 'Test summary',
      candidateTheme: 'test',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-28',
      decision: 'keep',
      reviewedAt: new Date().toISOString(),
    };

    const reviewedDir = join(workspaceDir, 'mirrorbrain', 'reviewed-memories');
    await mkdir(reviewedDir, { recursive: true });
    await writeFile(
      join(reviewedDir, `${reviewedMemory.id}.json`),
      JSON.stringify(reviewedMemory, null, 2)
    );

    const service = createMirrorBrainService(
      { service: { status: 'running', config: getMirrorBrainConfig() }, workspaceDir },
      {
        listKnowledge: async () => [],
        listSkillDrafts: async () => [],
      }
    );

    const server = await startMirrorBrainHttpServer({ service, workspaceDir });

    // Delete the reviewed memory
    const response = await fetch(`${server.origin}/reviewed-memories/${reviewedMemory.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);

    // Verify file is deleted
    const filePath = join(reviewedDir, `${reviewedMemory.id}.json`);
    await expect(access(filePath)).rejects.toThrow();

    await server.stop();
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('should return 404 for non-existent reviewed memory', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));
    const service = createMirrorBrainService(
      { service: { status: 'running', config: getMirrorBrainConfig() }, workspaceDir },
      {
        listKnowledge: async () => [],
        listSkillDrafts: async () => [],
      }
    );

    const server = await startMirrorBrainHttpServer({ service, workspaceDir });

    const response = await fetch(`${server.origin}/reviewed-memories/nonexistent-id`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);

    await server.stop();
    await rm(workspaceDir, { recursive: true, force: true });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd src/apps/mirrorbrain-http-server && npm test -- index.test.ts`
Expected: Tests fail (endpoint not yet working)

**Step 3: Tests should now pass**

Run: `cd src/apps/mirrorbrain-http-server && npm test -- index.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/apps/mirrorbrain-http-server/index.test.ts
git commit -m "test: add tests for DELETE /reviewed-memories/:id endpoint"
```

---

## Phase 2: Frontend State Management

### Task 5: Add undoCandidateReview to API Client

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/api/client.ts:46-49, 175-188`

**Step 1: Add method to interface**

Add after line 49:

```typescript
reviewCandidateMemory(
  candidate: CandidateMemory,
  review: { decision: ReviewedMemory['decision']; reviewedAt: string }
): Promise<ReviewedMemory>;
undoCandidateReview(reviewedMemoryId: string): Promise<void>;
```

**Step 2: Implement method in browser API**

Add after line 188:

```typescript
async undoCandidateReview(reviewedMemoryId: string) {
  const response = await fetch(`${this.baseUrl}/reviewed-memories/${reviewedMemoryId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Reviewed memory ${reviewedMemoryId} not found`);
    }
    throw new Error(`Failed to undo candidate review: ${response.statusText}`);
  }
},
```

**Step 3: Verify API client compiles**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/api/client.ts
git commit -m "feat: add undoCandidateReview to API client"
```

---

### Task 6: Add undoCandidateReview to useReviewWorkflow Hook

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/hooks/useReviewWorkflow.ts:165-181`

**Step 1: Add undoCandidateReview function**

Add after the `reviewCandidateMemory` function:

```typescript
const undoCandidateReview = useCallback(
  async (reviewedMemoryId: string) => {
    setFeedback(null);

    try {
      await api.undoCandidateReview(reviewedMemoryId);

      // Remove from global state
      dispatch({ type: 'REMOVE_REVIEWED_MEMORY', payload: reviewedMemoryId });

      setFeedback({
        kind: 'success',
        message: 'Candidate review undone',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to undo review';
      setFeedback({ kind: 'error', message });
      throw error;
    }
  },
  [api, dispatch]
);
```

**Step 2: Add to return object**

Add to the return object after `reviewCandidateMemory`:

```typescript
return {
  ...
  reviewCandidateMemory,
  undoCandidateReview,
  ...
};
```

**Step 3: Verify hook compiles**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/hooks/useReviewWorkflow.ts
git commit -m "feat: add undoCandidateReview to useReviewWorkflow hook"
```

---

### Task 7: Add REMOVE_REVIEWED_MEMORY Action to Context

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/contexts/MirrorBrainContext.tsx`

**Step 1: Add action type**

Find the action types section and add:

```typescript
type Action =
  | { type: 'SET_MEMORY_EVENTS'; payload: MemoryEvent[] }
  | { type: 'SET_HAS_LOADED_MEMORY_EVENTS'; payload: boolean }
  | { type: 'SET_CANDIDATES'; payload: CandidateMemory[] }
  | { type: 'REMOVE_CANDIDATE'; payload: string }
  | { type: 'ADD_REVIEWED_MEMORY'; payload: ReviewedMemory }
  | { type: 'REMOVE_REVIEWED_MEMORY'; payload: string }
  | { type: 'SET_REVIEW_WINDOW'; payload: { date: string; eventCount: number } }
  | { type: 'SET_REVIEWED_MEMORIES'; payload: ReviewedMemory[] };
```

**Step 2: Add case to reducer**

Find the reducer function and add case:

```typescript
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MEMORY_EVENTS':
      return { ...state, memoryEvents: action.payload };

    case 'SET_HAS_LOADED_MEMORY_EVENTS':
      return { ...state, hasLoadedMemoryEvents: action.payload };

    case 'SET_CANDIDATES':
      return { ...state, candidateMemories: action.payload };

    case 'REMOVE_CANDIDATE':
      return {
        ...state,
        candidateMemories: state.candidateMemories.filter(c => c.id !== action.payload),
      };

    case 'ADD_REVIEWED_MEMORY':
      return {
        ...state,
        reviewedMemories: [...state.reviewedMemories, action.payload],
      };

    case 'REMOVE_REVIEWED_MEMORY':
      return {
        ...state,
        reviewedMemories: state.reviewedMemories.filter(r => r.id !== action.payload),
      };

    case 'SET_REVIEW_WINDOW':
      return {
        ...state,
        reviewWindowDate: action.payload.date,
        reviewWindowEventCount: action.payload.eventCount,
      };

    case 'SET_REVIEWED_MEMORIES':
      return { ...state, reviewedMemories: action.payload };

    default:
      return state;
  }
}
```

**Step 3: Verify context compiles**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/contexts/MirrorBrainContext.tsx
git commit -m "feat: add REMOVE_REVIEWED_MEMORY action to context"
```

---

### Task 8: Write Frontend State Management Tests

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/contexts/MirrorBrainContext.test.tsx`

**Step 1: Write test for REMOVE_REVIEWED_MEMORY action**

Add new test case:

```typescript
it('should remove reviewed memory from state', () => {
  const initialState: State = {
    memoryEvents: [],
    hasLoadedMemoryEvents: false,
    candidateMemories: [],
    reviewedMemories: [
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
      {
        id: 'reviewed:candidate:test-2',
        candidateMemoryId: 'candidate:test-2',
        candidateTitle: 'Test 2',
        candidateSummary: 'Summary 2',
        candidateTheme: 'test',
        memoryEventIds: ['event-2'],
        reviewDate: '2026-04-28',
        decision: 'keep',
        reviewedAt: '2026-04-28T11:00:00Z',
      },
    ],
    reviewWindowDate: null,
    reviewWindowEventCount: 0,
  };

  const newState = reducer(initialState, {
    type: 'REMOVE_REVIEWED_MEMORY',
    payload: 'reviewed:candidate:test-1',
  });

  expect(newState.reviewedMemories).toHaveLength(1);
  expect(newState.reviewedMemories[0].id).toBe('reviewed:candidate:test-2');
});
```

**Step 2: Run tests**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- MirrorBrainContext.test.tsx`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/contexts/MirrorBrainContext.test.tsx
git commit -m "test: add tests for REMOVE_REVIEWED_MEMORY action"
```

---

## Phase 3: UI Components

### Task 9: Create KeptCandidateCard Component

**Files:**
- Create: `src/apps/mirrorbrain-web-react/src/components/review/KeptCandidateCard.tsx`
- Create: `src/apps/mirrorbrain-web-react/src/components/review/KeptCandidateCard.test.tsx`

**Step 1: Write component tests**

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeptCandidateCard from './KeptCandidateCard';
import type { ReviewedMemory } from '../../types/index';

describe('KeptCandidateCard', () => {
  const mockReviewedMemory: ReviewedMemory = {
    id: 'reviewed:candidate:test-1',
    candidateMemoryId: 'candidate:test-1',
    candidateTitle: 'Test Candidate',
    candidateSummary: 'Test summary',
    candidateTheme: 'test',
    memoryEventIds: ['event-1', 'event-2'],
    reviewDate: '2026-04-28',
    decision: 'keep',
    reviewedAt: '2026-04-28T10:00:00Z',
  };

  it('should render candidate title', () => {
    render(<KeptCandidateCard reviewedMemory={mockReviewedMemory} onUndo={() => {}} />);

    expect(screen.getByText('Test Candidate')).toBeInTheDocument();
  });

  it('should render kept badge', () => {
    render(<KeptCandidateCard reviewedMemory={mockReviewedMemory} onUndo={() => {}} />);

    expect(screen.getByText('Kept')).toBeInTheDocument();
  });

  it('should call onUndo when undo button clicked', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();

    render(<KeptCandidateCard reviewedMemory={mockReviewedMemory} onUndo={onUndo} />);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(onUndo).toHaveBeenCalledWith('reviewed:candidate:test-1');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- KeptCandidateCard.test.tsx`
Expected: Tests fail (component doesn't exist)

**Step 3: Write component implementation**

```typescript
import type { ReviewedMemory } from '../../types/index';

interface KeptCandidateCardProps {
  reviewedMemory: ReviewedMemory;
  onUndo: (reviewedMemoryId: string) => void;
}

export default function KeptCandidateCard({ reviewedMemory, onUndo }: KeptCandidateCardProps) {
  const eventCount = reviewedMemory.memoryEventIds.length;

  return (
    <div className="bg-white border border-green-200 rounded-lg p-3 shadow-sm">
      <div className="space-y-2">
        {/* Header: Title + Badge */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-heading font-semibold text-sm text-slate-900 line-clamp-2 flex-1">
            {reviewedMemory.candidateTitle}
          </h4>

          {/* Kept badge */}
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold bg-green-100 text-green-700 border border-green-300">
              Kept
            </span>
          </div>
        </div>

        {/* Source count */}
        <p className="text-xs font-body text-slate-600">
          {eventCount} pages
        </p>

        {/* Undo Button */}
        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={() => onUndo(reviewedMemory.id)}
            className="inline-flex items-center justify-center w-full h-8 rounded-md bg-slate-200 text-slate-700 hover:bg-red-100 hover:text-red-700 transition-colors duration-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 cursor-pointer text-xs font-heading font-semibold"
            aria-label="Undo keep"
            type="button"
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- KeptCandidateCard.test.tsx`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/KeptCandidateCard.tsx
git add src/apps/mirrorbrain-web-react/src/components/review/KeptCandidateCard.test.tsx
git commit -m "feat: create KeptCandidateCard component with undo functionality"
```

---

### Task 10: Modify SelectedCandidate to Support Dual Modes

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx:1-263`
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.test.tsx`

**Step 1: Write tests for dual mode rendering**

Add tests to existing test file:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectedCandidate from './SelectedCandidate';
import type { CandidateMemory, ReviewedMemory } from '../../types/index';

describe('SelectedCandidate', () => {
  const mockCandidate: CandidateMemory = {
    id: 'candidate:test-1',
    memoryEventIds: ['event-1'],
    title: 'Test Candidate',
    summary: 'Test summary',
    theme: 'test',
    reviewDate: '2026-04-28',
    timeRange: {
      startAt: '2026-04-28T10:00:00Z',
      endAt: '2026-04-28T11:00:00Z',
    },
    reviewState: 'pending',
  };

  const mockKeptCandidates: ReviewedMemory[] = [
    {
      id: 'reviewed:candidate:test-1',
      candidateMemoryId: 'candidate:test-1',
      candidateTitle: 'Kept Candidate 1',
      candidateSummary: 'Summary',
      candidateTheme: 'test',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-28',
      decision: 'keep',
      reviewedAt: '2026-04-28T10:00:00Z',
    },
    {
      id: 'reviewed:candidate:test-2',
      candidateMemoryId: 'candidate:test-2',
      candidateTitle: 'Kept Candidate 2',
      candidateSummary: 'Summary 2',
      candidateTheme: 'test',
      memoryEventIds: ['event-2'],
      reviewDate: '2026-04-28',
      decision: 'keep',
      reviewedAt: '2026-04-28T11:00:00Z',
    },
  ];

  it('should render detail view when viewingMode is detail', () => {
    render(
      <SelectedCandidate
        candidate={mockCandidate}
        viewingMode="detail"
        keptCandidates={[]}
        onUndoKeep={() => {}}
      />
    );

    expect(screen.getByText('Test Candidate')).toBeInTheDocument();
    expect(screen.getByText('Test summary')).toBeInTheDocument();
  });

  it('should render kept list view when viewingMode is kept-list', () => {
    render(
      <SelectedCandidate
        candidate={undefined}
        viewingMode="kept-list"
        keptCandidates={mockKeptCandidates}
        onUndoKeep={() => {}}
    );

    expect(screen.getByText('Kept Candidate 1')).toBeInTheDocument();
    expect(screen.getByText('Kept Candidate 2')).toBeInTheDocument();
    expect(screen.getByText('Kept')).toBeInTheDocument();
  });

  it('should call onUndoKeep when undo button clicked in kept list', async () => {
    const user = userEvent.setup();
    const onUndoKeep = vi.fn();

    render(
      <SelectedCandidate
        candidate={undefined}
        viewingMode="kept-list"
        keptCandidates={mockKeptCandidates}
        onUndoKeep={onUndoKeep}
      />
    );

    const undoButtons = screen.getAllByRole('button', { name: 'Undo' });
    await user.click(undoButtons[0]);

    expect(onUndoKeep).toHaveBeenCalledWith('reviewed:candidate:test-1');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- SelectedCandidate.test.tsx`
Expected: Tests fail (component doesn't support new props)

**Step 3: Update component interface**

Update props interface:

```typescript
import KeptCandidateCard from './KeptCandidateCard';
import type { CandidateMemory, ReviewedMemory } from '../../types/index';

interface SelectedCandidateProps {
  candidate: CandidateMemory | undefined;
  viewingMode: 'detail' | 'kept-list';
  keptCandidates: ReviewedMemory[];
  onUndoKeep: (reviewedMemoryId: string) => void;
}
```

**Step 4: Update component rendering**

Replace entire component rendering logic:

```typescript
export default function SelectedCandidate({
  candidate,
  viewingMode,
  keptCandidates,
  onUndoKeep,
}: SelectedCandidateProps) {
  // Kept list mode
  if (viewingMode === 'kept-list') {
    if (keptCandidates.length === 0) {
      return (
        <Card className="h-full overflow-y-auto max-h-[540px]">
          <div className="text-center py-12">
            <p className="font-heading font-semibold text-base text-slate-600 mb-2">
              No kept candidates
            </p>
            <p className="font-body text-sm text-slate-500">
              Click "Keep" on candidates to add them here
            </p>
          </div>
        </Card>
      );
    }

    return (
      <Card className="h-full overflow-y-auto max-h-[540px]">
        <div className="space-y-3">
          <div className="mb-2">
            <h3 className="font-heading font-bold text-xs text-slate-900 uppercase tracking-wide">
              Kept Candidates ({keptCandidates.length})
            </h3>
          </div>
          {keptCandidates.map((reviewedMemory) => (
            <KeptCandidateCard
              key={reviewedMemory.id}
              reviewedMemory={reviewedMemory}
              onUndo={onUndoKeep}
            />
          ))}
        </div>
      </Card>
    );
  }

  // Detail mode (existing behavior)
  if (!candidate) {
    return (
      <Card className="h-full overflow-y-auto max-h-[540px]">
        <div className="text-center py-12">
          <p className="font-heading font-semibold text-base text-slate-600 mb-2">
            No candidate selected
          </p>
          <p className="font-body text-sm text-slate-500">
            Click a candidate from the list to view details
          </p>
        </div>
      </Card>
    );
  }

  // ... rest of existing detail rendering unchanged ...
```

Keep the rest of the detail rendering code unchanged (lines 101-262).

**Step 5: Run tests to verify they pass**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- SelectedCandidate.test.tsx`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.tsx
git add src/apps/mirrorbrain-web-react/src/components/review/SelectedCandidate.test.tsx
git commit -m "feat: add dual-mode rendering to SelectedCandidate"
```

---

### Task 11: Update ReviewPanel with New State and Handlers

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx:33-192`

**Step 1: Add new state and imports**

Add to imports:

```typescript
import { useMemo, useState } from 'react';
```

Add state after line 34:

```typescript
const { state } = useMirrorBrain();
const api: MirrorBrainWebAppApi = useMemo(
  () => createMirrorBrainBrowserApi(window.location.origin),
  []
);

const {
  candidates,
  reviewWindowDate,
  reviewWindowEventCount,
  selectedCandidateId,
  feedback,
  isCreatingCandidates,
  isReviewing,
  createDailyCandidates,
  selectCandidate,
  reviewCandidateMemory,
  undoCandidateReview,
  getSelectedCandidate,
  getReviewSuggestion,
} = useReviewWorkflow(api);

const [reviewDate] = useState(getDefaultReviewDate());
const [reviewTimeZone] = useState(getLocalTimeZone());
const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
const [keptCandidateIds, setKeptCandidateIds] = useState<Set<string>>(new Set());
const [viewingMode, setViewingMode] = useState<'detail' | 'kept-list'>('detail');
```

**Step 2: Filter candidates to exclude kept ones**

Add before the auto-load effect:

```typescript
// Filter out kept candidates from main list
const unreviewedCandidates = useMemo(() => {
  return candidates.filter(c => !keptCandidateIds.has(c.id));
}, [candidates, keptCandidateIds]);
```

**Step 3: Get kept candidates data**

Add:

```typescript
// Get kept candidates data from reviewed memories
const keptCandidates = useMemo(() => {
  return state.reviewedMemories.filter(r =>
    r.decision === 'keep' && keptCandidateIds.has(r.candidateMemoryId)
  );
}, [state.reviewedMemories, keptCandidateIds]);
```

**Step 4: Update handleKeepCandidate**

Replace existing handler:

```typescript
const handleKeepCandidate = async (candidateId: string) => {
  try {
    selectCandidate(candidateId);
    const reviewed = await reviewCandidateMemory('keep');

    // Add to kept set
    setKeptCandidateIds(prev => new Set([...prev, candidateId]));

    // Switch to kept-list view
    setViewingMode('kept-list');
  } catch (error) {
    // Error already handled by useReviewWorkflow
  }
};
```

**Step 5: Add handleUndoKeep handler**

Add new handler:

```typescript
const handleUndoKeep = async (reviewedMemoryId: string) => {
  try {
    await undoCandidateReview(reviewedMemoryId);

    // Extract candidate ID from reviewed memory ID
    const candidateId = reviewedMemoryId.replace(/^reviewed:/, '');

    // Remove from kept set
    setKeptCandidateIds(prev => {
      const next = new Set(prev);
      next.delete(candidateId);
      return next;
    });

    // If no kept candidates left, switch back to detail view
    if (keptCandidateIds.size === 1) {
      setViewingMode('detail');
    }
  } catch (error) {
    // Error already handled by useReviewWorkflow
  }
};
```

**Step 6: Update handleSelectCandidate**

Replace existing handler:

```typescript
const handleSelectCandidate = (candidateId: string) => {
  selectCandidate(candidateId);
  setViewingMode('detail');
};
```

**Step 7: Update component rendering**

Replace CandidateList prop and SelectedCandidate props:

```typescript
<CandidateList
  candidates={unreviewedCandidates}
  selectedCandidateId={selectedCandidateId}
  onSelectCandidate={handleSelectCandidate}
  onKeepCandidate={handleKeepCandidate}
  onDiscardCandidate={handleDiscardCandidate}
  getReviewSuggestion={getReviewSuggestion}
/>

<SelectedCandidate
  candidate={selectedCandidate}
  viewingMode={viewingMode}
  keptCandidates={keptCandidates}
  onUndoKeep={handleUndoKeep}
/>
```

**Step 8: Verify component compiles**

Run: `cd src/apps/mirrorbrain-web-react && npx tsc --noEmit`
Expected: No type errors

**Step 9: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.tsx
git commit -m "feat: add kept candidate state and handlers to ReviewPanel"
```

---

### Task 12: Write ReviewPanel Component Tests

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.test.tsx`

**Step 1: Write tests for kept candidate behavior**

Add new test cases:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReviewPanel from './ReviewPanel';
import { MirrorBrainProvider } from '../../contexts/MirrorBrainContext';
import type { CandidateMemory, ReviewedMemory } from '../../types/index';

// Mock the API and hooks
vi.mock('../../api/client', () => ({
  createMirrorBrainBrowserApi: () => ({
    createDailyCandidates: vi.fn(),
    suggestCandidateReviews: vi.fn(),
    reviewCandidateMemory: vi.fn(),
    undoCandidateReview: vi.fn(),
  }),
}));

describe('ReviewPanel kept candidate behavior', () => {
  it('should remove kept candidate from main list', async () => {
    // ... test implementation
  });

  it('should show kept candidates in kept list view', async () => {
    // ... test implementation
  });

  it('should undo keep and return candidate to main list', async () => {
    // ... test implementation
  });
});
```

**Step 2: Run tests**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- ReviewPanel.test.tsx`
Expected: Tests pass

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/components/review/ReviewPanel.test.tsx
git commit -m "test: add tests for kept candidate behavior in ReviewPanel"
```

---

## Phase 4: Integration Testing

### Task 13: Update Existing Integration Tests

**Files:**
- Modify: `src/apps/mirrorbrain-web-react/src/integration/review-to-artifacts.test.ts`

**Step 1: Add undo workflow test**

Add new test section:

```typescript
describe('undo keep workflow', () => {
  it('should undo a kept candidate and verify it reappears', async () => {
    // Setup: create and keep a candidate
    // Action: undo the keep
    // Verify: candidate appears in candidates list again
    // Verify: reviewed memory is removed
  });
});
```

**Step 2: Run integration tests**

Run: `cd src/apps/mirrorbrain-web-react && npm test -- review-to-artifacts.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/apps/mirrorbrain-web-react/src/integration/review-to-artifacts.test.ts
git commit -m "test: add undo workflow integration tests"
```

---

### Task 14: Manual Testing Checklist

**Files:**
- Create: `docs/testing/manual-review-undo-checklist.md`

**Step 1: Create checklist document**

```markdown
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
```

**Step 2: Run manual testing**

Follow checklist in running dev environment.

**Step 3: Document results**

Update checklist with results and any issues found.

**Step 4: Commit**

```bash
git add docs/testing/manual-review-undo-checklist.md
git commit -m "docs: add manual testing checklist for keep/undo feature"
```

---

## Success Verification

After completing all tasks, verify:

1. ✅ Backend: DELETE endpoint works, file deletion succeeds
2. ✅ Frontend: Kept candidates tracked separately from main list
3. ✅ UI: Dual-mode display switches correctly
4. ✅ Undo: Backend review reverted, candidate reappears
5. ✅ All tests pass: backend, frontend, integration
6. ✅ Manual testing checklist completed without blocking issues

## Notes

- Follow TDD: write test first, verify failure, implement, verify pass
- Commit after each task completes successfully
- Use `npx tsc --noEmit` to check TypeScript compilation
- Run tests with `npm test -- <test-file>`
- If tests fail unexpectedly, debug before moving to next task