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

  it('does not create review candidates from local browser urls', () => {
    const candidates = createCandidateMemories({
      reviewDate: '2026-05-11',
      memoryEvents: [
        createBrowserMemoryEvent({
          id: 'browser:local-dev',
          timestamp: '2026-05-11T01:01:00.000Z',
          url: 'http://127.0.0.1:3007/',
          title: '127.0.0.1:3007',
        }),
        createBrowserMemoryEvent({
          id: 'browser:remote-docs',
          timestamp: '2026-05-11T01:05:00.000Z',
          url: 'https://docs.example.com/mirrorbrain/review',
          title: 'MirrorBrain Review Docs',
        }),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.memoryEventIds).toEqual(['browser:remote-docs']);
    expect(candidates[0]?.sourceRefs?.map((sourceRef) => sourceRef.url)).toEqual([
      'https://docs.example.com/mirrorbrain/review',
    ]);
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
    expect(
      candidates.some(
        (candidate) =>
          (candidate.compressedSourceCount ?? 0) > 0 &&
          (candidate.formationReasons ?? []).some((reason) =>
            reason.includes('absorbed'),
          ),
      ),
    ).toBe(true);

    const suggestions = suggestCandidateReviews(candidates);
    expect(
      suggestions.some((suggestion) =>
        (suggestion.supportingReasons ?? []).some((reason) =>
          reason.includes('under 10 tasks'),
        ),
      ),
    ).toBe(true);
  });

  it('separates different tasks on the same host when task context differs', () => {
    const events = [
      // First task: Fix authentication bug
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-issue-auth',
          timestamp: '2026-03-20T09:00:00.000Z',
          url: 'https://github.com/repo/issues/123',
          title: 'Fix authentication bug - Issue #123',
        }),
        content: {
          url: 'https://github.com/repo/issues/123',
          title: 'Fix authentication bug - Issue #123',
          pageText: 'Authentication fails when token expires. Need to refresh token logic.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-repo-auth',
          timestamp: '2026-03-20T09:10:00.000Z',
          url: 'https://github.com/repo',
          title: 'Repository overview',
        }),
        content: {
          url: 'https://github.com/repo',
          title: 'Repository overview',
          pageText: 'Authentication module and token refresh implementation.',
        },
      },
      // Second task: Add caching feature (different task on same host)
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-issue-cache',
          timestamp: '2026-03-20T10:00:00.000Z',
          url: 'https://github.com/repo/issues/456',
          title: 'Add caching layer - Issue #456',
        }),
        content: {
          url: 'https://github.com/repo/issues/456',
          title: 'Add caching layer - Issue #456',
          pageText: 'Implement Redis caching for performance optimization.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-pr-cache',
          timestamp: '2026-03-20T10:15:00.000Z',
          url: 'https://github.com/repo/pull/789',
          title: 'Caching implementation - PR #789',
        }),
        content: {
          url: 'https://github.com/repo/pull/789',
          title: 'Caching implementation - PR #789',
          pageText: 'Redis integration and cache invalidation strategy.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: events,
    });

    // Should create at least 2 candidates for the two different tasks
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    // Find the authentication-related candidate
    const authCandidate = candidates.find(
      (candidate) =>
        candidate.title.toLowerCase().includes('authentication') ||
        (candidate.sourceRefs ?? []).some(
          (ref) => ref.url?.includes('issues/123'),
        ),
    );

    // Find the caching-related candidate
    const cacheCandidate = candidates.find(
      (candidate) =>
        candidate.title.toLowerCase().includes('caching') ||
        (candidate.sourceRefs ?? []).some(
          (ref) => ref.url?.includes('issues/456') || ref.url?.includes('pull/789'),
        ),
    );

    // Both candidates should exist
    expect(authCandidate).toBeDefined();
    expect(cacheCandidate).toBeDefined();

    // Authentication candidate should NOT include caching pages
    expect(
      (authCandidate?.sourceRefs ?? []).some(
        (ref) => ref.url?.includes('issues/456') || ref.url?.includes('pull/789'),
      ),
    ).toBe(false);

    // Caching candidate should NOT include authentication pages
    expect(
      (cacheCandidate?.sourceRefs ?? []).some(
        (ref) => ref.url?.includes('issues/123'),
      ),
    ).toBe(false);
  });

  it('merges cross-host pages for the same task when task context is shared', () => {
    const events = [
      // GitHub issue about authentication
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-issue-auth',
          timestamp: '2026-03-20T09:00:00.000Z',
          url: 'https://github.com/repo/issues/123',
          title: 'Fix authentication bug - Issue #123',
        }),
        content: {
          url: 'https://github.com/repo/issues/123',
          title: 'Fix authentication bug - Issue #123',
          pageText: 'Authentication fails when JWT token expires. Need refresh logic.',
        },
      },
      // External documentation about JWT authentication
      {
        ...createBrowserMemoryEvent({
          id: 'browser:jwt-docs',
          timestamp: '2026-03-20T09:15:00.000Z',
          url: 'https://jwt.io/docs/authentication',
          title: 'JWT Authentication Guide',
        }),
        content: {
          url: 'https://jwt.io/docs/authentication',
          title: 'JWT Authentication Guide',
          pageText: 'Token refresh strategies and expiration handling.',
        },
      },
      // Stack Overflow answer about JWT refresh
      {
        ...createBrowserMemoryEvent({
          id: 'browser:stackoverflow-jwt',
          timestamp: '2026-03-20T09:25:00.000Z',
          url: 'https://stackoverflow.com/questions/jwt-refresh',
          title: 'JWT token refresh implementation',
        }),
        content: {
          url: 'https://stackoverflow.com/questions/jwt-refresh',
          title: 'JWT token refresh implementation',
          pageText: 'Authentication token refresh best practices.',
        },
      },
      // Back to GitHub to implement
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-repo-auth',
          timestamp: '2026-03-20T09:35:00.000Z',
          url: 'https://github.com/repo',
          title: 'Repository - authentication module',
        }),
        content: {
          url: 'https://github.com/repo',
          title: 'Repository - authentication module',
          pageText: 'Implementing JWT refresh in authentication service.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: events,
    });

    // Should create ONE candidate for the authentication task
    expect(candidates.length).toBe(1);

    const authCandidate = candidates[0];

    // Should include all authentication-related pages across different hosts
    expect(authCandidate.title.toLowerCase()).toContain('authentication');

    // Should include GitHub issue
    expect(
      (authCandidate.sourceRefs ?? []).some(
        (ref) => ref.url?.includes('github.com/repo/issues/123'),
      ),
    ).toBe(true);

    // Should include JWT docs (cross-host)
    expect(
      (authCandidate.sourceRefs ?? []).some(
        (ref) => ref.url?.includes('jwt.io'),
      ),
    ).toBe(true);

    // Should include Stack Overflow (cross-host)
    expect(
      (authCandidate.sourceRefs ?? []).some(
        (ref) => ref.url?.includes('stackoverflow.com'),
      ),
    ).toBe(true);

    // Should include GitHub repo
    expect(
      (authCandidate.sourceRefs ?? []).some(
        (ref) => ref.url?.includes('github.com/repo') && !ref.url?.includes('issues'),
      ),
    ).toBe(true);

    // Formation reasons should mention cross-host grouping
    expect(
      (authCandidate.formationReasons ?? []).some(
        (reason) =>
          reason.toLowerCase().includes('host') ||
          reason.toLowerCase().includes('cross') ||
          reason.toLowerCase().includes('shared task'),
      ),
    ).toBe(true);
  });

  it('drops unrelated low-evidence search noise before merging stronger task candidates', () => {
    const taskTerms = [
      'atlas',
      'beacon',
      'cipher',
      'delta',
      'ember',
      'falcon',
      'glacier',
      'harbor',
      'ion',
      'jigsaw',
    ];
    const strongTaskEvents = taskTerms.flatMap((taskTerm, index) => [
      {
        ...createBrowserMemoryEvent({
          id: `browser:strong-docs-${index + 1}`,
          timestamp: `2026-03-20T${String(index).padStart(2, '0')}:00:00.000Z`,
          url: `https://docs.example.com/${taskTerm}/guide`,
          title: `${taskTerm} guide`,
        }),
        content: {
          url: `https://docs.example.com/${taskTerm}/guide`,
          title: `${taskTerm} guide`,
          pageText: `${taskTerm} rollout notes, ${taskTerm} validation steps, and ${taskTerm} ownership checklist.`,
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: `browser:strong-issue-${index + 1}`,
          timestamp: `2026-03-20T${String(index).padStart(2, '0')}:10:00.000Z`,
          url: `https://github.com/example/project/issues/${index + 1}`,
          title: `${taskTerm} issue`,
        }),
        content: {
          url: `https://github.com/example/project/issues/${index + 1}`,
          title: `${taskTerm} issue`,
          pageText: `${taskTerm} incident details, ${taskTerm} follow-up checks, and ${taskTerm} release tracking.`,
        },
      },
    ]);

    const noiseEvents = [
      {
        ...createBrowserMemoryEvent({
          id: 'browser:noise-search-1',
          timestamp: '2026-03-20T10:40:00.000Z',
          url: 'https://google.com/search?q=weather+tomorrow',
          title: 'weather tomorrow - Google Search',
        }),
        content: {
          url: 'https://google.com/search?q=weather+tomorrow',
          title: 'weather tomorrow - Google Search',
          pageText: 'Search results for weather tomorrow in Shanghai.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:noise-search-2',
          timestamp: '2026-03-20T10:42:00.000Z',
          url: 'https://google.com/search?q=lunch+near+me',
          title: 'lunch near me - Google Search',
        }),
        content: {
          url: 'https://google.com/search?q=lunch+near+me',
          title: 'lunch near me - Google Search',
          pageText: 'Search results for lunch near me and nearby restaurants.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: [...strongTaskEvents, ...noiseEvents],
    });

    expect(candidates).toHaveLength(10);
    expect(
      candidates.flatMap((candidate) => candidate.memoryEventIds).includes('browser:noise-search-1'),
    ).toBe(false);
    expect(
      candidates.flatMap((candidate) => candidate.memoryEventIds).includes('browser:noise-search-2'),
    ).toBe(false);
    expect(
      candidates.some((candidate) =>
        (candidate.discardedSourceRefs ?? []).some(
          (source) => source.id === 'browser:noise-search-1' || source.id === 'browser:noise-search-2',
        ),
      ),
    ).toBe(true);
    expect(
      candidates.some((candidate) =>
        (candidate.discardReasons ?? []).some((reason) => reason.includes('Excluded')),
      ),
    ).toBe(true);
    expect(
      candidates.every(
        (candidate) =>
          candidate.memoryEventIds.some((id) => id.startsWith('browser:strong-docs-')) &&
          candidate.memoryEventIds.some((id) => id.startsWith('browser:strong-issue-')),
      ),
    ).toBe(true);
  });

  it('preserves a strong singleton issue as its own candidate when the daily limit is reached', () => {
    const taskTerms = [
      'atlas',
      'beacon',
      'cipher',
      'delta',
      'ember',
      'falcon',
      'glacier',
      'harbor',
      'ion',
    ];
    const broadTasks = taskTerms.flatMap((taskTerm, index) => [
      {
        ...createBrowserMemoryEvent({
          id: `browser:broad-docs-${index + 1}`,
          timestamp: `2026-03-20T${String(index).padStart(2, '0')}:00:00.000Z`,
          url: `https://docs.example.com/${taskTerm}/guide`,
          title: `${taskTerm} guide`,
        }),
        content: {
          url: `https://docs.example.com/${taskTerm}/guide`,
          title: `${taskTerm} guide`,
          pageText: `${taskTerm} plan, ${taskTerm} review notes, and ${taskTerm} verification list.`,
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: `browser:broad-pr-${index + 1}`,
          timestamp: `2026-03-20T${String(index).padStart(2, '0')}:14:00.000Z`,
          url: `https://github.com/example/project/pull/${index + 10}`,
          title: `${taskTerm} rollout PR`,
        }),
        content: {
          url: `https://github.com/example/project/pull/${index + 10}`,
          title: `${taskTerm} rollout PR`,
          pageText: `${taskTerm} patch review, ${taskTerm} diff, and ${taskTerm} launch signoff.`,
        },
      },
    ]);

    const singletonIssue = {
      ...createBrowserMemoryEvent({
        id: 'browser:singleton-issue',
        timestamp: '2026-03-20T10:00:00.000Z',
        url: 'https://github.com/example/project/issues/999',
        title: 'Production login outage',
      }),
      content: {
        url: 'https://github.com/example/project/issues/999',
        title: 'Production login outage',
        pageText:
          'Urgent issue tracking a production login outage, incident scope, rollback, and mitigations.',
      },
    };

    const searchSupport = {
      ...createBrowserMemoryEvent({
        id: 'browser:singleton-search',
        timestamp: '2026-03-20T10:04:00.000Z',
        url: 'https://google.com/search?q=production+login+outage+rollback',
        title: 'production login outage rollback - Google Search',
      }),
      content: {
        url: 'https://google.com/search?q=production+login+outage+rollback',
        title: 'production login outage rollback - Google Search',
        pageText: 'Search results for production login outage rollback and mitigation steps.',
      },
    };

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: [...broadTasks, singletonIssue, searchSupport],
    });

    expect(candidates).toHaveLength(10);
    expect(
      candidates.some((candidate) => candidate.memoryEventIds.includes('browser:singleton-issue')),
    ).toBe(true);
    expect(
      candidates.find((candidate) => candidate.memoryEventIds.includes('browser:singleton-issue')),
    ).toMatchObject({
      memoryEventIds: ['browser:singleton-issue', 'browser:singleton-search'],
    });
  });

  it('merges weak supporting pages into the matching task before touching unrelated task candidates', () => {
    const taskTerms = [
      'atlas',
      'beacon',
      'cipher',
      'delta',
      'ember',
      'falcon',
      'glacier',
      'harbor',
      'ion',
    ];
    const broadTasks = taskTerms.flatMap((taskTerm, index) => [
      {
        ...createBrowserMemoryEvent({
          id: `browser:task-docs-${index + 1}`,
          timestamp: `2026-03-20T${String(index).padStart(2, '0')}:00:00.000Z`,
          url: `https://docs.example.com/${taskTerm}/guide`,
          title: `${taskTerm} guide`,
        }),
        content: {
          url: `https://docs.example.com/${taskTerm}/guide`,
          title: `${taskTerm} guide`,
          pageText: `${taskTerm} plan, ${taskTerm} notes, and ${taskTerm} verification.`,
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: `browser:task-issue-${index + 1}`,
          timestamp: `2026-03-20T${String(index).padStart(2, '0')}:09:00.000Z`,
          url: `https://github.com/example/project/issues/${index + 100}`,
          title: `${taskTerm} issue`,
        }),
        content: {
          url: `https://github.com/example/project/issues/${index + 100}`,
          title: `${taskTerm} issue`,
          pageText: `${taskTerm} issue summary, ${taskTerm} status, and ${taskTerm} release checks.`,
        },
      },
    ]);

    const targetTask = [
      {
        ...createBrowserMemoryEvent({
          id: 'browser:target-docs',
          timestamp: '2026-03-20T09:00:00.000Z',
          url: 'https://docs.example.com/cache/invalidation',
          title: 'Cache invalidation guide',
        }),
        content: {
          url: 'https://docs.example.com/cache/invalidation',
          title: 'Cache invalidation guide',
          pageText: 'MirrorBrain stale cache invalidation guide and recovery steps.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:target-issue',
          timestamp: '2026-03-20T09:12:00.000Z',
          url: 'https://github.com/example/project/issues/777',
          title: 'Fix stale cache after sync',
        }),
        content: {
          url: 'https://github.com/example/project/issues/777',
          title: 'Fix stale cache after sync',
          pageText: 'Issue for stale cache after browser sync and invalidation failures.',
        },
      },
    ];

    const supportingPage = {
      ...createBrowserMemoryEvent({
        id: 'browser:target-search',
        timestamp: '2026-03-20T09:06:00.000Z',
        url: 'https://google.com/search?q=mirrorbrain+stale+cache+rollback',
        title: 'mirrorbrain stale cache rollback - Google Search',
      }),
      content: {
        url: 'https://google.com/search?q=mirrorbrain+stale+cache+rollback',
        title: 'mirrorbrain stale cache rollback - Google Search',
        pageText: 'Search results for mirrorbrain stale cache rollback and invalidation recovery.',
      },
    };

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: [...broadTasks, ...targetTask, supportingPage],
    });

    expect(candidates).toHaveLength(10);
    expect(
      candidates.find((candidate) => candidate.memoryEventIds.includes('browser:target-docs')),
    ).toMatchObject({
      memoryEventIds: ['browser:target-docs', 'browser:target-search', 'browser:target-issue'],
    });
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
        primarySourceCount: expect.any(Number),
        supportingSourceCount: expect.any(Number),
        evidenceSummary: expect.stringContaining('primary'),
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
        primarySourceCount: expect.any(Number),
        supportingSourceCount: expect.any(Number),
        evidenceSummary: expect.stringContaining('supporting'),
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

  it('treats issue plus pull request plus repository activity as code review instead of bug fix', () => {
    const [candidate] = createCandidateMemories({
      reviewDate: '2026-04-15',
      memoryEvents: [
        {
          ...createBrowserMemoryEvent({
            id: 'browser:review-issue',
            timestamp: '2026-04-15T08:00:00.000Z',
            url: 'https://github.com/example/repo/issues/123',
            title: 'Review rollout risk for cache migration',
          }),
          content: {
            url: 'https://github.com/example/repo/issues/123',
            title: 'Review rollout risk for cache migration',
            pageText:
              'Review rollout risk, acceptance criteria, and edge cases for cache migration.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:review-pr',
            timestamp: '2026-04-15T08:12:00.000Z',
            url: 'https://github.com/example/repo/pull/456',
            title: 'Cache migration rollout review',
          }),
          content: {
            url: 'https://github.com/example/repo/pull/456',
            title: 'Cache migration rollout review',
            pageText:
              'Pull request review for cache migration rollout and reviewer comments.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:review-repo',
            timestamp: '2026-04-15T08:20:00.000Z',
            url: 'https://github.com/example/repo',
            title: 'Repository overview',
          }),
          content: {
            url: 'https://github.com/example/repo',
            title: 'Repository overview',
            pageText:
              'Repository files changed for cache migration rollout review and verification.',
          },
        },
      ],
    });

    const [suggestion] = suggestCandidateReviews([candidate]);

    expect(suggestion?.rationale.toLowerCase()).toContain('review');
    expect(suggestion?.supportingReasons?.some((reason) => reason.toLowerCase().includes('review workflow'))).toBe(true);
  });

  it('splits same-topic browser activity into separate candidates when sessions are far apart', () => {
    const candidates = createCandidateMemories({
      reviewDate: '2026-04-15',
      memoryEvents: [
        {
          ...createBrowserMemoryEvent({
            id: 'browser:session-1-docs',
            timestamp: '2026-04-15T01:00:00.000Z',
            url: 'https://docs.example.com/cache/invalidation',
            title: 'Cache invalidation guide',
          }),
          content: {
            url: 'https://docs.example.com/cache/invalidation',
            title: 'Cache invalidation guide',
            pageText: 'Cache invalidation guide for stale cache mitigation and recovery.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:session-1-issue',
            timestamp: '2026-04-15T01:20:00.000Z',
            url: 'https://github.com/example/repo/issues/777',
            title: 'Fix stale cache after sync',
          }),
          content: {
            url: 'https://github.com/example/repo/issues/777',
            title: 'Fix stale cache after sync',
            pageText: 'Issue for stale cache after sync and invalidation failures.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:session-2-docs',
            timestamp: '2026-04-15T08:00:00.000Z',
            url: 'https://docs.example.com/cache/invalidation',
            title: 'Cache invalidation guide',
          }),
          content: {
            url: 'https://docs.example.com/cache/invalidation',
            title: 'Cache invalidation guide',
            pageText: 'Cache invalidation guide for stale cache mitigation and recovery.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:session-2-pr',
            timestamp: '2026-04-15T08:10:00.000Z',
            url: 'https://github.com/example/repo/pull/778',
            title: 'Cache invalidation rollout',
          }),
          content: {
            url: 'https://github.com/example/repo/pull/778',
            title: 'Cache invalidation rollout',
            pageText: 'Pull request for cache invalidation rollout and verification.',
          },
        },
      ],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.timeRange).toMatchObject({
      startAt: '2026-04-15T01:00:00.000Z',
      endAt: '2026-04-15T01:20:00.000Z',
    });
    expect(candidates[1]?.timeRange).toMatchObject({
      startAt: '2026-04-15T08:00:00.000Z',
      endAt: '2026-04-15T08:10:00.000Z',
    });
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

  it('marks core task pages as primary sources and auxiliary pages as supporting sources', () => {
    const [candidate] = createCandidateMemories({
      reviewDate: '2026-04-14',
      memoryEvents: [
        {
          ...createBrowserMemoryEvent({
            id: 'browser:search-primary',
            timestamp: '2026-04-14T09:00:00.000Z',
            url: 'https://google.com/search?q=mirrorbrain+stale+cache',
            title: 'mirrorbrain stale cache - Google Search',
          }),
          content: {
            url: 'https://google.com/search?q=mirrorbrain+stale+cache',
            title: 'mirrorbrain stale cache - Google Search',
            pageText: 'Search results for mirrorbrain stale cache invalidation bug.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:docs-primary',
            timestamp: '2026-04-14T09:04:00.000Z',
            url: 'https://docs.example.com/cache/invalidation',
            title: 'Cache invalidation guide',
          }),
          content: {
            url: 'https://docs.example.com/cache/invalidation',
            title: 'Cache invalidation guide',
            pageText:
              'MirrorBrain cache invalidation guide for stale cache recovery after browser sync.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:issue-primary',
            timestamp: '2026-04-14T09:12:00.000Z',
            url: 'https://github.com/example/platform/issues/77',
            title: 'Fix stale cache after sync',
          }),
          content: {
            url: 'https://github.com/example/platform/issues/77',
            title: 'Fix stale cache after sync',
            pageText:
              'Issue tracking stale cache after browser sync and invalidation failures.',
          },
        },
        {
          ...createBrowserMemoryEvent({
            id: 'browser:chat-supporting',
            timestamp: '2026-04-14T09:16:00.000Z',
            url: 'https://chatgpt.com/c/stale-cache',
            title: 'stale cache investigation',
          }),
          content: {
            url: 'https://chatgpt.com/c/stale-cache',
            title: 'stale cache investigation',
            pageText: 'Reason about stale cache debugging steps in MirrorBrain.',
          },
        },
      ],
    });

    expect(candidate?.sourceRefs).toEqual([
      expect.objectContaining({
        id: 'browser:search-primary',
        role: 'search',
        contribution: 'supporting',
      }),
      expect.objectContaining({
        id: 'browser:docs-primary',
        role: 'docs',
        contribution: 'primary',
      }),
      expect.objectContaining({
        id: 'browser:issue-primary',
        role: 'issue',
        contribution: 'primary',
      }),
      expect.objectContaining({
        id: 'browser:chat-supporting',
        role: 'chat',
        contribution: 'supporting',
      }),
    ]);
  });

  it('generates task-oriented titles with action verbs', () => {
    const events = [
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-issue-1',
          timestamp: '2026-03-20T09:00:00.000Z',
          url: 'https://github.com/repo/issues/123',
          title: 'Fix authentication bug - Issue #123',
        }),
        content: {
          url: 'https://github.com/repo/issues/123',
          title: 'Fix authentication bug - Issue #123',
          pageText: 'Authentication fails when token expires.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-pr-1',
          timestamp: '2026-03-20T09:30:00.000Z',
          url: 'https://github.com/repo/pull/456',
          title: 'Implement token refresh - PR #456',
        }),
        content: {
          url: 'https://github.com/repo/pull/456',
          title: 'Implement token refresh - PR #456',
          pageText: 'Added JWT refresh logic for authentication.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: events,
    });

    // Title should use action verb from roles (fix, implement)
    // Should be more like "Fix authentication bug" instead of "Work on Authentication Bug"
    expect(candidates[0].title).toMatch(/^(Fix|Implement|Debug|Review|Build|Update|Add|Remove)/);
    expect(candidates[0].title.toLowerCase()).toContain('authentication');
  });

  it('creates task summaries that describe what was done', () => {
    const events = [
      {
        ...createBrowserMemoryEvent({
          id: 'browser:docs-1',
          timestamp: '2026-03-20T09:00:00.000Z',
          url: 'https://docs.example.com/api/authentication',
          title: 'Authentication API documentation',
        }),
        content: {
          url: 'https://docs.example.com/api/authentication',
          title: 'Authentication API documentation',
          pageText: 'How to implement JWT token refresh.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:stackoverflow-1',
          timestamp: '2026-03-20T09:20:00.000Z',
          url: 'https://stackoverflow.com/questions/jwt-refresh',
          title: 'JWT token refresh implementation',
        }),
        content: {
          url: 'https://stackoverflow.com/questions/jwt-refresh',
          title: 'JWT token refresh implementation',
          pageText: 'Best practices for authentication token refresh.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: events,
    });

    // Summary should describe the task, not just event counts
    // Should be like "Reviewed authentication documentation and best practices"
    // instead of "2 browser events connected to Work on Authentication Jwt across 2 sites"
    expect(candidates[0].summary).toMatch(/^(Reviewed|Investigated|Implemented|Fixed|Debugged|Built|Updated|Explored)/);
    expect(candidates[0].summary.toLowerCase()).not.toContain('browser events connected to');
    expect(candidates[0].summary.toLowerCase()).not.toContain('across');
  });

