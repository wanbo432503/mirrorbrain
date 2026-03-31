import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SyncCheckpoint {
  sourceKey: string;
  lastSyncedAt: string;
  updatedAt: string;
}

interface CreateFileSyncCheckpointStoreInput {
  workspaceDir: string;
}

interface GetSyncCheckpointPathInput {
  workspaceDir: string;
  sourceKey: string;
}

export interface SyncCheckpointStore {
  readCheckpoint(sourceKey: string): Promise<SyncCheckpoint | null>;
  writeCheckpoint(checkpoint: SyncCheckpoint): Promise<void>;
}

function toCheckpointFileName(sourceKey: string): string {
  return `${sourceKey.replace(/[^a-zA-Z0-9]+/g, '-')}.json`;
}

export function getSyncCheckpointPath(
  input: GetSyncCheckpointPathInput,
): string {
  return join(
    input.workspaceDir,
    'mirrorbrain',
    'state',
    'sync-checkpoints',
    toCheckpointFileName(input.sourceKey),
  );
}

export function createFileSyncCheckpointStore(
  input: CreateFileSyncCheckpointStoreInput,
): SyncCheckpointStore {
  return {
    async readCheckpoint(sourceKey) {
      const path = getSyncCheckpointPath({
        workspaceDir: input.workspaceDir,
        sourceKey,
      });

      try {
        const payload = await readFile(path, 'utf8');

        return JSON.parse(payload) as SyncCheckpoint;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }

        throw error;
      }
    },
    async writeCheckpoint(checkpoint) {
      const path = getSyncCheckpointPath({
        workspaceDir: input.workspaceDir,
        sourceKey: checkpoint.sourceKey,
      });

      await mkdir(join(input.workspaceDir, 'mirrorbrain', 'state', 'sync-checkpoints'), {
        recursive: true,
      });
      await writeFile(path, JSON.stringify(checkpoint, null, 2));
    },
  };
}
