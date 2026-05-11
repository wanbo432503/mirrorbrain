import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import { createOpenVikingMemoryEventRecord } from '../../integrations/openviking-store/index.js';
import {
  runBrowserMemorySyncOnce,
  startBrowserMemorySyncPolling,
} from './index.js';

describe('browser memory sync workflow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes browser source authorization policy to the generic sync workflow', async () => {
    let browserEventsFetched = false;
    let persisted = false;

    await expect(
      runBrowserMemorySyncOnce(
        {
          config: getMirrorBrainConfig(),
          now: '2026-03-20T08:00:00.000Z',
          bucketId: 'aw-watcher-web-chrome',
          scopeId: 'scope-browser',
          workspaceDir: '/tmp/mirrorbrain',
        },
        {
          checkpointStore: {
            readCheckpoint: async () => null,
            writeCheckpoint: async () => undefined,
          },
          fetchBrowserEvents: async () => {
            browserEventsFetched = true;
            return [];
          },
          authorizeSourceSync: async (source) => {
            expect(source).toEqual({
              sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
              sourceCategory: 'browser',
              scopeId: 'scope-browser',
            });
            return false;
          },
          writeMemoryEvent: async () => {
            persisted = true;
          },
        },
      ),
    ).rejects.toThrowError(
      'Memory source activitywatch-browser:aw-watcher-web-chrome is not authorized for scope scope-browser.',
    );

    expect(browserEventsFetched).toBe(false);
    expect(persisted).toBe(false);
  });

  it('runs an initial backfill when no checkpoint exists and persists the latest checkpoint', async () => {
    const config = getMirrorBrainConfig();
    const checkpoints: Array<{
      sourceKey: string;
      lastSyncedAt: string;
      updatedAt: string;
    }> = [];
    const persistedRecordIds: string[] = [];
    const persistedRecordContents: Array<Record<string, unknown>> = [];

    const result = await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T08:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
        workspaceDir: '/tmp/mirrorbrain',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async (checkpoint) => {
            checkpoints.push(checkpoint);
          },
        },
        fetchBrowserEvents: async (input) => {
          expect(input).toMatchObject({
            baseUrl: 'http://127.0.0.1:5600',
            bucketId: 'aw-watcher-web-chrome',
            start: '2026-03-19T08:00:00.000Z',
            end: '2026-03-20T08:00:00.000Z',
          });

          return [
            {
              id: 'aw-event-1',
              timestamp: '2026-03-20T07:45:00.000Z',
              data: {
                url: 'https://example.com/tasks',
                title: 'Example Tasks',
              },
            },
            {
              id: 'aw-event-2',
              timestamp: '2026-03-20T08:00:00.000Z',
              data: {
                url: 'https://example.com/review',
                title: 'Review',
              },
            },
          ];
        },
        fetchPageContent: async ({ url, title, fetchedAt }) => ({
          url,
          title,
          fetchedAt,
          text: `Stored text for ${title}`,
        }),
        ingestPageContent: async ({ artifact }) => ({
          sourcePath: `/tmp/mirrorbrain/mirrorbrain/browser-page-content/${artifact.id}.md`,
          rootUri: `viking://resources/mirrorbrain-browser-page-content-${artifact.id}.md`,
        }),
        writeMemoryEvent: async (record) => {
          persistedRecordIds.push(record.recordId);
          persistedRecordContents.push(record.payload.content);
        },
      },
    );

    expect(persistedRecordIds).toEqual([
      createOpenVikingMemoryEventRecord({
        id: 'browser:aw-event-1',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-03-20T07:45:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/tasks',
          title: 'Example Tasks',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T07:45:00.000Z',
        },
      }).recordId,
      createOpenVikingMemoryEventRecord({
        id: 'browser:aw-event-2',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-2',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/review',
          title: 'Review',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:00:00.000Z',
        },
      }).recordId,
    ]);
    expect(checkpoints).toEqual([
      {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        lastSyncedAt: '2026-03-20T08:00:00.000Z',
        updatedAt: '2026-03-20T08:00:00.000Z',
      },
    ]);
    expect(persistedRecordContents[0]).toMatchObject({
      url: 'https://example.com/tasks',
      title: 'Example Tasks',
      latestAccessedAt: '2026-03-20T07:45:00.000Z',
      accessTimes: ['2026-03-20T07:45:00.000Z'],
    });
    expect(persistedRecordContents[0]).not.toHaveProperty('textStorage');
    expect(result).toEqual({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'initial-backfill',
      importedCount: 2,
      lastSyncedAt: '2026-03-20T08:00:00.000Z',
      importedEvents: [
        {
          id: 'browser:aw-event-1',
          sourceType: 'activitywatch-browser',
          sourceRef: 'aw-event-1',
          timestamp: '2026-03-20T07:45:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {
            url: 'https://example.com/tasks',
            title: 'Example Tasks',
            latestAccessedAt: '2026-03-20T07:45:00.000Z',
            accessTimes: ['2026-03-20T07:45:00.000Z'],
          },
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-03-20T07:45:00.000Z',
          },
        },
        {
          id: 'browser:aw-event-2',
          sourceType: 'activitywatch-browser',
          sourceRef: 'aw-event-2',
          timestamp: '2026-03-20T08:00:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {
            url: 'https://example.com/review',
            title: 'Review',
            latestAccessedAt: '2026-03-20T08:00:00.000Z',
            accessTimes: ['2026-03-20T08:00:00.000Z'],
          },
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-03-20T08:00:00.000Z',
          },
        },
      ],
    });
  });

  it('fetches and stores shared page content once for repeated url visits in the same sync', async () => {
    const config = getMirrorBrainConfig();
    const fetchPageContent = vi.fn(async ({ url, title, fetchedAt }) => ({
      url,
      title,
      fetchedAt,
      text: 'Shared text',
    }));
    const ingestPageContent = vi.fn(async ({ artifact }) => ({
      sourcePath: `/tmp/mirrorbrain/mirrorbrain/browser-page-content/${artifact.id}.md`,
      rootUri: `viking://resources/mirrorbrain-browser-page-content-${artifact.id}.md`,
    }));

    const result = await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T08:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
        workspaceDir: '/tmp/mirrorbrain',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async () => undefined,
        },
        fetchBrowserEvents: async () => [
          {
            id: 'aw-event-1',
            timestamp: '2026-03-20T07:45:00.000Z',
            data: {
              url: 'https://example.com/tasks',
              title: 'Example Tasks',
            },
          },
          {
            id: 'aw-event-2',
            timestamp: '2026-03-20T08:00:00.000Z',
            data: {
              url: 'https://example.com/tasks',
              title: 'Updated Example Tasks',
            },
          },
        ],
        fetchPageContent,
        ingestPageContent,
        writeMemoryEvent: async () => undefined,
      },
    );

    expect(result.importedEvents?.[0]?.content).toMatchObject({
      url: 'https://example.com/tasks',
      title: 'Example Tasks',
      latestAccessedAt: '2026-03-20T08:00:00.000Z',
      accessTimes: ['2026-03-20T08:00:00.000Z', '2026-03-20T07:45:00.000Z'],
    });
    expect(result.importedEvents?.[1]?.content).toMatchObject({
      url: 'https://example.com/tasks',
      title: 'Example Tasks',
      latestAccessedAt: '2026-03-20T08:00:00.000Z',
      accessTimes: ['2026-03-20T08:00:00.000Z', '2026-03-20T07:45:00.000Z'],
    });
    expect(result.importedEvents?.[0]?.content).not.toHaveProperty('textStorage');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchPageContent).toHaveBeenCalledTimes(1);
    expect(ingestPageContent).toHaveBeenCalledTimes(1);
  });

  it('does not import localhost development urls as memory events', async () => {
    const config = getMirrorBrainConfig();
    const fetchPageContent = vi.fn();
    const ingestPageContent = vi.fn();
    const persistedRecordIds: string[] = [];

    const result = await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T08:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
        workspaceDir: '/tmp/mirrorbrain',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async () => undefined,
        },
        fetchBrowserEvents: async () => [
          {
            id: 'aw-event-local-1',
            timestamp: '2026-03-20T08:00:00.000Z',
            data: {
              url: 'http://127.0.0.1:5500/app',
              title: 'Local App',
            },
          },
        ],
        fetchPageContent,
        ingestPageContent,
        writeMemoryEvent: async (record) => {
          persistedRecordIds.push(record.recordId);
        },
      },
    );

    expect(fetchPageContent).not.toHaveBeenCalled();
    expect(ingestPageContent).not.toHaveBeenCalled();
    expect(persistedRecordIds).toEqual([]);
    expect(result.importedEvents).toEqual([]);
  });

  it('continues sync when page fetch returns unauthorized for a browser url', async () => {
    const config = getMirrorBrainConfig();
    const persistedRecordIds: string[] = [];
    const ingestPageContent = vi.fn();

    const result = await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T08:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
        workspaceDir: '/tmp/mirrorbrain',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async () => undefined,
        },
        fetchBrowserEvents: async () => [
          {
            id: 'aw-event-auth-1',
            timestamp: '2026-03-20T08:00:00.000Z',
            data: {
              url: 'https://private.example.com/secure',
              title: 'Secure Page',
            },
          },
        ],
        fetchPageContent: async () => {
          throw new Error('Browser page fetch failed with status 401');
        },
        ingestPageContent,
        writeMemoryEvent: async (record) => {
          persistedRecordIds.push(record.recordId);
        },
      },
    );

    expect(ingestPageContent).not.toHaveBeenCalled();
    expect(persistedRecordIds).toEqual(['browser:aw-event-auth-1']);
    expect(result.importedEvents?.[0]).toMatchObject({
      id: 'browser:aw-event-auth-1',
      content: {
        url: 'https://private.example.com/secure',
        title: 'Secure Page',
      },
    });
    expect(result.importedEvents?.[0]?.content).not.toHaveProperty('textStorage');
  });

  it('uses the stored checkpoint for incremental sync and advances when no new events are returned', async () => {
    const config = getMirrorBrainConfig();
    const checkpoints: Array<{
      sourceKey: string;
      lastSyncedAt: string;
      updatedAt: string;
    }> = [];

    const result = await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T09:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            lastSyncedAt: '2026-03-20T08:00:00.000Z',
            updatedAt: '2026-03-20T08:00:01.000Z',
          }),
          writeCheckpoint: async (checkpoint) => {
            checkpoints.push(checkpoint);
          },
        },
        fetchBrowserEvents: async (input) => {
          expect(input).toMatchObject({
            start: '2026-03-20T08:00:00.000Z',
            end: '2026-03-20T09:00:00.000Z',
          });

          return [];
        },
        writeMemoryEvent: async () => undefined,
      },
    );

    expect(checkpoints).toEqual([
      {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
      },
    ]);
    expect(result).toEqual({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'incremental',
      importedCount: 0,
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
      importedEvents: [],
    });
  });

  it('deduplicates duplicate browser page events before persisting them', async () => {
    const config = getMirrorBrainConfig();
    const persistedRecordIds: string[] = [];

    const result = await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T08:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async () => undefined,
        },
        fetchBrowserEvents: async () => [
          {
            id: 'aw-event-1',
            timestamp: '2026-03-20T07:45:00.000Z',
            data: {
              url: 'https://example.com/tasks',
              title: 'Example Tasks',
            },
          },
          {
            id: 'aw-event-2',
            timestamp: '2026-03-20T07:45:00.000Z',
            data: {
              url: 'https://example.com/tasks',
              title: 'Example Tasks',
            },
          },
        ],
        fetchPageContent: async ({ url, title, fetchedAt }) => ({
          url,
          title,
          fetchedAt,
          text: 'Shared text',
        }),
        ingestPageContent: async ({ artifact }) => ({
          sourcePath: `/tmp/mirrorbrain/mirrorbrain/browser-page-content/${artifact.id}.md`,
          rootUri: `viking://resources/mirrorbrain-browser-page-content-${artifact.id}.md`,
        }),
        writeMemoryEvent: async (record) => {
          persistedRecordIds.push(record.recordId);
        },
      },
    );

    expect(persistedRecordIds).toEqual(['browser:aw-event-1']);
    expect(result).toEqual({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'initial-backfill',
      importedCount: 1,
      lastSyncedAt: '2026-03-20T08:00:00.000Z',
      importedEvents: [
        {
          id: 'browser:aw-event-1',
          sourceType: 'activitywatch-browser',
          sourceRef: 'aw-event-1',
          timestamp: '2026-03-20T07:45:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {
            url: 'https://example.com/tasks',
            title: 'Example Tasks',
            latestAccessedAt: '2026-03-20T07:45:00.000Z',
            accessTimes: ['2026-03-20T07:45:00.000Z'],
          },
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-03-20T07:45:00.000Z',
          },
        },
      ],
    });
  });

  it('persists browser memory events before page content backfill completes', async () => {
    const config = getMirrorBrainConfig();
    const persistedRecordIds: string[] = [];
    let releaseFetch: (() => void) | undefined;
    const fetchPageContent = vi.fn(
      async ({ url, title, fetchedAt }: { url: string; title: string; fetchedAt: string }) =>
        await new Promise<{ url: string; title: string; fetchedAt: string; text: string }>((resolve) => {
          releaseFetch = () =>
            resolve({
              url,
              title,
              fetchedAt,
              text: 'Delayed text',
            });
        }),
    );
    const ingestPageContent = vi.fn(async ({ artifact }) => ({
      sourcePath: `/tmp/mirrorbrain/mirrorbrain/browser-page-content/${artifact.id}.md`,
      rootUri: `viking://resources/mirrorbrain-browser-page-content-${artifact.id}.md`,
    }));

    const result = await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T08:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
        workspaceDir: '/tmp/mirrorbrain',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async () => undefined,
        },
        fetchBrowserEvents: async () => [
          {
            id: 'aw-event-delayed-1',
            timestamp: '2026-03-20T07:45:00.000Z',
            data: {
              url: 'https://example.com/tasks',
              title: 'Example Tasks',
            },
          },
        ],
        fetchPageContent,
        ingestPageContent,
        writeMemoryEvent: async (record) => {
          persistedRecordIds.push(record.recordId);
        },
      },
    );

    expect(result.importedEvents?.[0]).toMatchObject({
      id: 'browser:aw-event-delayed-1',
      content: {
        url: 'https://example.com/tasks',
        title: 'Example Tasks',
        latestAccessedAt: '2026-03-20T07:45:00.000Z',
        accessTimes: ['2026-03-20T07:45:00.000Z'],
      },
    });
    expect(result.importedEvents?.[0]?.content).not.toHaveProperty('textStorage');
    expect(persistedRecordIds).toEqual(['browser:aw-event-delayed-1']);
    expect(ingestPageContent).not.toHaveBeenCalled();

    releaseFetch?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchPageContent).toHaveBeenCalledTimes(1);
    expect(ingestPageContent).toHaveBeenCalledTimes(1);
  });

  it('polls on the configured interval and stops cleanly', async () => {
    vi.useFakeTimers();
    const config = getMirrorBrainConfig();
    const runSyncOnce = vi.fn(async () => undefined);

    const polling = startBrowserMemorySyncPolling(
      {
        config,
      },
      {
        runSyncOnce,
      },
    );

    await vi.runAllTicks();
    expect(runSyncOnce).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(config.sync.pollingIntervalMs);
    expect(runSyncOnce).toHaveBeenCalledTimes(2);

    polling.stop();
    await vi.advanceTimersByTimeAsync(config.sync.pollingIntervalMs);
    expect(runSyncOnce).toHaveBeenCalledTimes(2);
  });
});
