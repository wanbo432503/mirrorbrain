import {
  deduplicateMemoryEvents,
  normalizeActivityWatchBrowserEvent,
  type MemorySourcePlugin,
} from '../../modules/memory-capture/index.js';
import type { MirrorBrainConfig } from '../../shared/types/index.js';

interface InitialBrowserSyncPlanInput {
  now: string;
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

export interface ActivityWatchBrowserEvent {
  id: string;
  timestamp: string;
  data: {
    url: string;
    title: string;
  };
}

interface CreateActivityWatchBrowserMemorySourcePluginInput {
  bucketId: string;
  fetchBrowserEvents?: typeof fetchActivityWatchBrowserEvents;
}

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export function createInitialBrowserSyncPlan(
  config: MirrorBrainConfig,
  input: InitialBrowserSyncPlanInput,
): BrowserSyncPlan {
  const end = new Date(input.now);
  const start = new Date(end);
  start.setUTCHours(start.getUTCHours() - config.sync.initialBackfillHours);

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

export function getActivityWatchBrowserSourceKey(bucketId: string): string {
  return `activitywatch-browser:${bucketId}`;
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
      return deduplicateMemoryEvents(events, (event) =>
        [
          event.sourceType,
          event.authorizationScopeId,
          event.timestamp,
          String(event.content.url ?? ''),
          String(event.content.title ?? ''),
        ].join('|'),
      );
    },
  };
}
