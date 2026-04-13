import type { MemoryEvent } from '../../shared/types/index.js';

import type { ingestBrowserPageContentToOpenViking } from '../openviking-store/index.js';

export interface BrowserPageContentArtifact {
  id: string;
  sourceEventId: string;
  url: string;
  title: string;
  fetchedAt: string;
  text: string;
}

interface FetchBrowserPageContentInput {
  url: string;
  title: string;
  fetchedAt: string;
}

interface ExtractedBrowserPageContent {
  title: string;
  text: string;
}

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'");
}

function normalizeTextBlock(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\r/gu, '')
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n\n');
}

function selectPrimaryHtmlRegion(html: string): string {
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/iu);

  if (articleMatch?.[1]) {
    return articleMatch[1];
  }

  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/iu);

  if (mainMatch?.[1]) {
    return mainMatch[1];
  }

  return html
    .replace(/<header[\s\S]*?<\/header>/giu, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/giu, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/giu, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/giu, ' ');
}

export function extractReadableTextFromHtml(
  html: string,
): ExtractedBrowserPageContent {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu);
  const title = normalizeTextBlock(titleMatch?.[1] ?? '');
  const primaryRegionHtml = selectPrimaryHtmlRegion(html);
  const strippedHtml = primaryRegionHtml
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<\/(article|section|main|div|p|h[1-6]|li|ul|ol|br)>/giu, '\n')
    .replace(/<(article|section|main|div|p|h[1-6]|li|ul|ol|br)[^>]*>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ');
  const text = normalizeTextBlock(strippedHtml);
  const normalizedTitle = title.toLowerCase();
  const textLines = text.split('\n\n');

  while (
    normalizedTitle.length > 0 &&
    textLines[0]?.toLowerCase() === normalizedTitle
  ) {
    textLines.shift();
  }

  const deduplicatedText = textLines.join('\n\n');

  return {
    title,
    text: deduplicatedText.length > 0 ? `${title}\n\n${deduplicatedText}` : title,
  };
}

export async function fetchBrowserPageContent(
  input: FetchBrowserPageContentInput,
  fetchImpl: FetchLike = fetch,
): Promise<{
  url: string;
  title: string;
  fetchedAt: string;
  text: string;
}> {
  const response = await fetchImpl(input.url);

  if (!response.ok) {
    throw new Error(`Browser page fetch failed with status ${response.status}`);
  }

  const html = await response.text();
  const extracted = extractReadableTextFromHtml(html);

  return {
    url: input.url,
    title: extracted.title || input.title,
    fetchedAt: input.fetchedAt,
    text: extracted.text,
  };
}

export function createBrowserPageContentArtifact(input: {
  event: MemoryEvent;
  page: {
    url: string;
    title: string;
    fetchedAt: string;
    text: string;
  };
}): BrowserPageContentArtifact {
  return {
    id: `browser-page:${input.event.id.replace(/:/gu, '-')}`,
    sourceEventId: input.event.id,
    url: input.page.url,
    title: input.page.title,
    fetchedAt: input.page.fetchedAt,
    text: input.page.text,
  };
}

export async function enrichBrowserMemoryEventWithPageContent(
  input: {
    event: MemoryEvent;
    baseUrl: string;
    workspaceDir: string;
    fetchedAt: string;
  },
  dependencies: {
    fetchPageContent?: typeof fetchBrowserPageContent;
    ingestPageContent?: typeof ingestBrowserPageContentToOpenViking;
  },
): Promise<MemoryEvent> {
  if (input.event.sourceType !== 'activitywatch-browser') {
    return input.event;
  }

  const url =
    typeof input.event.content.url === 'string' ? input.event.content.url : null;
  const title =
    typeof input.event.content.title === 'string'
      ? input.event.content.title
      : 'Untitled Page';

  if (url === null || !/^https?:\/\//iu.test(url)) {
    return input.event;
  }

  const fetchPage = dependencies.fetchPageContent ?? fetchBrowserPageContent;
  const ingestPage = dependencies.ingestPageContent;

  if (ingestPage === undefined) {
    return input.event;
  }

  const page = await fetchPage({
    url,
    title,
    fetchedAt: input.fetchedAt,
  });
  const artifact = createBrowserPageContentArtifact({
    event: input.event,
    page,
  });
  const stored = await ingestPage({
    baseUrl: input.baseUrl,
    workspaceDir: input.workspaceDir,
    artifact,
  });

  return {
    ...input.event,
    content: {
      ...input.event.content,
      title: page.title,
      text: page.text,
      textStorage: {
        filePath: stored.sourcePath,
        openVikingUri: stored.rootUri,
        vectorizationSource: 'openviking-resource',
      },
    },
  };
}
