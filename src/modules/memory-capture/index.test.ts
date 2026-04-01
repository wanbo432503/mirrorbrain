import { describe, expect, it } from 'vitest';

import type { MemoryEvent } from '../../shared/types/index.js';
import {
  createMemorySourceRegistry,
  deduplicateMemoryEvents,
  normalizeActivityWatchBrowserEvent,
  persistMemoryEvent,
} from './index.js';

describe('memory capture', () => {
  it('normalizes an ActivityWatch browser event into a MemoryEvent', () => {
    expect(
      normalizeActivityWatchBrowserEvent({
        scopeId: 'scope-browser',
        event: {
          id: 'aw-event-1',
          timestamp: '2026-03-20T08:00:00.000Z',
          data: {
            url: 'https://example.com/tasks',
            title: 'Example Tasks',
          },
        },
      }),
    ).toMatchObject({
      id: 'browser:aw-event-1',
      sourceType: 'activitywatch-browser',
      sourceRef: 'aw-event-1',
      timestamp: '2026-03-20T08:00:00.000Z',
      authorizationScopeId: 'scope-browser',
      content: {
        url: 'https://example.com/tasks',
        title: 'Example Tasks',
      },
    });
  });

  it('persists normalized events with source metadata', async () => {
    const writes: unknown[] = [];

    await persistMemoryEvent(
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
      {
        writeMemoryEvent: async (event) => {
          writes.push(event);
        },
      },
    );

    expect(writes).toEqual([
      expect.objectContaining({
        recordId: 'browser:aw-event-1',
        recordType: 'memory-event',
        payload: expect.objectContaining({
          id: 'browser:aw-event-1',
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-03-20T08:00:00.000Z',
          },
        }),
      }),
    ]);
  });

  it('deduplicates memory events with a source-specific fingerprint before persistence', () => {
    const deduplicatedEvents = deduplicateMemoryEvents(
      [
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
        {
          id: 'browser:aw-event-2',
          sourceType: 'activitywatch-browser',
          sourceRef: 'aw-event-2',
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
      (event) =>
        [
          event.sourceType,
          event.authorizationScopeId,
          event.timestamp,
          String(event.content.url ?? ''),
          String(event.content.title ?? ''),
        ].join('|'),
    );

    expect(deduplicatedEvents).toEqual([
      expect.objectContaining({
        id: 'browser:aw-event-1',
      }),
    ]);
  });

  it('registers memory source plugins by source key for future source expansion', () => {
    const registry = createMemorySourceRegistry([
      {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        sourceCategory: 'browser',
        createSyncPlan: () => ({
          strategy: 'initial-backfill',
          start: '2026-03-19T08:00:00.000Z',
          end: '2026-03-20T08:00:00.000Z',
        }),
        fetchEvents: async () => [],
        normalizeEvent: ({ event }: { scopeId: string; event: MemoryEvent }) => event,
      },
    ]);

    expect(registry.listSources()).toHaveLength(1);
    expect(
      registry.getSource('activitywatch-browser:aw-watcher-web-chrome'),
    ).toMatchObject({
      sourceCategory: 'browser',
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
    });
  });
});
