import { describe, expect, it } from 'vitest';

import {
  extractReadableTextFromHtml,
  fetchBrowserPageContent,
} from './index.js';

describe('browser page content integration', () => {
  it('extracts readable text and title from html', () => {
    const result = extractReadableTextFromHtml(`
      <html>
        <head>
          <title>Example Tasks</title>
          <style>.hidden { display: none; }</style>
          <script>console.log('ignore');</script>
        </head>
        <body>
          <main>
            <h1>Example Tasks</h1>
            <p>Review the release checklist.</p>
          </main>
        </body>
      </html>
    `);

    expect(result).toEqual({
      title: 'Example Tasks',
      text: 'Example Tasks\n\nReview the release checklist.',
    });
  });

  it('fetches browser page text over http and returns cleaned content', async () => {
    const result = await fetchBrowserPageContent(
      {
        url: 'https://example.com/tasks',
        title: 'Example Tasks',
        fetchedAt: '2026-04-13T10:00:00.000Z',
      },
      async () =>
        new Response(
          `
            <html>
              <head><title>Fetched Example Tasks</title></head>
              <body>
                <article>
                  <h1>Fetched Example Tasks</h1>
                  <p>Open the checklist.</p>
                  <p>Ship the patch.</p>
                </article>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
            },
          },
        ),
    );

    expect(result).toEqual({
      url: 'https://example.com/tasks',
      title: 'Fetched Example Tasks',
      fetchedAt: '2026-04-13T10:00:00.000Z',
      text: 'Fetched Example Tasks\n\nOpen the checklist.\n\nShip the patch.',
    });
  });
});
