import { describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import {
  captureActivityWatchBrowserLedgerRecords,
  createActivityWatchBrowserMemorySourcePlugin,
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

  it('fetches readable page text before writing browser ledger records', async () => {
    const config = getMirrorBrainConfig();
    const fetchPageContent = vi.fn(async () => ({
      url: 'https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal',
      title: 'Gemma 4 Usage Guide - vLLM Recipes',
      fetchedAt: '2026-05-13T02:54:03.182Z',
      text: [
        'Gemma 4 Usage Guide - vLLM Recipes',
        '',
        'This recipe explains offline multimodal inference with Gemma 4 in vLLM.',
        '',
        'It includes installation steps, model loading, and generation examples.',
      ].join('\n'),
    }));

    const records = await captureActivityWatchBrowserLedgerRecords(
      {
        bucketId: 'aw-watcher-web-chrome',
        config,
        now: '2026-05-13T02:54:03.182Z',
        scopeId: 'scope-browser',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async () => undefined,
        },
        fetchBrowserEvents: async () => [
          {
            id: '3239',
            timestamp: '2026-05-13T02:53:09.461000+00:00',
            data: {
              title: 'Gemma 4 Usage Guide - vLLM Recipes',
              url: 'https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal',
            },
          },
        ],
        fetchPageContent,
      },
    );

    expect(fetchPageContent).toHaveBeenCalledWith({
      url: 'https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal',
      title: 'Gemma 4 Usage Guide - vLLM Recipes',
      fetchedAt: '2026-05-13T02:54:03.182Z',
    });
    expect(records[0]?.payload).toMatchObject({
      id: '3239',
      title: 'Gemma 4 Usage Guide - vLLM Recipes',
      url: 'https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal',
      page_content: [
        'Gemma 4 Usage Guide - vLLM Recipes',
        '',
        'This recipe explains offline multimodal inference with Gemma 4 in vLLM.',
        '',
        'It includes installation steps, model loading, and generation examples.',
      ].join('\n'),
    });
  });

  it('rejects unauthorized browser ledger capture before fetching events', async () => {
    const fetchBrowserEvents = vi.fn(async () => []);

    await expect(
      captureActivityWatchBrowserLedgerRecords(
        {
          bucketId: 'aw-watcher-web-chrome',
          config: getMirrorBrainConfig(),
          now: '2026-05-13T02:54:03.182Z',
          scopeId: 'scope-browser',
        },
        {
          checkpointStore: {
            readCheckpoint: async () => null,
            writeCheckpoint: async () => undefined,
          },
          authorizeSourceSync: async () => false,
          fetchBrowserEvents,
        },
      ),
    ).rejects.toThrow(
      'Memory source activitywatch-browser-ledger:aw-watcher-web-chrome is not authorized for scope scope-browser.',
    );
    expect(fetchBrowserEvents).not.toHaveBeenCalled();
  });

  it('filters local browser pages before they become memory events', () => {
    const plugin = createActivityWatchBrowserMemorySourcePlugin({
      bucketId: 'aw-watcher-web-chrome',
    });
    const events = [
      {
        id: 'aw-event-localhost',
        timestamp: '2026-03-20T08:00:00.000Z',
        data: {
          url: 'http://localhost:5173/app',
          title: 'Localhost App',
        },
      },
      {
        id: 'aw-event-loopback',
        timestamp: '2026-03-20T08:01:00.000Z',
        data: {
          url: 'http://127.0.0.1:5500/app',
          title: 'Loopback App',
        },
      },
      {
        id: 'aw-event-wildcard',
        timestamp: '2026-03-20T08:02:00.000Z',
        data: {
          url: 'http://0.0.0.0:3000/app',
          title: 'Wildcard App',
        },
      },
      {
        id: 'aw-event-remote',
        timestamp: '2026-03-20T08:03:00.000Z',
        data: {
          url: 'https://example.com/tasks',
          title: 'Example Tasks',
        },
      },
    ].map((event) =>
      plugin.normalizeEvent({
        scopeId: 'scope-browser',
        event,
      }),
    );

    expect(plugin.sanitizeEvents?.(events).map((event) => event.id)).toEqual([
      'browser:aw-event-remote',
    ]);
  });
});