describe('AI guidance quality', () => {
  it('generates contextual rationale for bug fix tasks', () => {
    const events = [
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-issue',
          timestamp: '2026-03-20T09:00:00.000Z',
          url: 'https://github.com/repo/issues/123',
          title: 'Fix authentication bug - Issue #123',
        }),
        content: {
          url: 'https://github.com/repo/issues/123',
          title: 'Fix authentication bug - Issue #123',
          pageText: 'Authentication fails when token expires.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:docs',
          timestamp: '2026-03-20T09:20:00.000Z',
          url: 'https://docs.example.com/auth/debug',
          title: 'Authentication debugging guide',
        }),
        content: {
          url: 'https://docs.example.com/auth/debug',
          title: 'Authentication debugging guide',
          pageText: 'How to debug token expiration issues.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: events,
    });

    const suggestions = suggestCandidateReviews(candidates);

    // Rationale should mention bug fix context
    expect(suggestions[0].rationale.toLowerCase()).toMatch(/bug|fix|debug|issue/);
    expect(suggestions[0].rationale).not.toBe(
      'This candidate has enough repeated and sustained activity to preserve as a meaningful work item.',
    );

    // Supporting reasons should describe patterns, not just counts
    expect(
      suggestions[0].supportingReasons?.some(reason =>
        reason.toLowerCase().includes('issue') ||
        reason.toLowerCase().includes('debugging') ||
        reason.toLowerCase().includes('documentation')
      ),
    ).toBe(true);
  });

  it('generates contextual rationale for feature implementation', () => {
    const events = [
      {
        ...createBrowserMemoryEvent({
          id: 'browser:github-pr',
          timestamp: '2026-03-20T10:00:00.000Z',
          url: 'https://github.com/repo/pull/456',
          title: 'Implement JWT refresh - PR #456',
        }),
        content: {
          url: 'https://github.com/repo/pull/456',
          title: 'Implement JWT refresh - PR #456',
          pageText: 'JWT refresh implementation for authentication.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:jwt-docs',
          timestamp: '2026-03-20T10:30:00.000Z',
          url: 'https://jwt.io/docs',
          title: 'JWT documentation',
        }),
        content: {
          url: 'https://jwt.io/docs',
          title: 'JWT documentation',
          pageText: 'JWT implementation best practices.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: events,
    });

    const suggestions = suggestCandidateReviews(candidates);

    // Rationale should mention feature implementation
    expect(suggestions[0].rationale.toLowerCase()).toMatch(/implement|feature|integration|end-to-end/);
    expect(suggestions[0].rationale).not.toBe(
      'This candidate has enough repeated and sustained activity to preserve as a meaningful work item.',
    );

    // Should recognize cross-host pattern for implementation work
    expect(
      suggestions[0].supportingReasons?.some(reason =>
        reason.toLowerCase().includes('cross-host') ||
        reason.toLowerCase().includes('github') ||
        reason.toLowerCase().includes('documentation')
      ),
    ).toBe(true);
  });

  it('generates contextual rationale for research tasks', () => {
    const events = [
      {
        ...createBrowserMemoryEvent({
          id: 'browser:docs-1',
          timestamp: '2026-03-20T11:00:00.000Z',
          url: 'https://docs.example.com/api/authentication',
          title: 'Authentication API reference',
        }),
        content: {
          url: 'https://docs.example.com/api/authentication',
          title: 'Authentication API reference',
          pageText: 'API authentication guide.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:stackoverflow',
          timestamp: '2026-03-20T11:15:00.000Z',
          url: 'https://stackoverflow.com/questions/auth',
          title: 'Authentication best practices',
        }),
        content: {
          url: 'https://stackoverflow.com/questions/auth',
          title: 'Authentication best practices',
          pageText: 'Community authentication patterns.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: events,
    });

    const suggestions = suggestCandidateReviews(candidates);

    // Rationale should recognize research pattern
    expect(suggestions[0].rationale.toLowerCase()).toMatch(/research|investigat|document|prepar|knowledge|learn/);
    expect(suggestions[0].rationale).not.toBe(
      'This candidate has enough repeated and sustained activity to preserve as a meaningful work item.',
    );

    // Should mention documentation-heavy pattern
    expect(
      suggestions[0].supportingReasons?.some(reason =>
        reason.toLowerCase().includes('documentation') ||
        reason.toLowerCase().includes('research') ||
        reason.toLowerCase().includes('reference')
      ),
    ).toBe(true);
  });

  it('excludes local debugging pages before generating review guidance', () => {
    const events = [
      {
        ...createBrowserMemoryEvent({
          id: 'browser:localhost-1',
          timestamp: '2026-03-20T14:00:00.000Z',
          url: 'http://localhost:3000/debug',
          title: 'Debug dashboard',
        }),
        content: {
          url: 'http://localhost:3000/debug',
          title: 'Debug dashboard',
          pageText: 'Local debugging session.',
        },
      },
      {
        ...createBrowserMemoryEvent({
          id: 'browser:docs-debug',
          timestamp: '2026-03-20T14:20:00.000Z',
          url: 'https://docs.example.com/debugging',
          title: 'Debugging guide',
        }),
        content: {
          url: 'https://docs.example.com/debugging',
          title: 'Debugging guide',
          pageText: 'How to debug local issues.',
        },
      },
    ];

    const candidates = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: events,
    });
    const suggestions = suggestCandidateReviews(candidates);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].memoryEventIds).toEqual(['browser:docs-debug']);
    expect(candidates[0]?.sourceRefs?.map((sourceRef) => sourceRef.url)).toEqual([
      'https://docs.example.com/debugging',
    ]);
    expect(
      suggestions[0].supportingReasons?.some((reason) =>
        reason.toLowerCase().includes('localhost') ||
        reason.toLowerCase().includes('local')
      ),
    ).toBe(false);
  });
});
});
