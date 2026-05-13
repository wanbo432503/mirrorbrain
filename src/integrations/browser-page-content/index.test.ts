import { describe, expect, it } from 'vitest';

import {
  buildBrowserPageContentArtifact,
  createBrowserPageContentEventContent,
  extractReadableTextFromHtml,
  fetchBrowserPageContent,
  isSkippableBrowserPageUrl,
  wasBrowserPageAccessedOnReviewDate,
} from './index.js';

describe('browser page content integration', () => {
  it('marks localhost and loopback urls as skippable for page fetch', () => {
    expect(isSkippableBrowserPageUrl('http://127.0.0.1:5500/app')).toBe(true);
    expect(isSkippableBrowserPageUrl('http://localhost:3000/docs')).toBe(true);
    expect(isSkippableBrowserPageUrl('http://[::1]:5173/')).toBe(true);
    expect(isSkippableBrowserPageUrl('https://example.com/tasks')).toBe(false);
  });

  it('builds one shared page artifact per url and keeps access times sorted newest first', () => {
    const created = buildBrowserPageContentArtifact({
      url: 'https://example.com/tasks',
      title: 'Example Tasks',
      text: 'Open the checklist.',
      accessedAt: '2026-04-14T08:00:00.000Z',
    });
    const updated = buildBrowserPageContentArtifact({
      url: 'https://example.com/tasks',
      title: 'Ignored Later Title',
      text: 'Ignored later text.',
      accessedAt: '2026-04-14T09:00:00.000Z',
      existingArtifact: created,
    });

    expect(updated).toEqual({
      id: created.id,
      url: 'https://example.com/tasks',
      title: 'Example Tasks',
      text: 'Open the checklist.',
      accessTimes: ['2026-04-14T09:00:00.000Z', '2026-04-14T08:00:00.000Z'],
      latestAccessedAt: '2026-04-14T09:00:00.000Z',
    });
  });

  it('uses qmd storage metadata when enriching browser events with shared page text', () => {
    const content = createBrowserPageContentEventContent(
      {
        id: 'browser-page:url-abc',
        url: 'https://example.com/tasks',
        title: 'Example Tasks',
        text: 'Open the checklist.',
        accessTimes: ['2026-04-14T09:00:00.000Z'],
        latestAccessedAt: '2026-04-14T09:00:00.000Z',
      },
      {
        sourcePath: '/workspace/mirrorbrain/browser-page-content/browser-page-url-abc.md',
        rootUri: 'qmd://mirrorbrain/browser-page-content/browser-page-url-abc.md',
      },
    );

    expect(content.textStorage).toEqual({
      filePath: '/workspace/mirrorbrain/browser-page-content/browser-page-url-abc.md',
      qmdUri: 'qmd://mirrorbrain/browser-page-content/browser-page-url-abc.md',
      vectorizationSource: 'qmd-workspace',
    });
  });

  it('detects whether a shared page artifact was accessed on the review date', () => {
    expect(
      wasBrowserPageAccessedOnReviewDate(
        {
          id: 'browser-page:abc',
          url: 'https://example.com/tasks',
          title: 'Example Tasks',
          text: 'Open the checklist.',
          accessTimes: ['2026-04-14T00:30:00.000Z', '2026-04-13T14:00:00.000Z'],
          latestAccessedAt: '2026-04-14T00:30:00.000Z',
        },
        {
          reviewDate: '2026-04-14',
          reviewTimeZone: 'Asia/Shanghai',
        },
      ),
    ).toBe(true);
    expect(
      wasBrowserPageAccessedOnReviewDate(
        {
          id: 'browser-page:abc',
          url: 'https://example.com/tasks',
          title: 'Example Tasks',
          text: 'Open the checklist.',
          accessTimes: ['2026-04-12T00:30:00.000Z'],
          latestAccessedAt: '2026-04-12T00:30:00.000Z',
        },
        {
          reviewDate: '2026-04-14',
          reviewTimeZone: 'Asia/Shanghai',
        },
      ),
    ).toBe(false);
  });

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
