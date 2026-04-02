import type {
  MemoryEvent,
  MemoryNarrative,
  MemoryResultSourceRef,
} from '../../shared/types/index.js';

interface GenerateBrowserThemeNarrativesInput {
  memoryEvents: MemoryEvent[];
}

type BrowserNarrativeKind =
  | 'passive'
  | 'documentation'
  | 'research'
  | 'comparison'
  | 'debugging';

function normalizeBrowserThemeTitle(title: string): string {
  const normalized = title
    .split(/ \| | - | — /u)[0]
    ?.trim()
    .replace(/\b(guide|docs|documentation)\b$/iu, '')
    .trim();

  return normalized && normalized.length > 0 ? normalized : title;
}

function formatThemeTitleForDisplay(title: string): string {
  if (title.length === 0) {
    return title;
  }

  return title
    .split(/\s+/u)
    .map((part) =>
      part.length === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ');
}

function getMemoryEventThemeTitle(event: MemoryEvent): string {
  const rawTitle =
    typeof event.content.title === 'string' ? event.content.title : event.id;

  return normalizeBrowserThemeTitle(rawTitle);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function isDocumentationPage(event: MemoryEvent): boolean {
  if (typeof event.content.url !== 'string') {
    return false;
  }

  try {
    const url = new URL(event.content.url);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    return (
      host.startsWith('docs.') ||
      host.includes('.docs.') ||
      path.startsWith('/docs') ||
      path.includes('/docs/')
    );
  } catch {
    return false;
  }
}

function isSearchPage(event: MemoryEvent): boolean {
  if (typeof event.content.url !== 'string') {
    return false;
  }

  try {
    const url = new URL(event.content.url);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    return (
      url.searchParams.has('q') ||
      host.includes('search') ||
      path.includes('/search')
    );
  } catch {
    return false;
  }
}

function isComparisonPage(event: MemoryEvent): boolean {
  const titleText =
    typeof event.content.title === 'string'
      ? event.content.title.toLowerCase()
      : '';
  const urlText =
    typeof event.content.url === 'string' ? event.content.url.toLowerCase() : '';

  return (
    titleText.includes('compare') ||
    titleText.includes('comparison') ||
    titleText.includes(' vs ') ||
    urlText.includes('compare') ||
    urlText.includes('comparison') ||
    urlText.includes('-vs-') ||
    urlText.includes('/vs/')
  );
}

function isDebuggingPage(event: MemoryEvent): boolean {
  const titleText =
    typeof event.content.title === 'string'
      ? event.content.title.toLowerCase()
      : '';
  const urlText =
    typeof event.content.url === 'string' ? event.content.url.toLowerCase() : '';

  return (
    titleText.includes('error') ||
    titleText.includes('bug') ||
    titleText.includes('fix') ||
    titleText.includes('troubleshoot') ||
    titleText.includes('issue') ||
    urlText.includes('error') ||
    urlText.includes('bug') ||
    urlText.includes('fix') ||
    urlText.includes('troubleshoot') ||
    urlText.includes('issue')
  );
}

function getBrowserNarrativeKind(events: MemoryEvent[]): BrowserNarrativeKind {
  const includesDocumentationPage = events.some(isDocumentationPage);
  const includesSearchPage = events.some(isSearchPage);

  if (events.some(isDebuggingPage)) {
    return 'debugging';
  }

  if (includesSearchPage && includesDocumentationPage) {
    return 'research';
  }

  if (includesSearchPage) {
    return 'research';
  }

  if (events.some(isComparisonPage)) {
    return 'comparison';
  }

  if (events.every(isDocumentationPage)) {
    return 'documentation';
  }

  return 'passive';
}

function getBrowserNarrativePriority(kind: BrowserNarrativeKind): number {
  switch (kind) {
    case 'debugging':
      return 4;
    case 'comparison':
      return 3;
    case 'research':
      return 2;
    case 'documentation':
      return 1;
    default:
      return 0;
  }
}

function getRepresentativeSourceRefs(events: MemoryEvent[]): MemoryResultSourceRef[] {
  return events
    .filter((event, index, list) => {
      const currentUrl =
        typeof event.content.url === 'string' ? event.content.url : event.sourceRef;

      return (
        list.findIndex((candidate) => {
          const candidateUrl =
            typeof candidate.content.url === 'string'
              ? candidate.content.url
              : candidate.sourceRef;

          return candidateUrl === currentUrl;
        }) === index
      );
    })
    .slice(0, 3)
    .map((event) => ({
      id: event.id,
      sourceType: event.sourceType,
      sourceRef: event.sourceRef,
      timestamp: event.timestamp,
    }));
}

function getSearchQueryHints(events: MemoryEvent[]): string[] {
  const hints = new Set<string>();

  for (const event of events) {
    if (typeof event.content.url !== 'string') {
      continue;
    }

    try {
      const url = new URL(event.content.url);
      const query = url.searchParams.get('q')?.trim().toLowerCase();

      if (!query) {
        continue;
      }

      hints.add(query);
      const [firstToken] = query.split(/\s+/u);

      if (firstToken) {
        hints.add(firstToken);
      }
    } catch {
      continue;
    }
  }

  return [...hints];
}

function createBrowserThemeNarrativeSummary(
  events: MemoryEvent[],
  title: string,
  representativeEventCount: number,
): string {
  const kind = getBrowserNarrativeKind(events);
  const includesDocumentationPage = events.some(isDocumentationPage);

  if (kind === 'debugging' && includesDocumentationPage) {
    return `You debugged ${title} by reading documentation across ${representativeEventCount} pages and ${events.length} browser visits.`;
  }

  if (kind === 'debugging') {
    return `You debugged ${title} across ${representativeEventCount} pages and ${events.length} browser visits.`;
  }

  if (kind === 'research' && includesDocumentationPage) {
    return `You researched ${title} by searching and reading documentation across ${representativeEventCount} pages and ${events.length} browser visits.`;
  }

  if (kind === 'research') {
    return `You researched ${title} across ${representativeEventCount} pages and ${events.length} browser visits.`;
  }

  if (kind === 'comparison') {
    return `You compared information about ${title} across ${representativeEventCount} pages and ${events.length} browser visits.`;
  }

  if (kind === 'documentation') {
    return `You read documentation about ${title} across ${representativeEventCount} pages and ${events.length} browser visits.`;
  }

  if (representativeEventCount <= 1) {
    if (events.length === 1) {
      return `You viewed 1 page about ${title}.`;
    }

    return `You revisited 1 page about ${title} across ${events.length} browser visits.`;
  }

  return `You reviewed ${representativeEventCount} pages about ${title} across ${events.length} browser visits.`;
}

export function generateBrowserThemeNarratives(
  input: GenerateBrowserThemeNarrativesInput,
): MemoryNarrative[] {
  const groupedEvents = new Map<string, MemoryEvent[]>();
  const browserEvents = input.memoryEvents
    .filter((event) => event.sourceType.includes('browser'))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  for (const event of browserEvents) {
    const reviewDate = event.timestamp.slice(0, 10);
    const themeTitle = getMemoryEventThemeTitle(event);
    const key = `${reviewDate}:${themeTitle.toLowerCase()}`;
    const current = groupedEvents.get(key) ?? [];

    current.push(event);
    groupedEvents.set(key, current);
  }

  return Array.from(groupedEvents.entries())
    .map(([key, events]) => {
      const [reviewDate] = key.split(':', 1);
      const title = formatThemeTitleForDisplay(getMemoryEventThemeTitle(events[0]));
      const representativeRefs = getRepresentativeSourceRefs(events);

      return {
        id: `memory-narrative:browser-theme:${reviewDate}:${slugify(title)}`,
        narrativeType: 'browser-theme' as const,
        sourceCategory: 'browser' as const,
        title,
        theme: title,
        summary: createBrowserThemeNarrativeSummary(
          events,
          title,
          representativeRefs.length,
        ),
        timeRange: {
          startAt: events[0].timestamp,
          endAt: events[events.length - 1].timestamp,
        },
        sourceEventIds: events.map((event) => event.id),
        sourceRefs: representativeRefs,
        queryHints: Array.from(
          new Set([title.toLowerCase(), ...getSearchQueryHints(events)]),
        ),
        priority: getBrowserNarrativePriority(getBrowserNarrativeKind(events)),
      };
    })
    .sort((left, right) => {
      const bySourceEventCount = right.sourceEventIds.length - left.sourceEventIds.length;

      if (bySourceEventCount !== 0) {
        return bySourceEventCount;
      }

      const byPriority = right.priority - left.priority;

      if (byPriority !== 0) {
        return byPriority;
      }

      return right.timeRange.endAt.localeCompare(left.timeRange.endAt);
    })
    .map(({ priority: _priority, ...narrative }) => narrative);
}
