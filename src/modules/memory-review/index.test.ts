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
          url: 'https://github.com/example/billing/issues/42',
          title: 'Fix billing export failure',
        }),
        createBrowserMemoryEvent({
          id: 'browser:old-1',
          timestamp: '2026-03-19T22:00:00.000Z',
          url: 'https://github.com/example/billing/pull/10',
          title: 'Billing export patch',
        }),
      ],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      memoryEventIds: ['browser:old-1', 'browser:issues-1'],
      reviewState: 'pending',
      reviewDate: '2026-03-20',
      timeRange: {
        startAt: '2026-03-19T22:00:00.000Z',
        endAt: '2026-03-20T09:00:00.000Z',
      },
      sourceRefs: [
        {
          id: 'browser:old-1',
          title: 'Billing export patch',
          url: 'https://github.com/example/billing/pull/10',
          timestamp: '2026-03-19T22:00:00.000Z',
        },
        {
          id: 'browser:issues-1',
          title: 'Fix billing export failure',
          url: 'https://github.com/example/billing/issues/42',
          timestamp: '2026-03-20T09:00:00.000Z',
        },
      ],
    });
    expect(candidates[0]?.title).toMatch(/Billing|Export/i);
    expect(candidates[1]).toMatchObject({
      memoryEventIds: ['browser:docs-1', 'browser:docs-2'],
      reviewState: 'pending',
      reviewDate: '2026-03-20',
      timeRange: {
        startAt: '2026-03-20T08:00:00.000Z',
        endAt: '2026-03-20T08:15:00.000Z',
      },
      sourceRefs: [
        {
          id: 'browser:docs-1',
          title: 'MirrorBrain Guide',
          url: 'https://docs.example.com/guides/mirrorbrain',
          timestamp: '2026-03-20T08:00:00.000Z',
        },
        {
          id: 'browser:docs-2',
          title: 'MirrorBrain API Guide',
          url: 'https://docs.example.com/guides/mirrorbrain/api',
          timestamp: '2026-03-20T08:15:00.000Z',
        },
      ],
    });
    expect(candidates[1]?.title).toMatch(/Mirrorbrain/i);
  });

  it('caps generated candidates at 10 by merging low-evidence browser work into broader tasks', () => {
    const taskNames = [
      'Alpha',
      'Bravo',
      'Charlie',
      'Delta',
      'Echo',
      'Foxtrot',
      'Gamma',
      'Helix',
      'Iris',
      'Juno',
      'Kappa',
      'Lumen',
    ];
    const memoryEvents = taskNames.map((taskName, index) =>
      createBrowserMemoryEvent({
        id: `browser:task-${index + 1}`,
        timestamp: `2026-03-20T${String(index).padStart(2, '0')}:00:00.000Z`,
        url: `https://work.example.com/${taskName.toLowerCase()}/session`,
        title: `${taskName} Focus`,
      }),
    );

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents,
    });

    expect(candidates.length).toBeLessThanOrEqual(10);
    expect(
      candidates.reduce((count, candidate) => count + candidate.memoryEventIds.length, 0),
    ).toBe(12);
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
    expect(reviewed).toMatchObject({
      id: `reviewed:${candidate.id}`,
      candidateMemoryId: candidate.id,
      candidateTitle: candidate.title,
      candidateSummary: candidate.summary,
      candidateTheme: candidate.theme,
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
          url: 'https://github.com/example/billing/issues/42',
          title: 'Fix billing export failure',
        }),
      ],
    });

    const suggestions = suggestCandidateReviews(candidates);

    expect(suggestions).toHaveLength(candidates.length);
    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        candidateMemoryId: candidates[0]?.id,
        recommendation: 'keep',
        keepScore: expect.any(Number),
        confidenceScore: expect.any(Number),
        priorityScore: expect.any(Number),
        rationale: expect.any(String),
        supportingReasons: expect.arrayContaining([expect.any(String)]),
      }),
    );
    expect(suggestions[1]).toEqual(
      expect.objectContaining({
        candidateMemoryId: candidates[1]?.id,
        recommendation: expect.stringMatching(/keep|review|discard/),
        keepScore: expect.any(Number),
        confidenceScore: expect.any(Number),
        priorityScore: expect.any(Number),
        rationale: expect.any(String),
        supportingReasons: expect.arrayContaining([expect.any(String)]),
      }),
    );

    expect(suggestions[0]?.keepScore).toBeGreaterThan(suggestions[1]?.keepScore ?? 0);
    expect(candidates.every((candidate) => candidate.reviewState === 'pending')).toBe(
      true,
    );
  });

  it('treats UTC timestamps as part of the local review day when a review timezone is provided', () => {
    const candidates = createCandidateMemories({
      reviewDate: '2026-04-01',
      reviewTimeZone: 'Asia/Shanghai',
      memoryEvents: [
        createBrowserMemoryEvent({
          id: 'browser:morning-1',
          timestamp: '2026-03-31T16:30:00.000Z',
          url: 'https://docs.example.com/guides/morning-review',
          title: 'Morning Review',
        }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      reviewDate: '2026-04-01',
      memoryEventIds: ['browser:morning-1'],
    });
  });

  it('groups related pages from different hosts when browser page text shows the same task', () => {
    const candidates = createCandidateMemories({
      reviewDate: '2026-04-14',
      memoryEvents: [
        {
          ...createBrowserMemoryEvent({
            id: 'browser:docs-text-1',
            timestamp: '2026-04-14T08:00:00.000Z',
            url: 'https://docs.example.com/reference/cache-invalidation',
            title: 'Cache Invalidation Guide',
          }),
          content: {
            url: 'https://docs.example.com/reference/cache-invalidation',
            title: 'Cache Invalidation Guide',
            pageText:
              'MirrorBrain cache invalidation task. Fix stale cache bug after browser sync. Update invalidation workflow and verify stale-cache recovery.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:issue-text-1',
            timestamp: '2026-04-14T08:20:00.000Z',
            url: 'https://github.com/example/platform/issues/42',
            title: 'Stale cache after browser sync',
          }),
          content: {
            url: 'https://github.com/example/platform/issues/42',
            title: 'Stale cache after browser sync',
            pageText:
              'Investigate stale cache bug after browser sync. MirrorBrain invalidation workflow misses browser page refresh and leaves stale cache entries.',
          },
        },
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      memoryEventIds: ['browser:docs-text-1', 'browser:issue-text-1'],
    });
    expect(candidates[0]?.title).toMatch(/Cache|Invalidation|Stale/i);
  });

  it('groups search, docs, chat, and issue pages into one task when their content supports the same work item', () => {
    const candidates = createCandidateMemories({
      reviewDate: '2026-04-14',
      memoryEvents: [
        {
          ...createBrowserMemoryEvent({
            id: 'browser:search-1',
            timestamp: '2026-04-14T09:00:00.000Z',
            url: 'https://google.com/search?q=mirrorbrain+stale+cache+bug',
            title: 'mirrorbrain stale cache bug - Google Search',
          }),
          content: {
            url: 'https://google.com/search?q=mirrorbrain+stale+cache+bug',
            title: 'mirrorbrain stale cache bug - Google Search',
            pageText:
              'Search results for mirrorbrain stale cache bug after browser sync and cache invalidation workflow.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:docs-3',
            timestamp: '2026-04-14T09:06:00.000Z',
            url: 'https://docs.example.com/cache/invalidation-runbook',
            title: 'Cache invalidation runbook',
          }),
          content: {
            url: 'https://docs.example.com/cache/invalidation-runbook',
            title: 'Cache invalidation runbook',
            pageText:
              'Runbook for stale cache recovery in MirrorBrain browser sync. Verify invalidation and rebuild cache entries.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:chat-1',
            timestamp: '2026-04-14T09:12:00.000Z',
            url: 'https://chatgpt.com/c/stale-cache-investigation',
            title: 'stale cache investigation',
          }),
          content: {
            url: 'https://chatgpt.com/c/stale-cache-investigation',
            title: 'stale cache investigation',
            pageText:
              'Reason about the stale cache bug, browser sync invalidation, and likely fixes in MirrorBrain.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:issue-2',
            timestamp: '2026-04-14T09:20:00.000Z',
            url: 'https://github.com/example/platform/issues/77',
            title: 'Fix stale cache after sync',
          }),
          content: {
            url: 'https://github.com/example/platform/issues/77',
            title: 'Fix stale cache after sync',
            pageText:
              'Issue tracking stale cache after browser sync. Root cause points to invalidation workflow and stale cache entries.',
          },
        },
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      memoryEventIds: [
        'browser:search-1',
        'browser:docs-3',
        'browser:chat-1',
        'browser:issue-2',
      ],
    });
    expect(candidates[0]?.title).toMatch(/Cache|Stale|Invalidation/i);
  });

  it('keeps same-host pages separate when their page text points to different tasks', () => {
    const candidates = createCandidateMemories({
      reviewDate: '2026-04-14',
      memoryEvents: [
        {
          ...createBrowserMemoryEvent({
            id: 'browser:docs-a',
            timestamp: '2026-04-14T10:00:00.000Z',
            url: 'https://docs.example.com/guides/cache-invalidation',
            title: 'Cache invalidation guide',
          }),
          content: {
            url: 'https://docs.example.com/guides/cache-invalidation',
            title: 'Cache invalidation guide',
            pageText:
              'Fix stale cache bug after browser sync. Cache invalidation workflow and stale cache recovery.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:docs-b',
            timestamp: '2026-04-14T10:25:00.000Z',
            url: 'https://docs.example.com/guides/release-checklist',
            title: 'Release checklist guide',
          }),
          content: {
            url: 'https://docs.example.com/guides/release-checklist',
            title: 'Release checklist guide',
            pageText:
              'Prepare release checklist, validate release notes, and coordinate deployment signoff for the release train.',
          },
        },
      ],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.title).not.toBe(candidates[1]?.title);
  });

  it('annotates candidate source refs with page roles for review explainability', () => {
    const [candidate] = createCandidateMemories({
      reviewDate: '2026-04-14',
      memoryEvents: [
        createBrowserMemoryEvent({
          id: 'browser:search-role',
          timestamp: '2026-04-14T09:00:00.000Z',
          url: 'https://google.com/search?q=stale+cache',
          title: 'stale cache - Google Search',
        }),
        createBrowserMemoryEvent({
          id: 'browser:docs-role',
          timestamp: '2026-04-14T09:04:00.000Z',
          url: 'https://docs.example.com/cache/invalidation',
          title: 'Cache invalidation guide',
        }),
        createBrowserMemoryEvent({
          id: 'browser:chat-role',
          timestamp: '2026-04-14T09:08:00.000Z',
          url: 'https://chatgpt.com/c/stale-cache',
          title: 'stale cache investigation',
        }),
        createBrowserMemoryEvent({
          id: 'browser:issue-role',
          timestamp: '2026-04-14T09:12:00.000Z',
          url: 'https://github.com/example/platform/issues/77',
          title: 'Fix stale cache after sync',
        }),
      ],
    });

    expect(candidate?.sourceRefs).toEqual([
      expect.objectContaining({ id: 'browser:search-role', role: 'search' }),
      expect.objectContaining({ id: 'browser:docs-role', role: 'docs' }),
      expect.objectContaining({ id: 'browser:chat-role', role: 'chat' }),
      expect.objectContaining({ id: 'browser:issue-role', role: 'issue' }),
    ]);
  });
});
