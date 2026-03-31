import { describe, expect, it } from 'vitest';

import {
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
});
