import { describe, expect, it, vi } from 'vitest';

import { ingestBrowserPageContentToOpenViking } from './index.js';

describe('openviking store browser page content', () => {
  it('imports browser page text into OpenViking and waits for indexing', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          result: {
            root_uri:
              'viking://resources/mirrorbrain-browser-page-content-browser-page-aw-event-1-md',
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

    await expect(
      ingestBrowserPageContentToOpenViking(
        {
          baseUrl: 'http://127.0.0.1:1933',
          workspaceDir: '/tmp/mirrorbrain',
          artifact: {
            id: 'browser-page:url-abc123',
            url: 'https://example.com/tasks',
            title: 'Example Tasks',
            text: 'Open the checklist.\n\nShip the patch.',
            accessTimes: ['2026-04-13T10:00:00.000Z'],
            latestAccessedAt: '2026-04-13T10:00:00.000Z',
          },
        },
        fetchImpl,
      ),
    ).resolves.toMatchObject({
      rootUri:
        'viking://resources/mirrorbrain-browser-page-content-browser-page-aw-event-1-md',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:1933/api/v1/resources',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          path: '/tmp/mirrorbrain/mirrorbrain/browser-page-content/browser-page:url-abc123.md',
          target:
            'viking://resources/mirrorbrain-browser-page-content-browser-page-url-abc123.md',
          reason: 'MirrorBrain imported browser page content',
          wait: true,
        }),
      }),
    );
  });
});
