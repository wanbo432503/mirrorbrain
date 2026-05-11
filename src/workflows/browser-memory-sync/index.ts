import { join } from 'node:path';

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
  createMirrorBrainResourceTarget,
  createOpenVikingMemoryEventRecord,
  ingestBrowserPageContentToOpenViking,
} from '../../integrations/openviking-store/index.js';
import { createMemorySourceRegistry } from '../../modules/memory-capture/index.js';
import type { MemoryEvent, MirrorBrainConfig } from '../../shared/types/index.js';
import type { SyncCheckpointStore } from '../../integrations/file-sync-checkpoint-store/index.js';
import {
  runMemorySourceSyncOnce,
  type MemorySourceSyncAuthorizationDependency,
  type MemorySourceSyncResult,
} from '../memory-source-sync/index.js';

interface RunBrowserMemorySyncOnceInput {
  config: MirrorBrainConfig;
  now: string;
  bucketId: string;
  initialBackfillStartAt?: string;
  scopeId: string;
  workspaceDir?: string;
}

export interface BrowserPageContentCaptureAuthorizationInput {
  sourceKey: string;
  scopeId: string;
  url: string;
}

export type BrowserPageContentCaptureAuthorizationDependency = (
  input: BrowserPageContentCaptureAuthorizationInput,
) => boolean | Promise<boolean>;

interface RunBrowserMemorySyncOnceDependencies {
  checkpointStore: SyncCheckpointStore;
  authorizeSourceSync?: MemorySourceSyncAuthorizationDependency;
  authorizePageContentCapture?: BrowserPageContentCaptureAuthorizationDependency;
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

function createBrowserPageContentStorageRef(
  workspaceDir: string,
  artifact: BrowserPageContentArtifact,
): {
  sourcePath: string;
  rootUri: string;
} {
  return {
    sourcePath: join(
      workspaceDir,
      'mirrorbrain',
      'browser-page-content',
      `${artifact.id}.md`,
    ),
    rootUri: createMirrorBrainResourceTarget(
      'browser-page-content',
      `${artifact.id}.md`,
    ),
  };
}

export async function runBrowserMemorySyncOnce(
  input: RunBrowserMemorySyncOnceInput,
  dependencies: RunBrowserMemorySyncOnceDependencies,
): Promise<BrowserMemorySyncResult> {
  const workspaceDir = input.workspaceDir ?? process.cwd();
  const fetchPage = dependencies.fetchPageContent ?? fetchBrowserPageContent;
  const ingestPage =
    dependencies.ingestPageContent ?? ingestBrowserPageContentToOpenViking;
  const sourceKey = getActivityWatchBrowserSourceKey(input.bucketId);
  const pageContentAuthorization = new Map<string, boolean>();
  const groupedArtifacts = new Map<string, BrowserPageContentArtifact>();
  const groupedEvents = new Map<string, MemoryEvent[]>();
  const existingArtifactStorage = new Map<
    string,
    { sourcePath: string; rootUri: string }
  >();
  const isPageContentCaptureAuthorized = async (url: string) => {
    const cached = pageContentAuthorization.get(url);

    if (cached !== undefined) {
      return cached;
    }

    const isAuthorized =
      dependencies.authorizePageContentCapture === undefined
        ? true
        : await dependencies.authorizePageContentCapture({
            sourceKey,
            scopeId: input.scopeId,
            url,
          });

    pageContentAuthorization.set(url, isAuthorized);

    return isAuthorized;
  };
  const result = await runMemorySourceSyncOnce(
    {
      config: input.config,
      now: input.now,
      scopeId: input.scopeId,
      sourceKey,
    },
    {
      checkpointStore: dependencies.checkpointStore,
      authorizeSourceSync: dependencies.authorizeSourceSync,
      sourceRegistry: createMemorySourceRegistry([
        createActivityWatchBrowserMemorySourcePlugin({
          bucketId: input.bucketId,
          initialBackfillStartAt: input.initialBackfillStartAt,
          fetchBrowserEvents: dependencies.fetchBrowserEvents,
        }),
      ]),
      prepareEvents: async (events) => {
        groupedArtifacts.clear();
        groupedEvents.clear();
        existingArtifactStorage.clear();

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

          const group = groupedEvents.get(url) ?? [];
          group.push(event);
          groupedEvents.set(url, group);
        }

        for (const [url, urlEvents] of groupedEvents) {
          let sharedArtifact: BrowserPageContentArtifact | null =
            (await loadBrowserPageContentArtifactFromWorkspace({
              workspaceDir,
              url,
            })) ?? null;

          const sortedEvents = [...urlEvents].sort((left, right) =>
            left.timestamp.localeCompare(right.timestamp),
          );

          if (sortedEvents.length === 0) {
            continue;
          }

          for (const event of sortedEvents) {
            sharedArtifact = buildBrowserPageContentArtifact({
              url,
              title:
                typeof event.content.title === 'string'
                  ? event.content.title
                  : sharedArtifact?.title ?? 'Untitled Page',
              text: sharedArtifact?.text ?? '',
              accessedAt: event.timestamp,
              existingArtifact: sharedArtifact ?? undefined,
            });
          }

          if (sharedArtifact === null) {
            continue;
          }

          groupedArtifacts.set(url, sharedArtifact);

          if (
            sharedArtifact.text.length > 0 &&
            (await isPageContentCaptureAuthorized(url))
          ) {
            existingArtifactStorage.set(
              url,
              createBrowserPageContentStorageRef(workspaceDir, sharedArtifact),
            );
          }
        }

        return events.map((event) => {
          const url =
            typeof event.content.url === 'string' ? event.content.url : null;

          if (url === null) {
            return event;
          }

          const sharedArtifact = groupedArtifacts.get(url);
          const stored = existingArtifactStorage.get(url);

          if (sharedArtifact === undefined) {
            return event;
          }

          return {
            ...event,
            content: {
              ...event.content,
              ...(stored === undefined
                ? {
                    title: sharedArtifact.title,
                    latestAccessedAt: sharedArtifact.latestAccessedAt,
                    accessTimes: sharedArtifact.accessTimes,
                  }
                : createBrowserPageContentEventContent(sharedArtifact, stored)),
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

  if (groupedArtifacts.size > 0) {
    void (async () => {
      for (const [url, artifact] of groupedArtifacts) {
        if (!(await isPageContentCaptureAuthorized(url))) {
          continue;
        }

        let artifactToStore = artifact;

        if (artifactToStore.text.length === 0) {
          try {
            const page = await fetchPage({
              url,
              title: artifactToStore.title,
              fetchedAt: input.now,
            });
            artifactToStore = {
              ...artifactToStore,
              title: page.title,
              text: page.text,
            };
          } catch {
            continue;
          }
        }

        try {
          await ingestPage({
            baseUrl: input.config.openViking.baseUrl,
            workspaceDir,
            artifact: artifactToStore,
          });
        } catch {
          continue;
        }
      }
    })();
  }

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
