import {
  createActivityWatchBrowserMemorySourcePlugin,
  fetchActivityWatchBrowserEvents,
  getActivityWatchBrowserSourceKey,
} from '../../integrations/activitywatch-browser-source/index.js';
import type {
  OpenVikingMemoryEventWriter,
} from '../../integrations/openviking-store/index.js';
import { createMemorySourceRegistry } from '../../modules/memory-capture/index.js';
import type { MirrorBrainConfig } from '../../shared/types/index.js';
import type { SyncCheckpointStore } from '../../integrations/file-sync-checkpoint-store/index.js';
import {
  runMemorySourceSyncOnce,
  type MemorySourceSyncResult,
} from '../memory-source-sync/index.js';

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

export type BrowserMemorySyncResult = MemorySourceSyncResult;

interface StartBrowserMemorySyncPollingInput {
  config: MirrorBrainConfig;
}

interface StartBrowserMemorySyncPollingDependencies {
  runSyncOnce: () => Promise<unknown>;
}

interface BrowserMemorySyncPolling {
  stop(): void;
}

export async function runBrowserMemorySyncOnce(
  input: RunBrowserMemorySyncOnceInput,
  dependencies: RunBrowserMemorySyncOnceDependencies,
): Promise<BrowserMemorySyncResult> {
  return runMemorySourceSyncOnce(
    {
      config: input.config,
      now: input.now,
      scopeId: input.scopeId,
      sourceKey: getActivityWatchBrowserSourceKey(input.bucketId),
    },
    {
      checkpointStore: dependencies.checkpointStore,
      sourceRegistry: createMemorySourceRegistry([
        createActivityWatchBrowserMemorySourcePlugin({
          bucketId: input.bucketId,
          fetchBrowserEvents: dependencies.fetchBrowserEvents,
        }),
      ]),
      writeMemoryEvent: dependencies.writeMemoryEvent,
    },
  );
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
