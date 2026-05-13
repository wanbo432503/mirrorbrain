import type {
  QmdWorkspaceMemoryEventWriter,
} from '../../integrations/qmd-workspace-store/index.js';
import { persistMemoryEvent, type MemorySourceRegistry } from '../../modules/memory-capture/index.js';
import type {
  MemoryEvent,
  MirrorBrainConfig,
  MirrorBrainSourceCategory,
} from '../../shared/types/index.js';
import type { SyncCheckpoint, SyncCheckpointStore } from '../../integrations/file-sync-checkpoint-store/index.js';

export interface MemorySourceSyncResult {
  sourceKey: string;
  strategy: 'initial-backfill' | 'incremental';
  importedCount: number;
  lastSyncedAt: string;
  importedEvents?: MemoryEvent[];
}

export interface MemorySourceSyncAuthorizationInput {
  sourceKey: string;
  sourceCategory: MirrorBrainSourceCategory;
  scopeId: string;
}

export type MemorySourceSyncAuthorizationDependency = (
  input: MemorySourceSyncAuthorizationInput,
) => boolean | Promise<boolean>;

interface RunMemorySourceSyncOnceInput {
  config: MirrorBrainConfig;
  now: string;
  scopeId: string;
  sourceKey: string;
}

interface RunMemorySourceSyncOnceDependencies {
  checkpointStore: SyncCheckpointStore;
  sourceRegistry: MemorySourceRegistry;
  authorizeSourceSync?: MemorySourceSyncAuthorizationDependency;
  prepareEvents?: (events: MemoryEvent[]) => Promise<MemoryEvent[]>;
  writeMemoryEvent: QmdWorkspaceMemoryEventWriter['writeMemoryEvent'];
}

function getNextCheckpoint(
  checkpoint: SyncCheckpoint | null,
  now: string,
  timestamps: string[],
): string {
  return [checkpoint?.lastSyncedAt, now, ...timestamps]
    .filter((value): value is string => value !== null && value !== undefined)
    .sort()
    .at(-1) ?? now;
}

async function assertSourceSyncAuthorized(
  input: MemorySourceSyncAuthorizationInput,
  authorizeSourceSync: MemorySourceSyncAuthorizationDependency | undefined,
): Promise<void> {
  const isAuthorized =
    authorizeSourceSync === undefined ? true : await authorizeSourceSync(input);

  if (!isAuthorized) {
    throw new Error(
      `Memory source ${input.sourceKey} is not authorized for scope ${input.scopeId}.`,
    );
  }
}

export async function runMemorySourceSyncOnce(
  input: RunMemorySourceSyncOnceInput,
  dependencies: RunMemorySourceSyncOnceDependencies,
): Promise<MemorySourceSyncResult> {
  const source = dependencies.sourceRegistry.getSource(input.sourceKey);

  if (source === null) {
    throw new Error(
      `Memory source plugin is not registered for source key ${input.sourceKey}.`,
    );
  }

  const authorizationInput = {
    sourceKey: source.sourceKey,
    sourceCategory: source.sourceCategory,
    scopeId: input.scopeId,
  };

  await assertSourceSyncAuthorized(
    authorizationInput,
    dependencies.authorizeSourceSync,
  );

  const checkpoint = await dependencies.checkpointStore.readCheckpoint(
    source.sourceKey,
  );
  const plan = source.createSyncPlan({
    config: input.config,
    checkpoint,
    now: input.now,
  });
  const rawEvents = await source.fetchEvents({
    config: input.config,
    plan,
  });
  const normalizedEvents = rawEvents.map((event) =>
    source.normalizeEvent({
      scopeId: input.scopeId,
      event,
    }),
  );
  const sanitizedEvents =
    source.sanitizeEvents?.(normalizedEvents) ?? normalizedEvents;
  const preparedEvents =
    dependencies.prepareEvents === undefined
      ? sanitizedEvents
      : await dependencies.prepareEvents(sanitizedEvents);

  await assertSourceSyncAuthorized(
    authorizationInput,
    dependencies.authorizeSourceSync,
  );

  for (const event of preparedEvents) {
    await persistMemoryEvent(event, {
      writeMemoryEvent: dependencies.writeMemoryEvent,
    });
  }

  const lastSyncedAt = getNextCheckpoint(
    checkpoint,
    input.now,
    normalizedEvents.map((event) => event.timestamp),
  );

  await dependencies.checkpointStore.writeCheckpoint({
    sourceKey: source.sourceKey,
    lastSyncedAt,
    updatedAt: input.now,
  });

  return {
      sourceKey: source.sourceKey,
      strategy: plan.strategy,
      importedCount: preparedEvents.length,
      lastSyncedAt,
      importedEvents: preparedEvents,
    };
}
