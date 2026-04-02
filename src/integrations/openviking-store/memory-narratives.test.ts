import { describe, expect, it, vi } from 'vitest';

import type { MemoryNarrative } from '../../shared/types/index.js';
import {
  ingestMemoryNarrativeToOpenViking,
  listMirrorBrainMemoryNarrativesFromOpenViking,
} from './index.js';

const narrativeFixture: MemoryNarrative = {
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
  ],
  queryHints: ['vitest config', 'vitest'],
};

describe('openviking store memory narratives', () => {
  it('imports a memory narrative into OpenViking through the resources API', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ result: { root_uri: 'viking://resources/mirrorbrain-memory-narratives-memory-narrative-browser-theme-2026-03-20-vitest-config-json' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      ingestMemoryNarrativeToOpenViking(
        {
          baseUrl: 'http://127.0.0.1:1933',
          workspaceDir: '/tmp/mirrorbrain',
          artifact: narrativeFixture,
        },
        fetchImpl,
      ),
    ).resolves.toMatchObject({
      rootUri:
        'viking://resources/mirrorbrain-memory-narratives-memory-narrative-browser-theme-2026-03-20-vitest-config-json',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:1933/api/v1/resources',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('lists memory narratives from OpenViking resources', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes('/api/v1/fs/ls')) {
        return new Response(
          JSON.stringify({
            result: [
              {
                name: 'mirrorbrain-memory-narratives-memory-narrative-browser-theme-2026-03-20-vitest-config-json',
                uri: 'viking://resources/mirrorbrain-memory-narratives-memory-narrative-browser-theme-2026-03-20-vitest-config-json',
                isDir: false,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/api/v1/content/read')) {
        return new Response(JSON.stringify({ result: JSON.stringify(narrativeFixture) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(null, { status: 404 });
    });

    await expect(
      listMirrorBrainMemoryNarrativesFromOpenViking(
        {
          baseUrl: 'http://127.0.0.1:1933',
        },
        fetchImpl,
      ),
    ).resolves.toEqual([narrativeFixture]);
  });
});
