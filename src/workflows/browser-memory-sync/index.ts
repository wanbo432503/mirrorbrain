import {
  createActivityWatchBrowserMemorySourcePlugin,
  fetchActivityWatchBrowserEvents,
  getActivityWatchBrowserSourceKey,
} from '../../integrations/activitywatch-browser-source/index.js';
import {
  enrichBrowserMemoryEventWithPageContent,
  fetchBrowserPageContent,
} from '../../integrations/browser-page-content/index.js';
import type {
  OpenVikingMemoryEventWriter,
} from '../../integrations/openviking-store/index.js';
import {
  createOpenVikingMemoryEventRecord,
  ingestBrowserPageContentToOpenViking,
} from '../../integrations/openviking-store/index.js';
import { createMemorySourceRegistry } from '../../modules/memory-capture/index.js';
import type { MemoryEvent, MirrorBrainConfig } from '../../shared/types/index.js';
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
  workspaceDir?: string;
}

interface RunBrowserMemorySyncOnceDependencies {
  checkpointStore: SyncCheckpointStore;
  fetchBrowserEvents?: typeof fetchActivityWatchBrowserEvents;
  fetchPageContent?: typeof fetchBrowserPageContent;
  ingestPageContent?: typeof ingestBrowserPageContentToOpenViking;
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
  const enrichedEventCache = new Map<string, Promise<MemoryEvent>>();
  const enrichEvent = (event: MemoryEvent): Promise<MemoryEvent> => {
    const cacheKey = `${String(event.content.url ?? '')}|${String(event.content.title ?? '')}`;
    const cached = enrichedEventCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const enrichment = enrichBrowserMemoryEventWithPageContent(
      {
        event,
        baseUrl: input.config.openViking.baseUrl,
        workspaceDir: input.workspaceDir ?? process.cwd(),
        fetchedAt: input.now,
      },
      {
        fetchPageContent: dependencies.fetchPageContent,
        ingestPageContent:
          dependencies.ingestPageContent ?? ingestBrowserPageContentToOpenViking,
      },
    ).catch(() => event);

    enrichedEventCache.set(cacheKey, enrichment);
    return enrichment;
  };

  const result = await runMemorySourceSyncOnce(
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
      writeMemoryEvent: async (record) => {
        const enrichedEvent = await enrichEvent(record.payload);

        await dependencies.writeMemoryEvent(
          createOpenVikingMemoryEventRecord(enrichedEvent),
        );
      },
    },
  );

  return {
    ...result,
    importedEvents:
      result.importedEvents === undefined
        ? undefined
        : await Promise.all(result.importedEvents.map((event) => enrichEvent(event))),
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
