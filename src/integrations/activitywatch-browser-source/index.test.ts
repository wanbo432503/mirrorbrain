import { describe, expect, it } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import {
  createInitialBrowserSyncPlan,
  createIncrementalBrowserSyncPlan,
  fetchActivityWatchBrowserEvents,
  getBrowserSyncSchedule,
} from './index.js';

describe('activitywatch browser source', () => {
  it('uses a controlled backfill window for initial sync', () => {
    const config = getMirrorBrainConfig();

    expect(
      createInitialBrowserSyncPlan(config, {
        now: '2026-03-20T08:00:00.000Z',
      }),
    ).toMatchObject({
      strategy: 'initial-backfill',
      start: '2026-03-19T08:00:00.000Z',
      end: '2026-03-20T08:00:00.000Z',
    });
  });

  it('uses a checkpoint for incremental sync', () => {
    const config = getMirrorBrainConfig();

    expect(
      createIncrementalBrowserSyncPlan(config, {
        lastSyncedAt: '2026-03-20T07:00:00.000Z',
        now: '2026-03-20T08:00:00.000Z',
      }),
    ).toMatchObject({
      strategy: 'incremental',
      start: '2026-03-20T07:00:00.000Z',
      end: '2026-03-20T08:00:00.000Z',
    });
  });

  it('derives a configurable polling schedule from config', () => {
    const config = getMirrorBrainConfig();

    expect(getBrowserSyncSchedule(config)).toEqual({
      pollingIntervalMs: 60 * 60 * 1000,
    });
  });

  it('fetches browser events from the ActivityWatch HTTP API', async () => {
    const config = getMirrorBrainConfig();
    const requests: string[] = [];

    const events = await fetchActivityWatchBrowserEvents(
      {
        baseUrl: config.activityWatch.baseUrl,
        bucketId: 'aw-watcher-web-test',
        start: '2026-03-19T08:00:00.000Z',
        end: '2026-03-20T08:00:00.000Z',
      },
      async (input) => {
        requests.push(String(input));

        return new Response(
          JSON.stringify([
            {
              id: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              data: {
                url: 'https://example.com/tasks',
                title: 'Example Tasks',
              },
            },
          ]),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    );

    expect(requests).toEqual([
      'http://127.0.0.1:5600/api/0/buckets/aw-watcher-web-test/events?start=2026-03-19T08%3A00%3A00.000Z&end=2026-03-20T08%3A00%3A00.000Z',
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'aw-event-1',
      data: {
        url: 'https://example.com/tasks',
      },
    });
  });
});
