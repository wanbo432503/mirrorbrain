import { describe, expect, it } from 'vitest'

import { getVisibleMemoryEvents, shouldLoadMemoryEvents } from './MemoryPanel'

describe('MemoryPanel', () => {
  it('loads memory only before the first successful memory fetch', () => {
    expect(
      shouldLoadMemoryEvents({
        hasLoadedMemoryEvents: false,
      })
    ).toBe(true)

    expect(
      shouldLoadMemoryEvents({
        hasLoadedMemoryEvents: true,
      })
    ).toBe(false)
  })

  it('shows newest memory events first in the visible page slice', () => {
    const visibleEvents = getVisibleMemoryEvents({
      currentPage: 1,
      pageSize: 2,
      memoryEvents: [
        {
          id: 'browser:oldest',
          sourceType: 'activitywatch-browser',
          sourceRef: 'oldest',
          timestamp: '2026-04-14T08:00:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {},
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-04-14T08:00:00.000Z',
          },
        },
        {
          id: 'browser:newest',
          sourceType: 'activitywatch-browser',
          sourceRef: 'newest',
          timestamp: '2026-04-14T10:00:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {},
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-04-14T10:00:00.000Z',
          },
        },
        {
          id: 'browser:middle',
          sourceType: 'activitywatch-browser',
          sourceRef: 'middle',
          timestamp: '2026-04-14T09:00:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {},
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-04-14T09:00:00.000Z',
          },
        },
      ],
    })

    expect(visibleEvents.map((event) => event.id)).toEqual([
      'browser:newest',
      'browser:middle',
    ])
  })
})
