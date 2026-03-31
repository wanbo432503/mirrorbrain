import {
  createOpenVikingMemoryEventRecord,
  type OpenVikingMemoryEventWriter,
} from '../../integrations/openviking-store/index.js';
import type { MemoryEvent } from '../../shared/types/index.js';

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

export async function persistMemoryEvent(
  event: MemoryEvent,
  writer: OpenVikingMemoryEventWriter,
): Promise<void> {
  await writer.writeMemoryEvent(createOpenVikingMemoryEventRecord(event));
}
