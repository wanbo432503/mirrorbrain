import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFileSyncCheckpointStore } from '../../src/integrations/file-sync-checkpoint-store/index.js';
import { runBrowserMemorySyncOnce } from '../../src/workflows/browser-memory-sync/index.js';
import { getMirrorBrainConfig } from '../../src/shared/config/index.js';

describe('browser memory sync integration', () => {
  it('persists the browser sync checkpoint across sync runs', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-browser-sync-'));
    const checkpointStore = createFileSyncCheckpointStore({
      workspaceDir,
    });
    const importedRecordIds: string[] = [];
    const config = getMirrorBrainConfig();

    await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T08:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
      },
      {
        checkpointStore,
        fetchBrowserEvents: async () => [
          {
            id: 'aw-event-1',
            timestamp: '2026-03-20T08:00:00.000Z',
            data: {
              url: 'https://example.com/tasks',
              title: 'Example Tasks',
            },
          },
        ],
        writeMemoryEvent: async (record) => {
          importedRecordIds.push(record.recordId);
        },
      },
    );

    const incrementalResult = await runBrowserMemorySyncOnce(
      {
        config,
        now: '2026-03-20T09:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        scopeId: 'scope-browser',
      },
      {
        checkpointStore,
        fetchBrowserEvents: async (input) => {
          expect(input.start).toBe('2026-03-20T08:00:00.000Z');
          expect(input.end).toBe('2026-03-20T09:00:00.000Z');

          return [];
        },
        writeMemoryEvent: async (record) => {
          importedRecordIds.push(record.recordId);
        },
      },
    );

    expect(importedRecordIds).toEqual(['browser:aw-event-1']);
    expect(incrementalResult).toEqual({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'incremental',
      importedCount: 0,
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
    });
  });
});
