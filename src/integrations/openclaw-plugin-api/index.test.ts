import { describe, expect, it } from 'vitest';

import {
  listKnowledge,
  listSkillDrafts,
  queryMemory,
} from './index.js';

describe('openclaw plugin api', () => {
  it('returns theme-level memory retrieval results from OpenViking memory events', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/tasks',
                title: 'Example Tasks',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toEqual({
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      items: [
        {
          id: 'memory-result:activitywatch-browser-example-tasks',
          theme: 'Example Tasks',
          title: 'Example Tasks',
          summary:
            'You viewed 1 page about Example Tasks during the requested time range.',
          timeRange: {
            startAt: '2026-03-20T08:00:00.000Z',
            endAt: '2026-03-20T08:00:00.000Z',
          },
          sourceRefs: [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
            },
          ],
        },
      ],
    });
  });

  it('prioritizes repeated browser themes ahead of one-off pages when shaping retrieval results', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/one-off',
                title: 'One-off page',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T09:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow-2',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          title: 'Review workflow',
          summary:
            'You reviewed 2 pages about Review workflow across 2 browser visits during the requested time range.',
        },
        {
          theme: 'One-off page',
          title: 'One-off page',
          summary:
            'You viewed 1 page about One-off page during the requested time range.',
        },
      ],
    });
  });

  it('compresses repeated visits to the same browser url into a single representative source ref', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:01:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:01:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T08:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow-notes',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You reviewed 2 pages about Review workflow across 3 browser visits during the requested time range.',
          sourceRefs: [
            {
              id: 'browser:aw-event-1',
              sourceRef: 'aw-event-1',
            },
            {
              id: 'browser:aw-event-3',
              sourceRef: 'aw-event-3',
            },
          ],
        },
      ],
    });
  });

  it('uses a browser-oriented summary that reflects repeated visits and unique pages', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:01:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:01:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T08:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow-notes',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You reviewed 2 pages about Review workflow across 3 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('keeps repeated browser themes ahead of one-off pages after url compression', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/one-off',
                title: 'One-off page',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T09:01:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:01:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You revisited 1 page about Review workflow across 2 browser visits during the requested time range.',
        },
        {
          theme: 'One-off page',
          summary:
            'You viewed 1 page about One-off page during the requested time range.',
        },
      ],
    });
  });

  it('prioritizes themes by grouped event count even when url compression leaves fewer source refs', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/repeated-theme',
                title: 'Repeated theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/repeated-theme',
                title: 'Repeated theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:05:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T08:10:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/repeated-theme',
                title: 'Repeated theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:10:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-4',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-4',
              timestamp: '2026-03-20T08:15:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/repeated-theme',
                title: 'Repeated theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:15:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-5',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-5',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/split-theme-1',
                title: 'Split theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-6',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-6',
              timestamp: '2026-03-20T09:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/split-theme-2',
                title: 'Split theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Repeated theme',
          summary:
            'You revisited 1 page about Repeated theme across 4 browser visits during the requested time range.',
        },
        {
          theme: 'Split theme',
          summary:
            'You reviewed 2 pages about Split theme across 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('returns knowledge drafts from OpenViking', async () => {
    await expect(
      listKnowledge(
        {
          baseUrl: 'http://127.0.0.1:1933',
        },
        {
          listKnowledgeArtifacts: async () => [
            {
              id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
              draftState: 'draft',
              sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
            },
          ],
        },
      ),
    ).resolves.toEqual([
      {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    ]);
  });

  it('returns skill drafts from OpenViking', async () => {
    await expect(
      listSkillDrafts(
        {
          baseUrl: 'http://127.0.0.1:1933',
        },
        {
          listSkillArtifacts: async () => [
            {
              id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
              approvalState: 'draft',
              workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
              executionSafetyMetadata: {
                requiresConfirmation: true,
              },
            },
          ],
        },
      ),
    ).resolves.toEqual([
      {
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    ]);
  });
});
