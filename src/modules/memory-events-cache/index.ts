import { readFile, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { MemoryEvent } from '../../shared/types/index.js';
import {
  listMirrorBrainMemoryEventsFromOpenViking,
  listMirrorBrainMemoryEventsFromWorkspace,
} from '../../integrations/openviking-store/index.js';
import {
  evaluateMemoryEventsForIngestion,
} from './memory-event-evaluator.js';

export interface MemoryEventsCache {
  version: number;
  updatedAt: string;
  total: number;
  events: MemoryEvent[];
  lastSyncSummary: {
    browser?: {
      lastSyncedAt: string;
      importedCount: number;
      evaluationStats?: {
        total: number;
        basicFiltered: number;
        dedupRemoved: number;
        finalKept: number;
      };
    };
    shell?: {
      lastSyncedAt: string;
      importedCount: number;
      evaluationStats?: {
        total: number;
        basicFiltered: number;
        dedupRemoved: number;
        finalKept: number;
      };
    };
  };
}

export interface MemoryEventSourceFilter {
  sourceKind?: string;
  sourceInstanceId?: string;
}

interface BrowserSourceSpecificContent {
  url?: unknown;
}

const CACHE_VERSION = 1;
const CACHE_DIR_NAME = 'cache';
const CACHE_FILE_NAME = 'memory-events-cache.json';

function getCacheFilePath(workspaceDir: string): string {
  const cacheDir = join(workspaceDir, 'mirrorbrain', CACHE_DIR_NAME);
  return join(cacheDir, CACHE_FILE_NAME);
}

export async function loadMemoryEventsCache(
  workspaceDir: string,
): Promise<MemoryEventsCache | null> {
  const cacheFilePath = getCacheFilePath(workspaceDir);

  try {
    const content = await readFile(cacheFilePath, 'utf8');
    let parsed: unknown;

    try {
      parsed = JSON.parse(content) as unknown;
    } catch {
      return null;
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      'updatedAt' in parsed &&
      'total' in parsed &&
      'events' in parsed &&
      'lastSyncSummary' in parsed
    ) {
      return parsed as MemoryEventsCache;
    }

    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function saveMemoryEventsCache(
  workspaceDir: string,
  cache: MemoryEventsCache,
): Promise<void> {
  const cacheFilePath = getCacheFilePath(workspaceDir);
  const cacheDir = join(workspaceDir, 'mirrorbrain', CACHE_DIR_NAME);

  mkdirSync(cacheDir, { recursive: true });
  await writeFile(cacheFilePath, JSON.stringify(cache, null, 2));
}

export async function initializeCacheFromOpenViking(
  workspaceDir: string,
  baseUrl: string,
  dependencies?: {
    listWorkspaceMemoryEvents?: typeof listMirrorBrainMemoryEventsFromWorkspace;
    listOpenVikingMemoryEvents?: typeof listMirrorBrainMemoryEventsFromOpenViking;
  },
): Promise<MemoryEventsCache> {
  const listWorkspace = dependencies?.listWorkspaceMemoryEvents ?? listMirrorBrainMemoryEventsFromWorkspace;
  const listOpenViking = dependencies?.listOpenVikingMemoryEvents ?? listMirrorBrainMemoryEventsFromOpenViking;

  // Try workspace filesystem first (more reliable for local data)
  let allEvents: MemoryEvent[];

  try {
    allEvents = await listWorkspace({ workspaceDir });

    // If workspace has data, use it
    if (allEvents.length > 0) {
      const displayEvents = prepareMemoryEventsForDisplay(allEvents);

      const cache: MemoryEventsCache = {
        version: CACHE_VERSION,
        updatedAt: new Date().toISOString(),
        total: displayEvents.length,
        events: displayEvents,
        lastSyncSummary: {},
      };

      await saveMemoryEventsCache(workspaceDir, cache);
      return cache;
    }
  } catch {
    // Workspace read failed, continue to try OpenViking
  }

  // Workspace is empty or failed, try OpenViking
  try {
    allEvents = await listOpenViking({ baseUrl });
  } catch {
    // Both failed, return empty cache
    allEvents = [];
  }

  const displayEvents = prepareMemoryEventsForDisplay(allEvents);

  const cache: MemoryEventsCache = {
    version: CACHE_VERSION,
    updatedAt: new Date().toISOString(),
    total: displayEvents.length,
    events: displayEvents,
    lastSyncSummary: {},
  };

  await saveMemoryEventsCache(workspaceDir, cache);
  return cache;
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function isBrowserUrlMemoryEvent(event: MemoryEvent): boolean {
  return getBrowserMemoryEventUrl(event) !== null;
}

function getBrowserMemoryEventUrl(event: MemoryEvent): string | null {
  if (
    event.sourceType !== 'activitywatch-browser' &&
    event.sourceType !== 'browser'
  ) {
    return null;
  }

  if (typeof event.content.url === 'string' && event.content.url.length > 0) {
    return event.content.url;
  }

  const sourceSpecific = event.content.sourceSpecific as
    | BrowserSourceSpecificContent
    | undefined;
  if (typeof sourceSpecific?.url === 'string' && sourceSpecific.url.length > 0) {
    return sourceSpecific.url;
  }

  const urlEntity = Array.isArray(event.content.entities)
    ? event.content.entities.find(
        (entity): entity is { ref: string } =>
          typeof entity === 'object' &&
          entity !== null &&
          'kind' in entity &&
          entity.kind === 'url' &&
          'ref' in entity &&
          typeof entity.ref === 'string' &&
          entity.ref.length > 0,
      )
    : undefined;

  return urlEntity?.ref ?? null;
}

function normalizeBrowserMemoryEventUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function isBlacklistedBrowserUrl(url: string): boolean {
  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return true;
  }

  try {
    const parsed = new URL(trimmedUrl);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    return (
      protocol === 'chrome:' ||
      protocol === 'chrome-extension:' ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

function isBlacklistedMemoryEvent(event: MemoryEvent): boolean {
  const url = getBrowserMemoryEventUrl(event);

  return url !== null && isBlacklistedBrowserUrl(url);
}

function createMemoryEventDisplaySignature(event: MemoryEvent): string {
  const browserUrl = getBrowserMemoryEventUrl(event);

  if (browserUrl !== null) {
    return [
      event.sourceType,
      event.authorizationScopeId,
      normalizeBrowserMemoryEventUrl(browserUrl),
    ].join('|');
  }

  return event.id;
}

function getMemoryEventAccessTimes(event: MemoryEvent): string[] {
  const contentAccessTimes = Array.isArray(event.content.accessTimes)
    ? event.content.accessTimes.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  return Array.from(new Set([event.timestamp, ...contentAccessTimes])).sort(
    (left, right) => right.localeCompare(left),
  );
}

function mergeMemoryEventsForDisplay(
  previousEvent: MemoryEvent,
  nextEvent: MemoryEvent,
): MemoryEvent {
  const latestEvent =
    nextEvent.timestamp.localeCompare(previousEvent.timestamp) >= 0
      ? nextEvent
      : previousEvent;
  const mergedAccessTimes = Array.from(
    new Set([
      ...getMemoryEventAccessTimes(previousEvent),
      ...getMemoryEventAccessTimes(nextEvent),
    ]),
  ).sort((left, right) => right.localeCompare(left));

  if (!isBrowserUrlMemoryEvent(latestEvent)) {
    return latestEvent;
  }

  return {
    ...latestEvent,
    content: {
      ...latestEvent.content,
      accessTimes: mergedAccessTimes,
      latestAccessedAt: mergedAccessTimes[0] ?? latestEvent.timestamp,
    },
  };
}

function prepareMemoryEventsForDisplay(events: MemoryEvent[]): MemoryEvent[] {
  const deduplicatedById = deduplicateById(
    events.filter((event) => !isBlacklistedMemoryEvent(event)),
  );
  const latestBySignature = new Map<string, MemoryEvent>();

  for (const event of deduplicatedById) {
    const signature = createMemoryEventDisplaySignature(event);
    const previousEvent = latestBySignature.get(signature);

    if (previousEvent === undefined) {
      latestBySignature.set(signature, event);
      continue;
    }

    latestBySignature.set(
      signature,
      mergeMemoryEventsForDisplay(previousEvent, event),
    );
  }

  return [...latestBySignature.values()].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );
}

function mergeNewEventsToCache(
  cachedEvents: MemoryEvent[],
  newEvents: MemoryEvent[],
): {
  mergedEvents: MemoryEvent[];
  evaluationStats: {
    total: number;
    basicFiltered: number;
    dedupRemoved: number;
    finalKept: number;
  };
} {
  // Evaluate new events BEFORE merging (OpenWiki-style first-stage assessment)
  const newEventsAfterBlacklist = newEvents.filter(
    (event) => !isBlacklistedMemoryEvent(event),
  ).sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  const { scoredEvents, stats } =
    evaluateMemoryEventsForIngestion(newEventsAfterBlacklist);

  // Only merge events that passed evaluation
  const evaluatedEvents = scoredEvents.map((s) => s.event);
  const mergedEvents = prepareMemoryEventsForDisplay([
    ...cachedEvents,
    ...evaluatedEvents,
  ]);

  return {
    mergedEvents,
    evaluationStats: {
      ...stats,
      total: newEvents.length,
      basicFiltered:
        stats.basicFiltered + (newEvents.length - newEventsAfterBlacklist.length),
      finalKept: mergedEvents.length,
    },
  };
}

export async function updateCacheWithNewEvents(
  workspaceDir: string,
  baseUrl: string,
  newEvents: MemoryEvent[],
  sourceType: 'browser' | 'shell',
): Promise<MemoryEventsCache> {
  let cache = await loadMemoryEventsCache(workspaceDir);

  if (cache === null) {
    cache = await initializeCacheFromOpenViking(workspaceDir, baseUrl);
    return cache;
  }

  const { mergedEvents, evaluationStats } = mergeNewEventsToCache(cache.events, newEvents);

  cache.events = mergedEvents;
  cache.total = mergedEvents.length;
  cache.updatedAt = new Date().toISOString();
  cache.lastSyncSummary[sourceType] = {
    lastSyncedAt: new Date().toISOString(),
    importedCount: newEvents.length,
    evaluationStats,
  };

  await saveMemoryEventsCache(workspaceDir, cache);
  return cache;
}

export function getEventsFromCache(
  cache: MemoryEventsCache,
  page: number,
  pageSize: number,
  filter: MemoryEventSourceFilter = {},
): {
  events: MemoryEvent[];
  total: number;
  totalPages: number;
} {
  const filteredEvents = cache.events.filter((event) =>
    matchesMemoryEventSourceFilter(event, filter),
  );
  const total = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    events: filteredEvents.slice(startIndex, endIndex),
    total,
    totalPages,
  };
}

function matchesMemoryEventSourceFilter(
  event: MemoryEvent,
  filter: MemoryEventSourceFilter,
): boolean {
  if (filter.sourceKind !== undefined && event.sourceType !== filter.sourceKind) {
    return false;
  }

  if (filter.sourceInstanceId === undefined) {
    return true;
  }

  const [sourceKind, sourceInstanceId] = event.sourceRef.split(':');

  return sourceKind === event.sourceType && sourceInstanceId === filter.sourceInstanceId;
}
