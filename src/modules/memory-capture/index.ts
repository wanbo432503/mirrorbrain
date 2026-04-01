import {
  createOpenVikingMemoryEventRecord,
  type OpenVikingMemoryEventWriter,
} from '../../integrations/openviking-store/index.js';
import type { SyncCheckpoint } from '../../integrations/file-sync-checkpoint-store/index.js';
import type {
  MemoryEvent,
  MirrorBrainConfig,
  MirrorBrainSourceCategory,
} from '../../shared/types/index.js';

interface ActivityWatchBrowserEventInput {
  scopeId: string;
  event: {
    id: string;
    timestamp: string;
    data: {
      url: string;
      title: string;
    };
  };
}

export interface MemorySourceSyncPlan {
  strategy: 'initial-backfill' | 'incremental';
  start: string;
  end: string;
}

export interface MemorySourcePlugin<TRawEvent> {
  sourceKey: string;
  sourceCategory: MirrorBrainSourceCategory;
  createSyncPlan(input: {
    config: MirrorBrainConfig;
    checkpoint: SyncCheckpoint | null;
    now: string;
  }): MemorySourceSyncPlan;
  fetchEvents(input: {
    config: MirrorBrainConfig;
    plan: MemorySourceSyncPlan;
  }): Promise<TRawEvent[]>;
  normalizeEvent(input: {
    scopeId: string;
    event: TRawEvent;
  }): MemoryEvent;
  sanitizeEvents?(events: MemoryEvent[]): MemoryEvent[];
}

export interface MemorySourceRegistry {
  getSource(sourceKey: string): MemorySourcePlugin<unknown> | null;
  listSources(): MemorySourcePlugin<unknown>[];
}

export function normalizeActivityWatchBrowserEvent(
  input: ActivityWatchBrowserEventInput,
): MemoryEvent {
  return {
    id: `browser:${input.event.id}`,
    sourceType: 'activitywatch-browser',
    sourceRef: input.event.id,
    timestamp: input.event.timestamp,
    authorizationScopeId: input.scopeId,
    content: {
      url: input.event.data.url,
      title: input.event.data.title,
    },
    captureMetadata: {
      upstreamSource: 'activitywatch',
      checkpoint: input.event.timestamp,
    },
  };
}

export function deduplicateMemoryEvents(
  events: MemoryEvent[],
  createFingerprint: (event: MemoryEvent) => string = (event) => event.id,
): MemoryEvent[] {
  const seenFingerprints = new Set<string>();

  return events.filter((event) => {
    const fingerprint = createFingerprint(event);

    if (seenFingerprints.has(fingerprint)) {
      return false;
    }

    seenFingerprints.add(fingerprint);
    return true;
  });
}

export function createMemorySourceRegistry(
  plugins: MemorySourcePlugin<unknown>[],
): MemorySourceRegistry {
  const sources = new Map<string, MemorySourcePlugin<unknown>>();

  for (const plugin of plugins) {
    if (sources.has(plugin.sourceKey)) {
      throw new Error(
        `Memory source plugin is already registered for source key ${plugin.sourceKey}.`,
      );
    }

    sources.set(plugin.sourceKey, plugin);
  }

  return {
    getSource(sourceKey) {
      return sources.get(sourceKey) ?? null;
    },
    listSources() {
      return [...sources.values()];
    },
  };
}

export async function persistMemoryEvent(
  event: MemoryEvent,
  writer: OpenVikingMemoryEventWriter,
): Promise<void> {
  await writer.writeMemoryEvent(createOpenVikingMemoryEventRecord(event));
}
