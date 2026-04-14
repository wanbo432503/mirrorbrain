import {
  createActivityWatchBrowserMemorySourcePlugin,
  fetchActivityWatchBrowserEvents,
  getActivityWatchBrowserSourceKey,
} from '../../integrations/activitywatch-browser-source/index.js';
import {
  type BrowserPageContentArtifact,
  buildBrowserPageContentArtifact,
  createBrowserPageContentEventContent,
  fetchBrowserPageContent,
  isSkippableBrowserPageUrl,
  loadBrowserPageContentArtifactFromWorkspace,
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
  const workspaceDir = input.workspaceDir ?? process.cwd();
  const fetchPage = dependencies.fetchPageContent ?? fetchBrowserPageContent;
  const ingestPage =
    dependencies.ingestPageContent ?? ingestBrowserPageContentToOpenViking;
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
      prepareEvents: async (events) => {
        const groupedByUrl = new Map<string, MemoryEvent[]>();

        for (const event of events) {
          const url =
            typeof event.content.url === 'string' ? event.content.url : null;

          if (
            url === null ||
            !/^https?:\/\//iu.test(url) ||
            isSkippableBrowserPageUrl(url)
          ) {
            continue;
          }

          const group = groupedByUrl.get(url) ?? [];
          group.push(event);
          groupedByUrl.set(url, group);
        }

        const sharedArtifacts = new Map<string, BrowserPageContentArtifact>();
        const storedArtifacts = new Map<
          string,
          { sourcePath: string; rootUri: string }
        >();

        for (const [url, groupedEvents] of groupedByUrl) {
          let sharedArtifact: BrowserPageContentArtifact | null =
            (await loadBrowserPageContentArtifactFromWorkspace({
              workspaceDir,
              url,
            })) ?? null;
          let pageText =
            sharedArtifact === null
              ? null
              : {
                  url,
                  title: sharedArtifact.title,
                  fetchedAt: input.now,
                  text: sharedArtifact.text,
                };

          const sortedEvents = [...groupedEvents].sort((left, right) =>
            left.timestamp.localeCompare(right.timestamp),
          );

          if (sortedEvents.length === 0) {
            continue;
          }

          if (pageText === null) {
            const firstEvent = sortedEvents[0];

            if (firstEvent === undefined) {
              continue;
            }

            const eventTitle =
              typeof firstEvent.content.title === 'string'
                ? firstEvent.content.title
                : 'Untitled Page';

            pageText = await fetchPage({
              url,
              title: eventTitle,
              fetchedAt: input.now,
            });
          }

          for (const event of sortedEvents) {
            sharedArtifact = buildBrowserPageContentArtifact({
              url,
              title: pageText.title,
              text: pageText.text,
              accessedAt: event.timestamp,
              existingArtifact: sharedArtifact ?? undefined,
            });
          }

          if (sharedArtifact === null) {
            continue;
          }

          const stored = await ingestPage({
            baseUrl: input.config.openViking.baseUrl,
            workspaceDir,
            artifact: sharedArtifact,
          });

          sharedArtifacts.set(url, sharedArtifact);
          storedArtifacts.set(url, stored);
        }

        return events.map((event) => {
          const url =
            typeof event.content.url === 'string' ? event.content.url : null;

          if (url === null) {
            return event;
          }

          const sharedArtifact = sharedArtifacts.get(url);
          const stored = storedArtifacts.get(url);

          if (sharedArtifact === undefined || stored === undefined) {
            return event;
          }

          return {
            ...event,
            content: {
              ...event.content,
              ...createBrowserPageContentEventContent(sharedArtifact, stored),
            },
          };
        });
      },
      writeMemoryEvent: async (record) => {
        await dependencies.writeMemoryEvent(
          createOpenVikingMemoryEventRecord(record.payload),
        );
      },
    },
  );

  return result;
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
