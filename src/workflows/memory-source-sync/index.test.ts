import { describe, expect, it } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import { createMemorySourceRegistry } from '../../modules/memory-capture/index.js';
import type { MemoryEvent } from '../../shared/types/index.js';
import { runMemorySourceSyncOnce } from './index.js';

describe('memory source sync workflow', () => {
  it('runs a registered memory source plugin through planning, fetch, deduplication, and persistence', async () => {
    const persistedIds: string[] = [];
    const result = await runMemorySourceSyncOnce(
      {
        config: getMirrorBrainConfig(),
        now: '2026-03-20T08:00:00.000Z',
        scopeId: 'scope-browser',
        sourceKey: 'test-browser-source',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async () => undefined,
        },
        sourceRegistry: createMemorySourceRegistry([
          {
            sourceKey: 'test-browser-source',
            sourceCategory: 'browser',
            createSyncPlan: () => ({
              strategy: 'initial-backfill',
              start: '2026-03-19T08:00:00.000Z',
              end: '2026-03-20T08:00:00.000Z',
            }),
            fetchEvents: async () => [
              {
                id: 'browser:1',
                sourceType: 'activitywatch-browser',
                sourceRef: '1',
                timestamp: '2026-03-20T07:59:00.000Z',
                authorizationScopeId: 'scope-browser',
                content: {
                  url: 'https://example.com/tasks',
                  title: 'Example Tasks',
                },
                captureMetadata: {
                  upstreamSource: 'activitywatch',
                  checkpoint: '2026-03-20T07:59:00.000Z',
                },
              },
              {
                id: 'browser:2',
                sourceType: 'activitywatch-browser',
                sourceRef: '2',
                timestamp: '2026-03-20T07:59:00.000Z',
                authorizationScopeId: 'scope-browser',
                content: {
                  url: 'https://example.com/tasks',
                  title: 'Example Tasks',
                },
                captureMetadata: {
                  upstreamSource: 'activitywatch',
                  checkpoint: '2026-03-20T07:59:00.000Z',
                },
              },
            ],
            normalizeEvent: ({ event }: { scopeId: string; event: MemoryEvent }) => event,
            sanitizeEvents: (events: MemoryEvent[]) => events.slice(0, 1),
          },
        ]),
        writeMemoryEvent: async (record) => {
          persistedIds.push(record.recordId);
        },
      },
    );

    expect(persistedIds).toEqual(['browser:1']);
    expect(result).toEqual({
      sourceKey: 'test-browser-source',
      strategy: 'initial-backfill',
      importedCount: 1,
      lastSyncedAt: '2026-03-20T08:00:00.000Z',
      importedEvents: [
        {
          id: 'browser:1',
          sourceType: 'activitywatch-browser',
          sourceRef: '1',
          timestamp: '2026-03-20T07:59:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {
            title: 'Example Tasks',
            url: 'https://example.com/tasks',
          },
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-03-20T07:59:00.000Z',
          },
        },
      ],
    });
  });

  it('rejects sync requests for unregistered memory sources', async () => {
    await expect(
      runMemorySourceSyncOnce(
        {
          config: getMirrorBrainConfig(),
          now: '2026-03-20T08:00:00.000Z',
          scopeId: 'scope-browser',
          sourceKey: 'missing-source',
        },
        {
          checkpointStore: {
            readCheckpoint: async () => null,
            writeCheckpoint: async () => undefined,
          },
          sourceRegistry: createMemorySourceRegistry([]),
          writeMemoryEvent: async () => undefined,
        },
      ),
    ).rejects.toThrowError(
      'Memory source plugin is not registered for source key missing-source.',
    );
  });
});
