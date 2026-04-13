import type {
  OpenVikingMemoryEventRecord,
  OpenVikingMemoryEventWriter,
} from '../../integrations/openviking-store/index.js';
import { persistMemoryEvent, type MemorySourceRegistry } from '../../modules/memory-capture/index.js';
import type { MemoryEvent, MirrorBrainConfig } from '../../shared/types/index.js';
import type { SyncCheckpoint, SyncCheckpointStore } from '../../integrations/file-sync-checkpoint-store/index.js';

export interface MemorySourceSyncResult {
  sourceKey: string;
  strategy: 'initial-backfill' | 'incremental';
  importedCount: number;
  lastSyncedAt: string;
  importedEvents?: MemoryEvent[];
}

interface RunMemorySourceSyncOnceInput {
  config: MirrorBrainConfig;
  now: string;
  scopeId: string;
  sourceKey: string;
}

interface RunMemorySourceSyncOnceDependencies {
  checkpointStore: SyncCheckpointStore;
  sourceRegistry: MemorySourceRegistry;
  writeMemoryEvent: OpenVikingMemoryEventWriter['writeMemoryEvent'];
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

  for (const event of sanitizedEvents) {
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
    importedCount: sanitizedEvents.length,
    lastSyncedAt,
    importedEvents: sanitizedEvents,
  };
}
