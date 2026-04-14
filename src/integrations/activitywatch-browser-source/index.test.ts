import { describe, expect, it } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import {
  createInitialBrowserSyncPlan,
  createIncrementalBrowserSyncPlan,
  fetchActivityWatchBuckets,
  fetchActivityWatchBrowserEvents,
  getBrowserSyncSchedule,
  resolveActivityWatchBrowserBucket,
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

  it('uses the explicit bucket creation time for initial sync when available', () => {
    const config = getMirrorBrainConfig();

    expect(
      createInitialBrowserSyncPlan(config, {
        now: '2026-03-20T08:00:00.000Z',
        startAt: '2026-03-12T03:15:00.000Z',
      }),
    ).toMatchObject({
      strategy: 'initial-backfill',
      start: '2026-03-12T03:15:00.000Z',
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

  it('fetches bucket summaries from the ActivityWatch HTTP API', async () => {
    const buckets = await fetchActivityWatchBuckets(
      {
        baseUrl: 'http://127.0.0.1:5600',
      },
      async () =>
        new Response(
          JSON.stringify({
            'aw-watcher-web-chrome': {
              last_updated: '2026-04-03T07:13:14.690000+00:00',
            },
            'aw-watcher-web-chrome_wanbodeMacBook-Pro-2.local': {
              last_updated: '2026-04-13T03:53:00.000000+00:00',
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
    );

    expect(buckets).toEqual([
      {
        id: 'aw-watcher-web-chrome',
        last_updated: '2026-04-03T07:13:14.690000+00:00',
      },
      {
        id: 'aw-watcher-web-chrome_wanbodeMacBook-Pro-2.local',
        last_updated: '2026-04-13T03:53:00.000000+00:00',
      },
    ]);
  });

  it('resolves the most recently updated browser watcher bucket', () => {
    expect(
      resolveActivityWatchBrowserBucket([
        {
          id: 'aw-watcher-web-chrome',
          last_updated: '2026-04-03T07:13:14.690000+00:00',
        },
        {
          id: 'aw-watcher-web-chrome_wanbodeMacBook-Pro-2.local',
          last_updated: '2026-04-13T03:53:00.000000+00:00',
        },
        {
          id: 'aw-watcher-window_wanbodeMacBook-Pro-2.local',
          last_updated: '2026-04-13T03:53:20.000000+00:00',
        },
      ]),
    ).toBe('aw-watcher-web-chrome_wanbodeMacBook-Pro-2.local');
  });
});
