import { describe, expect, it } from 'vitest';
import type { WorkSessionCandidate } from '../../workflows/work-session-analysis/index.js';
import { reviewWorkSessionCandidate } from './index.js';

const candidate: WorkSessionCandidate = {
  id: 'work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
  projectHint: 'mirrorbrain',
  title: 'MirrorBrain source integration',
  summary: 'Imported source ledgers and reviewed related shell activity.',
  memoryEventIds: ['browser-1', 'shell-1'],
  sourceTypes: ['browser', 'shell'],
  timeRange: {
    startAt: '2026-05-12T10:00:00.000Z',
    endAt: '2026-05-12T11:00:00.000Z',
  },
  relationHints: ['Phase 4 design', 'Run source tests'],
  reviewState: 'pending',
};

describe('project work session review', () => {
  it('keeps a work-session candidate under an existing project with source provenance', () => {
    const result = reviewWorkSessionCandidate(candidate, {
      decision: 'keep',
      reviewedAt: '2026-05-12T12:05:00.000Z',
      reviewedBy: 'user',
      title: 'Source ledger integration work',
      projectAssignment: {
        kind: 'existing-project',
        projectId: 'project:mirrorbrain',
      },
    });

    expect(result.project).toBeUndefined();
    expect(result.reviewedWorkSession).toMatchObject({
      id: 'reviewed-work-session:work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
      candidateId: candidate.id,
      projectId: 'project:mirrorbrain',
      title: 'Source ledger integration work',
      memoryEventIds: ['browser-1', 'shell-1'],
      sourceTypes: ['browser', 'shell'],
      reviewState: 'reviewed',
      reviewedAt: '2026-05-12T12:05:00.000Z',
      reviewedBy: 'user',
    });
  });

  it('creates a durable project only when the user confirms a new project assignment', () => {
    const result = reviewWorkSessionCandidate(candidate, {
      decision: 'keep',
      reviewedAt: '2026-05-12T12:05:00.000Z',
      reviewedBy: 'user',
      projectAssignment: {
        kind: 'confirmed-new-project',
        name: 'MirrorBrain',
        description: 'Personal work memory system.',
      },
    });

    expect(result.project).toEqual({
      id: 'project:mirrorbrain',
      name: 'MirrorBrain',
      description: 'Personal work memory system.',
      status: 'active',
      createdAt: '2026-05-12T12:05:00.000Z',
      updatedAt: '2026-05-12T12:05:00.000Z',
    });
    expect(result.reviewedWorkSession.projectId).toBe('project:mirrorbrain');
  });

  it('rejects kept work sessions without explicit project assignment', () => {
    expect(() =>
      reviewWorkSessionCandidate(candidate, {
        decision: 'keep',
        reviewedAt: '2026-05-12T12:05:00.000Z',
        reviewedBy: 'user',
      }),
    ).toThrow('Kept work sessions require an explicit project assignment.');
  });

  it('discards a work-session candidate without creating a project', () => {
    const result = reviewWorkSessionCandidate(candidate, {
      decision: 'discard',
      reviewedAt: '2026-05-12T12:05:00.000Z',
      reviewedBy: 'user',
    });

    expect(result.project).toBeUndefined();
    expect(result.reviewedWorkSession).toMatchObject({
      projectId: null,
      reviewState: 'discarded',
      memoryEventIds: ['browser-1', 'shell-1'],
    });
  });
});
