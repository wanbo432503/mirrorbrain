import type { MemoryEvent } from '../../shared/types/index.js';

export interface NormalizedMemoryItem {
  // Unique identifier for this URL-level memory item
  id: string;

  // URL and page metadata
  url: string;
  title?: string;
  pageTitle?: string;
  pageText?: string;
  host: string;

  // Time information preserving all visits
  firstVisitTime: string; // Earliest access timestamp
  lastVisitTime: string; // Most recent access timestamp
  accessTimes: string[]; // All visit timestamps in chronological order

  // Role classification
  role:
    | 'search'
    | 'docs'
    | 'chat'
    | 'issue'
    | 'pull-request'
    | 'repository'
    | 'debug'
    | 'reference'
    | 'web';

  // Provenance references - all raw events that contributed to this URL item
  sourceEventIds: string[];

  // Source attribution
  sourceType: string;
}

/**
 * Normalizes raw memory events into URL-level memory items.
 *
 * This function groups events by URL and preserves all visit timestamps
 * in the `accessTimes` array, creating a deduplicated view that still
 * maintains full provenance through `sourceEventIds`.
 *
 * The normalization layer abstracts away whether the underlying storage
 * uses raw events or deduplicated URL items, allowing candidate generation
 * logic to remain stable across storage model evolution.
 *
 * @param events Raw memory events from browser activity
 * @returns Normalized memory items grouped by URL with preserved visit history
 */
export function normalizeRawEvents(events: MemoryEvent[]): NormalizedMemoryItem[] {
  const urlGroups = new Map<string, MemoryEvent[]>();

  // Group events by URL
  for (const event of events) {
    const url = typeof event.content.url === 'string' ? event.content.url : undefined;
    if (!url) {
      // Skip events without URLs (shell events, etc.)
      continue;
    }

    const group = urlGroups.get(url) ?? [];
    group.push(event);
    urlGroups.set(url, group);
  }

  // Convert URL groups to normalized items
  return Array.from(urlGroups.entries()).map(([url, groupEvents]) => {
    // Sort events by timestamp
    const sortedEvents = [...groupEvents].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp),
    );

    // Extract timestamps
    const timestamps = sortedEvents.map((event) => event.timestamp);

    // Use most recent event for metadata (title, pageText, etc.)
    const representative = sortedEvents[sortedEvents.length - 1];

    // Extract metadata
    const title =
      typeof representative.content.title === 'string'
        ? representative.content.title
        : undefined;
    const pageTitle =
      typeof representative.content.pageTitle === 'string'
        ? representative.content.pageTitle
        : undefined;
    const pageText =
      typeof representative.content.pageText === 'string'
        ? representative.content.pageText
        : undefined;

    // Infer host and role
    const host = getEventHost(url);
    const role = inferPageRole({ url, title });

    return {
      id: `normalized-url:${url}`,
      url,
      title,
      pageTitle,
      pageText,
      host,
      firstVisitTime: timestamps[0],
      lastVisitTime: timestamps[timestamps.length - 1],
      accessTimes: timestamps,
      role,
      sourceEventIds: sortedEvents.map((event) => event.id),
      sourceType: representative.sourceType,
    };
  });
}

function getEventHost(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return 'unknown-source';
  }
}

function inferPageRole(input: {
  url?: string;
  title?: string;
}): 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'web' {
  const url = input.url ?? '';
  const title = input.title ?? '';

  // Search pages
  if (
    url.includes('google.com/search') ||
    url.includes('bing.com/search') ||
    url.includes('duckduckgo.com') ||
    url.includes('?q=') ||
    url.includes('/search?') ||
    title.toLowerCase().includes('search results') ||
    title.toLowerCase().includes('- google search') ||
    title.toLowerCase().includes('- bing search')
  ) {
    return 'search';
  }

  // GitHub issues
  if (url.includes('github.com') && url.includes('/issues/')) {
    return 'issue';
  }

  // GitHub pull requests
  if (url.includes('github.com') && url.includes('/pull/')) {
    return 'pull-request';
  }

  // GitHub repositories
  if (url.includes('github.com') && !url.includes('/issues/') && !url.includes('/pull/')) {
    return 'repository';
  }

  // Documentation pages
  if (
    url.includes('/docs') ||
    url.includes('/documentation') ||
    url.includes('/guide') ||
    url.includes('/tutorial') ||
    url.includes('/readme') ||
    url.includes('readthedocs.io') ||
    url.includes('docs.github.com') ||
    url.includes('developer.mozilla.org')
  ) {
    return 'docs';
  }

  // Chat/Collaboration
  if (
    url.includes('slack.com') ||
    url.includes('discord.com') ||
    url.includes('teams.microsoft.com') ||
    url.includes('zoom.us') ||
    url.includes('meet.google.com')
  ) {
    return 'chat';
  }

  // Localhost debugging
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes(':3000')) {
    return 'debug';
  }

  // Reference/API docs
  if (
    url.includes('/api') ||
    url.includes('/reference') ||
    url.includes('/spec') ||
    url.includes('/manual')
  ) {
    return 'reference';
  }

  // Default to generic web page
  return 'web';
}