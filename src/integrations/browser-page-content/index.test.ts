import { describe, expect, it } from 'vitest';

import {
  extractReadableTextFromHtml,
  fetchBrowserPageContent,
} from './index.js';

describe('browser page content integration', () => {
  it('prefers main content over navigation and footer noise', () => {
    const result = extractReadableTextFromHtml(`
      <html>
        <head>
          <title>Shipping Guide</title>
        </head>
        <body>
          <header>
            <nav>
              <a href="/home">Home</a>
              <a href="/pricing">Pricing</a>
            </nav>
          </header>
          <aside>
            <p>Related links</p>
          </aside>
          <main>
            <article>
              <h1>Shipping Guide</h1>
              <p>Prepare the release branch.</p>
              <p>Run the deployment checklist.</p>
            </article>
          </main>
          <footer>
            <p>Copyright Example Inc.</p>
          </footer>
        </body>
      </html>
    `);

    expect(result).toEqual({
      title: 'Shipping Guide',
      text:
        'Shipping Guide\n\nPrepare the release branch.\n\nRun the deployment checklist.',
    });
  });

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
