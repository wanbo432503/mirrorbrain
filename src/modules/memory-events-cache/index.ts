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
  type ScoredMemoryEvent,
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
      const sortedEvents = [...allEvents].sort((left, right) =>
        right.timestamp.localeCompare(left.timestamp),
      );

      const cache: MemoryEventsCache = {
        version: CACHE_VERSION,
        updatedAt: new Date().toISOString(),
        total: sortedEvents.length,
        events: sortedEvents,
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

  const sortedEvents = [...allEvents].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );

  const cache: MemoryEventsCache = {
    version: CACHE_VERSION,
    updatedAt: new Date().toISOString(),
    total: sortedEvents.length,
    events: sortedEvents,
    lastSyncSummary: {},
  };

  await saveMemoryEventsCache(workspaceDir, cache);
  return cache;
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function isBrowserUrlMemoryEvent(event: MemoryEvent): boolean {
  return (
    event.sourceType === 'activitywatch-browser' &&
    typeof event.content.url === 'string' &&
    event.content.url.length > 0
  );
}

function createMemoryEventDisplaySignature(event: MemoryEvent): string {
  if (isBrowserUrlMemoryEvent(event)) {
    return [
      event.sourceType,
      event.authorizationScopeId,
      String(event.content.url),
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
  const { scoredEvents, stats } = evaluateMemoryEventsForIngestion(newEvents);

  // Only merge events that passed evaluation
  const evaluatedEvents = scoredEvents.map((s) => s.event);
  const deduplicatedById = deduplicateById([...cachedEvents, ...evaluatedEvents]);
  const latestBySignature = new Map<string, MemoryEvent>();

  for (const event of deduplicatedById) {
    const signature = createMemoryEventDisplaySignature(event);
    const previousEvent = latestBySignature.get(signature);

    if (previousEvent === undefined) {
      latestBySignature.set(signature, mergeMemoryEventsForDisplay(event, event));
      continue;
    }

    latestBySignature.set(
      signature,
      mergeMemoryEventsForDisplay(previousEvent, event),
    );
  }

  return {
    mergedEvents: [...latestBySignature.values()].sort((left, right) =>
      right.timestamp.localeCompare(left.timestamp),
    ),
    evaluationStats: stats,
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
