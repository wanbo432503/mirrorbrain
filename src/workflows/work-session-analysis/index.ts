import type { MemoryEvent, MemoryTimeRange } from '../../shared/types/index.js';

export type AnalysisWindowPreset = 'last-6-hours' | 'last-24-hours' | 'last-7-days';

export interface WorkSessionAnalysisWindow extends MemoryTimeRange {
  preset: AnalysisWindowPreset;
}

export interface WorkSessionCandidate {
  id: string;
  projectHint: string;
  title: string;
  summary: string;
  memoryEventIds: string[];
  sourceTypes: string[];
  timeRange: MemoryTimeRange;
  relationHints: string[];
  reviewState: 'pending';
}

export interface WorkSessionAnalysisResult {
  analysisWindow: WorkSessionAnalysisWindow;
  generatedAt: string;
  candidates: WorkSessionCandidate[];
  excludedMemoryEventIds: string[];
}

interface AnalyzeWorkSessionCandidatesInput {
  analysisWindow: WorkSessionAnalysisWindow;
  generatedAt: string;
  memoryEvents: MemoryEvent[];
}

function isInWindow(event: MemoryEvent, window: MemoryTimeRange): boolean {
  return event.timestamp >= window.startAt && event.timestamp <= window.endAt;
}

function getExplicitProjectHint(event: MemoryEvent): string | undefined {
  const entities = Array.isArray(event.content.entities)
    ? event.content.entities
    : [];
  const projectEntity = entities.find((entity): entity is { kind: string; label: string } => (
    typeof entity === 'object' &&
    entity !== null &&
    'kind' in entity &&
    'label' in entity &&
    entity.kind === 'project' &&
    typeof entity.label === 'string' &&
    entity.label.length > 0
  ));

  return projectEntity?.label.trim();
}

function getExplicitTopicHint(event: MemoryEvent): string | undefined {
  const entities = Array.isArray(event.content.entities)
    ? event.content.entities
    : [];
  const topicEntity = entities.find((entity): entity is { kind: string; label: string } => (
    typeof entity === 'object' &&
    entity !== null &&
    'kind' in entity &&
    'label' in entity &&
    entity.kind === 'topic' &&
    typeof entity.label === 'string' &&
    entity.label.trim().length > 0
  ));

  return topicEntity?.label.trim();
}

function getTitle(event: MemoryEvent): string {
  return typeof event.content.title === 'string' && event.content.title.length > 0
    ? event.content.title
    : event.id;
}

function getSummary(event: MemoryEvent): string {
  return typeof event.content.summary === 'string' && event.content.summary.length > 0
    ? event.content.summary
    : '';
}

function getSourceSpecificValue(event: MemoryEvent, key: string): unknown {
  const sourceSpecific = event.content.sourceSpecific;

  return typeof sourceSpecific === 'object' && sourceSpecific !== null
    ? (sourceSpecific as Record<string, unknown>)[key]
    : undefined;
}

function getUrl(event: MemoryEvent): string | undefined {
  if (typeof event.content.url === 'string' && event.content.url.length > 0) {
    return event.content.url;
  }

  const sourceSpecificUrl = getSourceSpecificValue(event, 'url');
  if (typeof sourceSpecificUrl === 'string' && sourceSpecificUrl.length > 0) {
    return sourceSpecificUrl;
  }

  const entities = Array.isArray(event.content.entities)
    ? event.content.entities
    : [];
  const urlEntity = entities.find((entity): entity is { kind: string; ref?: string; label: string } => (
    typeof entity === 'object' &&
    entity !== null &&
    'kind' in entity &&
    entity.kind === 'url' &&
    (typeof (entity as { ref?: unknown }).ref === 'string' ||
      typeof (entity as { label?: unknown }).label === 'string')
  ));

  return urlEntity?.ref ?? urlEntity?.label;
}

function inferProjectHint(event: MemoryEvent): string {
  const rawUrl = getUrl(event);

  if (rawUrl !== undefined) {
    try {
      const hostname = new URL(rawUrl).hostname.toLowerCase();

      if (hostname.length > 0) {
        return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
      }
    } catch {
      // Fall through to unassigned.
    }
  }

  return 'unassigned';
}

function inferTopicHint(event: MemoryEvent): string | undefined {
  const tokens = `${getTitle(event)} ${getSummary(event)}`
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length > 1)
    .slice(0, 3);

  return tokens !== undefined && tokens.length > 0 ? tokens.join(' ') : undefined;
}

