import { describe, expect, it } from 'vitest';

import { generateBrowserThemeNarratives } from './index.js';

describe('browser theme narratives', () => {
  it('creates offline daily browser theme narratives from repeated browser activity', () => {
    expect(
      generateBrowserThemeNarratives({
        memoryEvents: [
          {
            id: 'browser:1',
            sourceType: 'activitywatch-browser',
            sourceRef: '1',
            timestamp: '2026-03-20T08:00:00.000Z',
            authorizationScopeId: 'scope-browser',
            content: {
              url: 'https://search.example.com/?q=vitest+config',
              title: 'Vitest config - Search',
            },
            captureMetadata: {
              upstreamSource: 'activitywatch',
              checkpoint: '2026-03-20T08:00:00.000Z',
            },
          },
          {
            id: 'browser:2',
            sourceType: 'activitywatch-browser',
            sourceRef: '2',
            timestamp: '2026-03-20T08:04:00.000Z',
            authorizationScopeId: 'scope-browser',
            content: {
              url: 'https://docs.example.com/vitest/config',
              title: 'Vitest Config Guide | Docs',
            },
            captureMetadata: {
              upstreamSource: 'activitywatch',
              checkpoint: '2026-03-20T08:04:00.000Z',
            },
          },
          {
            id: 'browser:3',
            sourceType: 'activitywatch-browser',
            sourceRef: '3',
            timestamp: '2026-03-20T08:06:00.000Z',
            authorizationScopeId: 'scope-browser',
            content: {
              url: 'https://docs.example.com/vitest/config',
              title: 'Vitest Config Guide | Docs',
            },
            captureMetadata: {
              upstreamSource: 'activitywatch',
              checkpoint: '2026-03-20T08:06:00.000Z',
            },
          },
        ],
      }),
    ).toEqual([
      {
        id: 'memory-narrative:browser-theme:2026-03-20:vitest-config',
        narrativeType: 'browser-theme',
        sourceCategory: 'browser',
        title: 'Vitest Config',
        theme: 'Vitest Config',
        summary:
          'You researched Vitest Config by searching and reading documentation across 2 pages and 3 browser visits.',
        timeRange: {
          startAt: '2026-03-20T08:00:00.000Z',
          endAt: '2026-03-20T08:06:00.000Z',
        },
        sourceEventIds: ['browser:1', 'browser:2', 'browser:3'],
        sourceRefs: [
          {
            id: 'browser:1',
            sourceType: 'activitywatch-browser',
            sourceRef: '1',
            timestamp: '2026-03-20T08:00:00.000Z',
          },
          {
            id: 'browser:2',
            sourceType: 'activitywatch-browser',
            sourceRef: '2',
            timestamp: '2026-03-20T08:04:00.000Z',
          },
        ],
        queryHints: ['vitest config', 'vitest'],
      },
    ]);
  });
});
