import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { MemoryEvent } from '../../shared/types/index.js';

import type { ingestBrowserPageContentToOpenViking } from '../openviking-store/index.js';

interface BrowserPageContentStorageRef {
  sourcePath: string;
  rootUri: string;
}

export interface BrowserPageContentArtifact {
  id: string;
  url: string;
  title: string;
  text: string;
  accessTimes: string[];
  latestAccessedAt: string;
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

export function isSkippableBrowserPageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

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
    id: getBrowserPageContentArtifactId(input.page.url),
    url: input.page.url,
    title: input.page.title,
    text: input.page.text,
    accessTimes: [input.event.timestamp],
    latestAccessedAt: input.event.timestamp,
  };
}

export function getBrowserPageContentArtifactId(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  return `browser-page:url-${hash}`;
}

export function buildBrowserPageContentArtifact(input: {
  url: string;
  title: string;
  text: string;
  accessedAt: string;
  existingArtifact?: BrowserPageContentArtifact;
}): BrowserPageContentArtifact {
  const accessTimes = Array.from(
    new Set([input.accessedAt, ...(input.existingArtifact?.accessTimes ?? [])]),
  ).sort((left, right) => right.localeCompare(left));

  return {
    id: input.existingArtifact?.id ?? getBrowserPageContentArtifactId(input.url),
    url: input.url,
    title: input.existingArtifact?.title ?? input.title,
    text: input.existingArtifact?.text ?? input.text,
    accessTimes,
    latestAccessedAt: accessTimes[0] ?? input.accessedAt,
  };
}

export async function loadBrowserPageContentArtifactFromWorkspace(input: {
  workspaceDir: string;
  url: string;
}): Promise<BrowserPageContentArtifact | null> {
  const id = getBrowserPageContentArtifactId(input.url);
  const sourcePath = join(
    input.workspaceDir,
    'mirrorbrain',
    'browser-page-content',
    `${id}.md`,
  );

  try {
    const markdown = await readFile(sourcePath, 'utf8');
    return parseBrowserPageContentArtifact(markdown, input.url, id);
  } catch {
    return null;
  }
}

function parseBrowserPageContentArtifact(
  markdown: string,
  url: string,
  id: string,
): BrowserPageContentArtifact {
  const lines = markdown.split('\n');
  const title = lines[0]?.replace(/^#\s+/, '').trim() ?? '';
  const latestAccessedAt =
    lines
      .find((line) => line.startsWith('- latestAccessedAt: '))
      ?.replace('- latestAccessedAt: ', '')
      .trim() ?? '';
  const accessSectionIndex = lines.findIndex(
    (line) => line.trim() === '## Access Times',
  );
  const textSectionIndex = lines.findIndex((line) => line.trim() === '## Text');
  const accessTimes =
    accessSectionIndex === -1
      ? []
      : lines
          .slice(
            accessSectionIndex + 1,
            textSectionIndex === -1 ? undefined : textSectionIndex,
          )
          .map((line) => line.replace(/^- /, '').trim())
          .filter((line) => line.length > 0);
  const text =
    textSectionIndex === -1
      ? ''
      : lines.slice(textSectionIndex + 1).join('\n').trim();

  return {
    id,
    url,
    title,
    text,
    accessTimes,
    latestAccessedAt: latestAccessedAt || accessTimes[0] || '',
  };
}

export function wasBrowserPageAccessedOnReviewDate(
  artifact: BrowserPageContentArtifact,
  input: {
    reviewDate: string;
    reviewTimeZone?: string;
  },
): boolean {
  return artifact.accessTimes.some(
    (accessedAt) =>
      getCalendarDateForComparison(accessedAt, input.reviewTimeZone) ===
      input.reviewDate,
  );
}

function getCalendarDateForComparison(value: string, timeZone?: string): string {
  if (timeZone === undefined) {
    const date = new Date(value);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Failed to derive review date for timestamp ${value}.`);
  }

  return `${year}-${month}-${day}`;
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
    sharedArtifact?: BrowserPageContentArtifact;
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

  if (
    url === null ||
    !/^https?:\/\//iu.test(url) ||
    isSkippableBrowserPageUrl(url)
  ) {
    return input.event;
  }

  const fetchPage = dependencies.fetchPageContent ?? fetchBrowserPageContent;
  const ingestPage = dependencies.ingestPageContent;

  if (ingestPage === undefined) {
    return input.event;
  }

  const existingArtifact =
    dependencies.sharedArtifact ??
    (await loadBrowserPageContentArtifactFromWorkspace({
      workspaceDir: input.workspaceDir,
      url,
    }));
  const artifact =
    existingArtifact === null
      ? buildBrowserPageContentArtifact({
          ...(await fetchPage({
            url,
            title,
            fetchedAt: input.fetchedAt,
          })),
          accessedAt: input.event.timestamp,
        })
      : buildBrowserPageContentArtifact({
          url,
          title,
          text: existingArtifact.text,
          accessedAt: input.event.timestamp,
          existingArtifact,
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
      ...createBrowserPageContentEventContent(artifact, stored),
    },
  };
}

export function createBrowserPageContentEventContent(
  artifact: BrowserPageContentArtifact,
  stored: BrowserPageContentStorageRef,
): Record<string, unknown> {
  return {
    title: artifact.title,
    textStorage: {
      filePath: stored.sourcePath,
      openVikingUri: stored.rootUri,
      vectorizationSource: 'openviking-resource',
    },
    latestAccessedAt: artifact.latestAccessedAt,
    accessTimes: artifact.accessTimes,
  };
}
