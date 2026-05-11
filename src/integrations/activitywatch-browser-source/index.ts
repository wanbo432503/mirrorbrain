import {
  deduplicateMemoryEvents,
  normalizeActivityWatchBrowserEvent,
  type MemorySourcePlugin,
} from '../../modules/memory-capture/index.js';
import type { MemoryEvent } from '../../shared/types/index.js';
import type { MirrorBrainConfig } from '../../shared/types/index.js';

interface InitialBrowserSyncPlanInput {
  now: string;
  startAt?: string;
}

interface IncrementalBrowserSyncPlanInput {
  lastSyncedAt: string;
  now: string;
}

interface BrowserSyncPlan {
  strategy: 'initial-backfill' | 'incremental';
  start: string;
  end: string;
}

interface BrowserSyncSchedule {
  pollingIntervalMs: number;
}

interface FetchActivityWatchBrowserEventsInput {
  baseUrl: string;
  bucketId: string;
  start: string;
  end: string;
}

interface ActivityWatchBucketSummary {
  id: string;
  last_updated?: string;
  created?: string;
  type?: string;
}

export interface ActivityWatchBrowserEvent {
  id: string;
  timestamp: string;
  data: {
    url: string;
    title: string;
  };
}

type FetchActivityWatchBucketsInput = {
  baseUrl: string;
};

interface CreateActivityWatchBrowserMemorySourcePluginInput {
  bucketId: string;
  initialBackfillStartAt?: string;
  fetchBrowserEvents?: typeof fetchActivityWatchBrowserEvents;
}

const BROWSER_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export function createInitialBrowserSyncPlan(
  config: MirrorBrainConfig,
  input: InitialBrowserSyncPlanInput,
): BrowserSyncPlan {
  const end = new Date(input.now);
  const requestedStart =
    typeof input.startAt === 'string' ? new Date(input.startAt) : null;
  const start =
    requestedStart !== null &&
    Number.isFinite(requestedStart.getTime()) &&
    requestedStart.getTime() <= end.getTime()
      ? requestedStart
      : new Date(end);

  if (start.getTime() === end.getTime()) {
    start.setUTCHours(start.getUTCHours() - config.sync.initialBackfillHours);
  }

  return {
    strategy: 'initial-backfill',
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function createIncrementalBrowserSyncPlan(
  _config: MirrorBrainConfig,
  input: IncrementalBrowserSyncPlanInput,
): BrowserSyncPlan {
  return {
    strategy: 'incremental',
    start: input.lastSyncedAt,
    end: input.now,
  };
}

export function getBrowserSyncSchedule(
  config: MirrorBrainConfig,
): BrowserSyncSchedule {
  return {
    pollingIntervalMs: config.sync.pollingIntervalMs,
  };
}

export async function fetchActivityWatchBrowserEvents(
  input: FetchActivityWatchBrowserEventsInput,
  fetchImpl: FetchLike = fetch,
): Promise<ActivityWatchBrowserEvent[]> {
  const url = new URL(
    `/api/0/buckets/${input.bucketId}/events`,
    input.baseUrl,
  );
  url.searchParams.set('start', input.start);
  url.searchParams.set('end', input.end);

  const response = await fetchImpl(url.toString());

  if (!response.ok) {
    throw new Error(`ActivityWatch request failed with status ${response.status}`);
  }

  return (await response.json()) as ActivityWatchBrowserEvent[];
}

export async function fetchActivityWatchBuckets(
  input: FetchActivityWatchBucketsInput,
  fetchImpl: FetchLike = fetch,
): Promise<ActivityWatchBucketSummary[]> {
  const response = await fetchImpl(new URL('/api/0/buckets/', input.baseUrl).toString());

  if (!response.ok) {
    throw new Error(`ActivityWatch request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, ActivityWatchBucketSummary>;

  return Object.entries(payload).map(([id, bucket]) => ({
    ...bucket,
    id,
  }));
}

function isActivityWatchBrowserBucket(bucket: ActivityWatchBucketSummary): boolean {
  return bucket.id.startsWith('aw-watcher-web');
}

function getBucketRecencyValue(bucket: ActivityWatchBucketSummary): string {
  return bucket.last_updated ?? bucket.created ?? '';
}

export function resolveActivityWatchBrowserBucket(
  buckets: ActivityWatchBucketSummary[],
): string | null {
  return buckets
    .filter(isActivityWatchBrowserBucket)
    .sort((left, right) =>
      getBucketRecencyValue(right).localeCompare(getBucketRecencyValue(left)),
    )[0]?.id ?? null;
}

export function getActivityWatchBrowserSourceKey(bucketId: string): string {
  return `activitywatch-browser:${bucketId}`;
}

function createBrowserEventSignature(event: {
  sourceType: string;
  authorizationScopeId: string;
  content: Record<string, unknown>;
}): string {
  return [
    event.sourceType,
    event.authorizationScopeId,
    String(event.content.url ?? ''),
    String(event.content.title ?? ''),
  ].join('|');
}

function isLocalBrowserPageEvent(event: MemoryEvent): boolean {
  if (typeof event.content.url !== 'string') {
    return false;
  }

  try {
    const url = new URL(event.content.url);
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

function sanitizeActivityWatchBrowserEvents(events: MemoryEvent[]): MemoryEvent[] {
  const sortedEvents = events
    .filter((event) => !isLocalBrowserPageEvent(event))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const keptEvents: typeof sortedEvents = [];

  for (const event of sortedEvents) {
    const previousEvent = keptEvents.at(-1);

    if (previousEvent === undefined) {
      keptEvents.push(event);
      continue;
    }

    const sameSignature =
      createBrowserEventSignature(previousEvent) ===
      createBrowserEventSignature(event);
    const eventTime = new Date(event.timestamp).getTime();
    const previousEventTime = new Date(previousEvent.timestamp).getTime();
    const withinDuplicateWindow =
      Number.isFinite(eventTime) &&
      Number.isFinite(previousEventTime) &&
      eventTime - previousEventTime <= BROWSER_DUPLICATE_WINDOW_MS;

    if (sameSignature && withinDuplicateWindow) {
      continue;
    }

    keptEvents.push(event);
  }

  return deduplicateMemoryEvents(keptEvents);
}

export function createActivityWatchBrowserMemorySourcePlugin(
  input: CreateActivityWatchBrowserMemorySourcePluginInput,
): MemorySourcePlugin<ActivityWatchBrowserEvent> {
  const fetchBrowserEvents =
    input.fetchBrowserEvents ?? fetchActivityWatchBrowserEvents;

  return {
    sourceKey: getActivityWatchBrowserSourceKey(input.bucketId),
    sourceCategory: 'browser',
    createSyncPlan({ config, checkpoint, now }) {
      return checkpoint
        ? createIncrementalBrowserSyncPlan(config, {
            lastSyncedAt: checkpoint.lastSyncedAt,
            now,
          })
        : createInitialBrowserSyncPlan(config, {
            now,
            startAt: input.initialBackfillStartAt,
          });
    },
    fetchEvents({ config, plan }) {
      return fetchBrowserEvents({
        baseUrl: config.activityWatch.baseUrl,
        bucketId: input.bucketId,
        start: plan.start,
        end: plan.end,
      });
    },
    normalizeEvent({ scopeId, event }) {
      return normalizeActivityWatchBrowserEvent({
        scopeId,
        event,
      });
    },
    sanitizeEvents(events) {
      return sanitizeActivityWatchBrowserEvents(events);
    },
  };
}
