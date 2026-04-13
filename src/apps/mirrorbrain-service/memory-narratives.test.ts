import { describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type { MemoryNarrative } from '../../shared/types/index.js';
import { createMirrorBrainService } from './index.js';

const browserNarrative: MemoryNarrative = {
  id: 'memory-narrative:browser-theme:2026-03-20:vitest-config',
  narrativeType: 'browser-theme',
  sourceCategory: 'browser',
  title: 'Vitest Config',
  theme: 'Vitest Config',
  summary: 'You researched Vitest Config by searching and reading documentation across 2 pages and 3 browser visits.',
  timeRange: {
    startAt: '2026-03-20T08:00:00.000Z',
    endAt: '2026-03-20T08:06:00.000Z',
  },
  sourceEventIds: ['browser:1'],
  sourceRefs: [
    {
      id: 'browser:1',
      sourceType: 'activitywatch-browser',
      sourceRef: '1',
      timestamp: '2026-03-20T08:00:00.000Z',
    },
  ],
  queryHints: ['vitest config'],
};

describe('mirrorbrain service memory narratives', () => {
  it('rebuilds and publishes browser theme narratives after browser sync', async () => {
    const expectedMemoryEvents = [
      {
        id: 'browser:1',
        sourceType: 'activitywatch-browser',
        sourceRef: '1',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: { url: 'https://docs.example.com/vitest/config', title: 'Vitest Config Guide | Docs' },
        captureMetadata: { upstreamSource: 'activitywatch', checkpoint: '2026-03-20T08:00:00.000Z' },
      },
    ];
    const syncBrowserMemory = vi.fn(async () => ({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'incremental' as const,
      importedCount: 1,
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
    }));
    const listMemoryEvents = vi.fn(async () => expectedMemoryEvents);
    const buildBrowserThemeNarratives = vi.fn(() => [browserNarrative]);
    const publishMemoryNarrative = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain/memory-narratives/memory-narrative-browser-theme.json',
      rootUri: 'viking://resources/mirrorbrain-memory-narratives-memory-narrative-browser-theme.json',
    }));

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory,
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        listMemoryEvents,
        buildBrowserThemeNarratives,
        publishMemoryNarrative,
      },
    );

    await expect(api.syncBrowserMemory()).resolves.toMatchObject({
      importedCount: 1,
    });

    expect(buildBrowserThemeNarratives).toHaveBeenCalledWith({
      memoryEvents: expectedMemoryEvents,
    });
    expect(publishMemoryNarrative).toHaveBeenCalledWith({
      baseUrl: getMirrorBrainConfig().openViking.baseUrl,
      workspaceDir: process.cwd(),
      artifact: browserNarrative,
    });
  });

  it('returns browser sync before background narrative rebuild finishes', async () => {
    const expectedMemoryEvents = [
      {
        id: 'browser:1',
        sourceType: 'activitywatch-browser',
        sourceRef: '1',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: { url: 'https://docs.example.com/vitest/config', title: 'Vitest Config Guide | Docs' },
        captureMetadata: { upstreamSource: 'activitywatch', checkpoint: '2026-03-20T08:00:00.000Z' },
      },
    ];
    let resolveListMemoryEvents: ((value: typeof expectedMemoryEvents) => void) | undefined;
    const syncBrowserMemory = vi.fn(async () => ({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'incremental' as const,
      importedCount: 1,
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
      importedEvents: expectedMemoryEvents,
    }));
    const listMemoryEvents = vi.fn(
      () =>
        new Promise<typeof expectedMemoryEvents>((resolve) => {
          resolveListMemoryEvents = resolve;
        }),
    );
    const buildBrowserThemeNarratives = vi.fn(() => [browserNarrative]);
    const publishMemoryNarrative = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain/memory-narratives/memory-narrative-browser-theme.json',
      rootUri: 'viking://resources/mirrorbrain-memory-narratives-memory-narrative-browser-theme.json',
    }));

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory,
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        listMemoryEvents,
        buildBrowserThemeNarratives,
        publishMemoryNarrative,
      },
    );

    let resolved = false;
    const syncPromise = api.syncBrowserMemory().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(resolved).toBe(true);
    expect(listMemoryEvents).toHaveBeenCalledTimes(1);

    if (resolveListMemoryEvents !== undefined) {
      resolveListMemoryEvents(expectedMemoryEvents);
    }
    await syncPromise;
  });
});
