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

  it('runs an initial backfill when no checkpoint exists and persists the latest checkpoint', async () => {
    const config = getMirrorBrainConfig();
    const checkpoints: Array<{
      sourceKey: string;
      lastSyncedAt: string;
      updatedAt: string;
    }> = [];
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
        writeMemoryEvent: async (record) => {
          persistedRecordIds.push(record.recordId);
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
    expect(result).toEqual({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'initial-backfill',
      importedCount: 2,
      lastSyncedAt: '2026-03-20T08:00:00.000Z',
    });
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
    });
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
