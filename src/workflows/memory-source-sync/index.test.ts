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

  it('rejects unauthorized source sync before fetching or persisting events', async () => {
    let fetched = false;
    let checkpointWritten = false;
    let persisted = false;

    await expect(
      runMemorySourceSyncOnce(
        {
          config: getMirrorBrainConfig(),
          now: '2026-03-20T08:00:00.000Z',
          scopeId: 'scope-browser',
          sourceKey: 'test-browser-source',
        },
        {
          checkpointStore: {
            readCheckpoint: async () => null,
            writeCheckpoint: async () => {
              checkpointWritten = true;
            },
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
              fetchEvents: async () => {
                fetched = true;
                return [];
              },
              normalizeEvent: ({ event }: { scopeId: string; event: MemoryEvent }) => event,
            },
          ]),
          authorizeSourceSync: async (source) => {
            expect(source).toEqual({
              sourceKey: 'test-browser-source',
              sourceCategory: 'browser',
              scopeId: 'scope-browser',
            });
            return false;
          },
          writeMemoryEvent: async () => {
            persisted = true;
          },
        },
      ),
    ).rejects.toThrowError(
      'Memory source test-browser-source is not authorized for scope scope-browser.',
    );

    expect(fetched).toBe(false);
    expect(persisted).toBe(false);
    expect(checkpointWritten).toBe(false);
  });

  it('checks authorization again before persistence so revoked sources do not advance checkpoints', async () => {
    const authorizationCalls: string[] = [];
    let persisted = false;
    let checkpointWritten = false;

    await expect(
      runMemorySourceSyncOnce(
        {
          config: getMirrorBrainConfig(),
          now: '2026-03-20T08:00:00.000Z',
          scopeId: 'scope-browser',
          sourceKey: 'test-browser-source',
        },
        {
          checkpointStore: {
            readCheckpoint: async () => null,
            writeCheckpoint: async () => {
              checkpointWritten = true;
            },
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
              ],
              normalizeEvent: ({ event }: { scopeId: string; event: MemoryEvent }) => event,
            },
          ]),
          authorizeSourceSync: async () => {
            authorizationCalls.push('called');
            return authorizationCalls.length === 1;
          },
          writeMemoryEvent: async () => {
            persisted = true;
          },
        },
      ),
    ).rejects.toThrowError(
      'Memory source test-browser-source is not authorized for scope scope-browser.',
    );

    expect(authorizationCalls).toEqual(['called', 'called']);
    expect(persisted).toBe(false);
    expect(checkpointWritten).toBe(false);
  });
});
