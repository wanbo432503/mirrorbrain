import type { SyncCheckpointStore } from '../../integrations/file-sync-checkpoint-store/index.js';
import type { OpenVikingMemoryEventWriter } from '../../integrations/openviking-store/index.js';
import {
  createShellHistoryMemorySourcePlugin,
  readShellHistory,
} from '../../integrations/shell-history-source/index.js';
import { createMemorySourceRegistry } from '../../modules/memory-capture/index.js';
import type { MirrorBrainConfig } from '../../shared/types/index.js';
import {
  runMemorySourceSyncOnce,
  type MemorySourceSyncAuthorizationDependency,
  type MemorySourceSyncResult,
} from '../memory-source-sync/index.js';

interface RunShellMemorySyncOnceInput {
  config: MirrorBrainConfig;
  now: string;
  scopeId: string;
  historyPath: string;
}

interface RunShellMemorySyncOnceDependencies {
  checkpointStore: SyncCheckpointStore;
  authorizeSourceSync?: MemorySourceSyncAuthorizationDependency;
  readShellHistory?: typeof readShellHistory;
  writeMemoryEvent: OpenVikingMemoryEventWriter['writeMemoryEvent'];
}

export type ShellMemorySyncResult = MemorySourceSyncResult;

export async function runShellMemorySyncOnce(
  input: RunShellMemorySyncOnceInput,
  dependencies: RunShellMemorySyncOnceDependencies,
): Promise<ShellMemorySyncResult> {
  return runMemorySourceSyncOnce(
    {
      config: input.config,
      now: input.now,
      scopeId: input.scopeId,
      sourceKey: `shell-history:${input.historyPath}`,
    },
    {
      checkpointStore: dependencies.checkpointStore,
      authorizeSourceSync: dependencies.authorizeSourceSync,
      sourceRegistry: createMemorySourceRegistry([
        createShellHistoryMemorySourcePlugin({
          historyPath: input.historyPath,
          readShellHistory: dependencies.readShellHistory,
        }),
      ]),
      writeMemoryEvent: dependencies.writeMemoryEvent,
    },
  );
}
