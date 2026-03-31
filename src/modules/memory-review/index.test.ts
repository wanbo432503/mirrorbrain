import { describe, expect, it } from 'vitest';

import type { MemoryEvent } from '../../shared/types/index.js';
import {
  createCandidateMemories,
  reviewCandidateMemory,
  suggestCandidateReviews,
} from './index.js';

function createBrowserMemoryEvent(input: {
  id: string;
  timestamp: string;
  url: string;
  title: string;
}): MemoryEvent {
  return {
    id: input.id,
    sourceType: 'activitywatch-browser',
    sourceRef: input.id.replace('browser:', ''),
    timestamp: input.timestamp,
    authorizationScopeId: 'scope-browser',
    content: {
      url: input.url,
      title: input.title,
    },
    captureMetadata: {
      upstreamSource: 'activitywatch',
      checkpoint: input.timestamp,
    },
  };
}

describe('memory review', () => {
  it('creates multiple candidate memory streams from the daily review window', () => {
    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: [
        createBrowserMemoryEvent({
          id: 'browser:docs-1',
          timestamp: '2026-03-20T08:00:00.000Z',
          url: 'https://docs.example.com/guides/mirrorbrain',
          title: 'MirrorBrain Guide',
        }),
        createBrowserMemoryEvent({
          id: 'browser:docs-2',
          timestamp: '2026-03-20T08:15:00.000Z',
          url: 'https://docs.example.com/guides/mirrorbrain/api',
          title: 'MirrorBrain API Guide',
        }),
        createBrowserMemoryEvent({
          id: 'browser:issues-1',
          timestamp: '2026-03-20T09:00:00.000Z',
          url: 'https://github.com/example/mirrorbrain/issues/42',
          title: 'Fix review workflow',
        }),
        createBrowserMemoryEvent({
          id: 'browser:old-1',
          timestamp: '2026-03-19T22:00:00.000Z',
          url: 'https://github.com/example/mirrorbrain/pull/10',
          title: 'Old work item',
        }),
      ],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates).toEqual([
      {
        id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        memoryEventIds: ['browser:docs-1', 'browser:docs-2'],
        title: 'Docs Example Com / guides',
        summary: '2 browser events about Docs Example Com / guides on 2026-03-20.',
        theme: 'docs.example.com / guides',
        reviewState: 'pending',
        reviewDate: '2026-03-20',
        timeRange: {
          startAt: '2026-03-20T08:00:00.000Z',
          endAt: '2026-03-20T08:15:00.000Z',
        },
      },
      {
        id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
        memoryEventIds: ['browser:issues-1'],
        title: 'Github Com / example',
        summary: '1 browser event about Github Com / example on 2026-03-20.',
        theme: 'github.com / example',
        reviewState: 'pending',
        reviewDate: '2026-03-20',
        timeRange: {
          startAt: '2026-03-20T09:00:00.000Z',
          endAt: '2026-03-20T09:00:00.000Z',
        },
      },
    ]);
  });

  it('rejects candidate generation when the daily review window has no memory events', () => {
    expect(() =>
      createCandidateMemories({
        reviewDate: '2026-03-20',
        memoryEvents: [],
      }),
    ).toThrowError('No memory events found for review date 2026-03-20.');
  });

  it('keeps reviewed memory linked to the candidate stream context', () => {
    const [candidate] = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: [
        createBrowserMemoryEvent({
          id: 'browser:docs-1',
          timestamp: '2026-03-20T08:00:00.000Z',
          url: 'https://docs.example.com/guides/mirrorbrain',
          title: 'MirrorBrain Guide',
        }),
      ],
    });

    const reviewed = reviewCandidateMemory(candidate, {
      decision: 'keep',
      reviewedAt: '2026-03-20T10:00:00.000Z',
    });

    expect(candidate.reviewState).toBe('pending');
    expect(reviewed).toEqual({
      id: 'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
      candidateMemoryId:
        'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
      candidateTitle: 'Docs Example Com / guides',
      candidateSummary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
      candidateTheme: 'docs.example.com / guides',
      memoryEventIds: ['browser:docs-1'],
      reviewDate: '2026-03-20',
      decision: 'keep',
      reviewedAt: '2026-03-20T10:00:00.000Z',
    });
  });

  it('returns AI-review-ready suggestions without auto-promoting candidates', () => {
    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: [
        createBrowserMemoryEvent({
          id: 'browser:docs-1',
          timestamp: '2026-03-20T08:00:00.000Z',
          url: 'https://docs.example.com/guides/mirrorbrain',
          title: 'MirrorBrain Guide',
        }),
        createBrowserMemoryEvent({
          id: 'browser:docs-2',
          timestamp: '2026-03-20T08:15:00.000Z',
          url: 'https://docs.example.com/guides/mirrorbrain/api',
          title: 'MirrorBrain API Guide',
        }),
        createBrowserMemoryEvent({
          id: 'browser:issues-1',
          timestamp: '2026-03-20T09:00:00.000Z',
          url: 'https://github.com/example/mirrorbrain/issues/42',
          title: 'Fix review workflow',
        }),
      ],
    });

    const suggestions = suggestCandidateReviews(candidates);

    expect(suggestions).toEqual([
      {
        candidateMemoryId:
          'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        recommendation: 'keep',
        confidenceScore: 0.8,
        priorityScore: 2,
        rationale:
          'This daily stream has repeated activity and is a strong keep candidate.',
      },
      {
        candidateMemoryId:
          'candidate:2026-03-20:activitywatch-browser:github-com:example',
        recommendation: 'review',
        confidenceScore: 0.55,
        priorityScore: 1,
        rationale:
          'This daily stream has limited evidence and should stay in human review.',
      },
    ]);

    expect(candidates.every((candidate) => candidate.reviewState === 'pending')).toBe(
      true,
    );
  });
});