function isLocalBrowserPageMemoryEvent(event: MemoryEvent): boolean {
  if (!event.sourceType.includes('browser')) {
    return false;
  }

  const rawUrl = getUrl(event);
  if (rawUrl === undefined) {
    return false;
  }

  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      /^127(?:\.\d{1,3}){3}$/u.test(hostname)
    );
  } catch {
    return false;
  }
}

function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = '';

    return url.toString();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function createDeduplicationKey(event: MemoryEvent): string {
  const url = getUrl(event);

  if (event.sourceType.includes('browser') && url !== undefined) {
    return [
      event.sourceType,
      canonicalizeUrl(url),
      getTitle(event).trim().toLowerCase(),
      getSummary(event).trim().toLowerCase(),
    ].join('|');
  }

  return [
    event.sourceType,
    event.sourceRef,
    getTitle(event).trim().toLowerCase(),
    getSummary(event).trim().toLowerCase(),
  ].join('|');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');

  return slug.length > 0 ? slug : 'untitled';
}

function createCandidate(input: {
  projectHint: string;
  topicHint?: string;
  generatedAt: string;
  memoryEvents: MemoryEvent[];
}): WorkSessionCandidate {
  const sortedEvents = [...input.memoryEvents].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const sourceTypes = Array.from(new Set(sortedEvents.map((event) => event.sourceType))).sort();
  const memoryEventIds = sortedEvents.map((event) => event.id);
  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  const uniqueSummaries = uniqueStrings(sortedEvents.map(getSummary));
  const uniqueTitles = uniqueStrings(sortedEvents.map(getTitle));
  const title = input.topicHint ?? `${input.projectHint} work session`;

  return {
    id: `work-session-candidate:${slugify(input.projectHint)}:${slugify(title)}:${input.generatedAt}`,
    projectHint: input.projectHint,
    title,
    summary: uniqueSummaries.slice(0, 4).join(' '),
    memoryEventIds,
    sourceTypes,
    timeRange: {
      startAt: firstEvent.timestamp,
      endAt: lastEvent.timestamp,
    },
    relationHints: uniqueStrings([
      ...(input.topicHint !== undefined ? [input.topicHint] : []),
      ...uniqueTitles,
    ]),
    reviewState: 'pending',
  };
}

export function analyzeWorkSessionCandidates(
  input: AnalyzeWorkSessionCandidatesInput,
): WorkSessionAnalysisResult {
  const windowEvents = input.memoryEvents.filter((event) =>
    isInWindow(event, input.analysisWindow),
  );
  const excludedMemoryEventIds = input.memoryEvents
    .filter((event) => !isInWindow(event, input.analysisWindow))
    .map((event) => event.id);
  const includedEvents: MemoryEvent[] = [];
  const seenDeduplicationKeys = new Set<string>();

  for (const event of windowEvents) {
    if (isLocalBrowserPageMemoryEvent(event)) {
      excludedMemoryEventIds.push(event.id);
      continue;
    }

    const deduplicationKey = createDeduplicationKey(event);
    if (seenDeduplicationKeys.has(deduplicationKey)) {
      excludedMemoryEventIds.push(event.id);
      continue;
    }

    seenDeduplicationKeys.add(deduplicationKey);
    includedEvents.push(event);
  }

  const eventsByCluster = new Map<
    string,
    { projectHint: string; topicHint?: string; memoryEvents: MemoryEvent[] }
  >();

  for (const event of includedEvents) {
    const explicitProjectHint = getExplicitProjectHint(event);
    const projectHint = explicitProjectHint ?? inferProjectHint(event);
    const topicHint =
      getExplicitTopicHint(event) ??
      (explicitProjectHint === undefined ? inferTopicHint(event) : undefined);
    const clusterKey = `${projectHint}\u0000${topicHint ?? projectHint}`;
    const cluster = eventsByCluster.get(clusterKey);

    if (cluster === undefined) {
      eventsByCluster.set(clusterKey, {
        projectHint,
        topicHint,
        memoryEvents: [event],
      });
    } else {
      cluster.memoryEvents.push(event);
    }
  }

  return {
    analysisWindow: input.analysisWindow,
    generatedAt: input.generatedAt,
    candidates: [...eventsByCluster.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, cluster]) =>
        createCandidate({
          projectHint: cluster.projectHint,
          topicHint: cluster.topicHint,
          generatedAt: input.generatedAt,
          memoryEvents: cluster.memoryEvents,
        }),
      ),
    excludedMemoryEventIds,
  };
}
