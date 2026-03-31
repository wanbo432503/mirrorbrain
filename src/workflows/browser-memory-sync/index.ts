import {
  createIncrementalBrowserSyncPlan,
  createInitialBrowserSyncPlan,
  fetchActivityWatchBrowserEvents,
} from '../../integrations/activitywatch-browser-source/index.js';
import type {
  OpenVikingMemoryEventRecord,
  OpenVikingMemoryEventWriter,
} from '../../integrations/openviking-store/index.js';
import { persistMemoryEvent } from '../../modules/memory-capture/index.js';
import { normalizeActivityWatchBrowserEvent } from '../../modules/memory-capture/index.js';
import type { MirrorBrainConfig } from '../../shared/types/index.js';
import type { SyncCheckpoint, SyncCheckpointStore } from '../../integrations/file-sync-checkpoint-store/index.js';

interface RunBrowserMemorySyncOnceInput {
  config: MirrorBrainConfig;
  now: string;
  bucketId: string;
  scopeId: string;
}

interface RunBrowserMemorySyncOnceDependencies {
  checkpointStore: SyncCheckpointStore;
  fetchBrowserEvents?: typeof fetchActivityWatchBrowserEvents;
  writeMemoryEvent: OpenVikingMemoryEventWriter['writeMemoryEvent'];
}

export interface BrowserMemorySyncResult {
  sourceKey: string;
  strategy: 'initial-backfill' | 'incremental';
  importedCount: number;
  lastSyncedAt: string;
}

interface StartBrowserMemorySyncPollingInput {
  config: MirrorBrainConfig;
}

interface StartBrowserMemorySyncPollingDependencies {
  runSyncOnce: () => Promise<unknown>;
}

interface BrowserMemorySyncPolling {
  stop(): void;
}

function getBrowserSourceKey(bucketId: string): string {
  return `activitywatch-browser:${bucketId}`;
}

function getNextCheckpoint(
  checkpoint: SyncCheckpoint | null,
  now: string,
  events: Array<{ timestamp: string }>,
): string {
  const timestamps = events.map((event) => event.timestamp);

  return [checkpoint?.lastSyncedAt, now, ...timestamps]
    .filter((value): value is string => value !== null && value !== undefined)
    .sort()
    .at(-1) ?? now;
}

export async function runBrowserMemorySyncOnce(
  input: RunBrowserMemorySyncOnceInput,
  dependencies: RunBrowserMemorySyncOnceDependencies,
): Promise<BrowserMemorySyncResult> {
  const sourceKey = getBrowserSourceKey(input.bucketId);
  const checkpoint = await dependencies.checkpointStore.readCheckpoint(sourceKey);
  const plan = checkpoint
    ? createIncrementalBrowserSyncPlan(input.config, {
        lastSyncedAt: checkpoint.lastSyncedAt,
        now: input.now,
      })
    : createInitialBrowserSyncPlan(input.config, {
        now: input.now,
      });
  const fetchBrowserEvents =
    dependencies.fetchBrowserEvents ?? fetchActivityWatchBrowserEvents;
  const events = await fetchBrowserEvents({
    baseUrl: input.config.activityWatch.baseUrl,
    bucketId: input.bucketId,
    start: plan.start,
    end: plan.end,
  });

  for (const event of events) {
    await persistMemoryEvent(
      normalizeActivityWatchBrowserEvent({
        scopeId: input.scopeId,
        event,
      }),
      {
        writeMemoryEvent: dependencies.writeMemoryEvent,
      },
    );
  }

  const lastSyncedAt = getNextCheckpoint(checkpoint, input.now, events);

  await dependencies.checkpointStore.writeCheckpoint({
    sourceKey,
    lastSyncedAt,
    updatedAt: input.now,
  });

  return {
    sourceKey,
    strategy: plan.strategy,
    importedCount: events.length,
    lastSyncedAt,
  };
}

export function startBrowserMemorySyncPolling(
  input: StartBrowserMemorySyncPollingInput,
  dependencies: StartBrowserMemorySyncPollingDependencies,
): BrowserMemorySyncPolling {
  let isRunning = false;

  const tick = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      await dependencies.runSyncOnce();
    } finally {
      isRunning = false;
    }
  };

  void tick();

  const intervalId = setInterval(() => {
    void tick();
  }, input.config.sync.pollingIntervalMs);

  return {
    stop() {
      clearInterval(intervalId);
    },
  };
}
