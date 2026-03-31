import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createFileSyncCheckpointStore,
  getSyncCheckpointPath,
} from './index.js';

describe('file sync checkpoint store', () => {
  it('returns null when a checkpoint has not been persisted yet', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-checkpoint-'));
    const store = createFileSyncCheckpointStore({
      workspaceDir,
    });

    await expect(
      store.readCheckpoint('activitywatch-browser:aw-watcher-web-chrome'),
    ).resolves.toBeNull();
  });

  it('persists and reads back a browser sync checkpoint', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-checkpoint-'));
    const store = createFileSyncCheckpointStore({
      workspaceDir,
    });

    await store.writeCheckpoint({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
      updatedAt: '2026-03-20T09:00:05.000Z',
    });

    await expect(
      store.readCheckpoint('activitywatch-browser:aw-watcher-web-chrome'),
    ).resolves.toEqual({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
      updatedAt: '2026-03-20T09:00:05.000Z',
    });

    expect(
      getSyncCheckpointPath({
        workspaceDir,
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      }),
    ).toContain(
      'mirrorbrain/state/sync-checkpoints/activitywatch-browser-aw-watcher-web-chrome.json',
    );
  });
});
