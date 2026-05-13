import { describe, expect, it } from 'vitest';

import { createQmdWorkspaceMemoryEventRecord } from '../../integrations/qmd-workspace-store/index.js';
import { getMirrorBrainConfig } from '../../shared/config/index.js';
import { runShellMemorySyncOnce } from './index.js';

describe('shell memory sync workflow', () => {
  it('runs an initial shell-history sync and persists normalized shell events', async () => {
    const config = getMirrorBrainConfig();
    const persistedRecordIds: string[] = [];
    const checkpoints: Array<{
      sourceKey: string;
      lastSyncedAt: string;
      updatedAt: string;
    }> = [];

    const result = await runShellMemorySyncOnce(
      {
        config,
        now: '2026-03-20T08:00:00.000Z',
        scopeId: 'scope-shell',
        historyPath: '/tmp/.zsh_history',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => null,
          writeCheckpoint: async (checkpoint) => {
            checkpoints.push(checkpoint);
          },
        },
        readShellHistory: async (input) => {
          expect(input).toEqual({
            historyPath: '/tmp/.zsh_history',
            start: '2026-03-19T08:00:00.000Z',
            end: '2026-03-20T08:00:00.000Z',
          });

          return [
            {
              id: 'shell-history:1773974100:git-status',
              timestamp: '2026-03-20T07:45:00.000Z',
              command: 'git status',
            },
            {
              id: 'shell-history:1773974160:pnpm-vitest-run',
              timestamp: '2026-03-20T07:50:00.000Z',
              command: 'pnpm vitest run',
            },
          ];
        },
        writeMemoryEvent: async (record) => {
          persistedRecordIds.push(record.recordId);
        },
      },
    );

    expect(persistedRecordIds).toEqual([
      createQmdWorkspaceMemoryEventRecord({
        id: 'shell:shell-history:1773974100:git-status',
        sourceType: 'shell-history',
        sourceRef: 'shell-history:1773974100:git-status',
        timestamp: '2026-03-20T07:45:00.000Z',
        authorizationScopeId: 'scope-shell',
        content: {
          command: 'git status',
          commandName: 'git',
        },
        captureMetadata: {
          upstreamSource: 'shell-history',
          checkpoint: '2026-03-20T07:45:00.000Z',
        },
      }).recordId,
      createQmdWorkspaceMemoryEventRecord({
        id: 'shell:shell-history:1773974160:pnpm-vitest-run',
        sourceType: 'shell-history',
        sourceRef: 'shell-history:1773974160:pnpm-vitest-run',
        timestamp: '2026-03-20T07:50:00.000Z',
        authorizationScopeId: 'scope-shell',
        content: {
          command: 'pnpm vitest run',
          commandName: 'pnpm',
        },
        captureMetadata: {
          upstreamSource: 'shell-history',
          checkpoint: '2026-03-20T07:50:00.000Z',
        },
      }).recordId,
    ]);
    expect(checkpoints).toEqual([
      {
        sourceKey: 'shell-history:/tmp/.zsh_history',
        lastSyncedAt: '2026-03-20T08:00:00.000Z',
        updatedAt: '2026-03-20T08:00:00.000Z',
      },
    ]);
    expect(result).toEqual({
      sourceKey: 'shell-history:/tmp/.zsh_history',
      strategy: 'initial-backfill',
      importedCount: 2,
      lastSyncedAt: '2026-03-20T08:00:00.000Z',
      importedEvents: [
        {
          id: 'shell:shell-history:1773974100:git-status',
          sourceType: 'shell-history',
          sourceRef: 'shell-history:1773974100:git-status',
          timestamp: '2026-03-20T07:45:00.000Z',
          authorizationScopeId: 'scope-shell',
          content: {
            command: 'git status',
            commandName: 'git',
          },
          captureMetadata: {
            upstreamSource: 'shell-history',
            checkpoint: '2026-03-20T07:45:00.000Z',
          },
        },
        {
          id: 'shell:shell-history:1773974160:pnpm-vitest-run',
          sourceType: 'shell-history',
          sourceRef: 'shell-history:1773974160:pnpm-vitest-run',
          timestamp: '2026-03-20T07:50:00.000Z',
          authorizationScopeId: 'scope-shell',
          content: {
            command: 'pnpm vitest run',
            commandName: 'pnpm',
          },
          captureMetadata: {
            upstreamSource: 'shell-history',
            checkpoint: '2026-03-20T07:50:00.000Z',
          },
        },
      ],
    });
  });

  it('uses the stored checkpoint for incremental shell sync', async () => {
    const config = getMirrorBrainConfig();
    const checkpoints: Array<{
      sourceKey: string;
      lastSyncedAt: string;
      updatedAt: string;
    }> = [];

    const result = await runShellMemorySyncOnce(
      {
        config,
        now: '2026-03-20T09:00:00.000Z',
        scopeId: 'scope-shell',
        historyPath: '/tmp/.zsh_history',
      },
      {
        checkpointStore: {
          readCheckpoint: async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            lastSyncedAt: '2026-03-20T08:00:00.000Z',
            updatedAt: '2026-03-20T08:00:01.000Z',
          }),
          writeCheckpoint: async (checkpoint) => {
            checkpoints.push(checkpoint);
          },
        },
        readShellHistory: async (input) => {
          expect(input).toEqual({
            historyPath: '/tmp/.zsh_history',
            start: '2026-03-20T08:00:00.000Z',
            end: '2026-03-20T09:00:00.000Z',
          });

          return [];
        },
        writeMemoryEvent: async () => undefined,
      },
    );

    expect(checkpoints).toEqual([
      {
        sourceKey: 'shell-history:/tmp/.zsh_history',
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
      },
    ]);
    expect(result).toEqual({
      sourceKey: 'shell-history:/tmp/.zsh_history',
      strategy: 'incremental',
      importedCount: 0,
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
      importedEvents: [],
    });
  });

  it('passes shell source authorization policy to the generic sync workflow', async () => {
    let shellHistoryRead = false;
    let persisted = false;

    await expect(
      runShellMemorySyncOnce(
        {
          config: getMirrorBrainConfig(),
          now: '2026-03-20T08:00:00.000Z',
          scopeId: 'scope-shell',
          historyPath: '/tmp/.zsh_history',
        },
        {
          checkpointStore: {
            readCheckpoint: async () => null,
            writeCheckpoint: async () => undefined,
          },
          readShellHistory: async () => {
            shellHistoryRead = true;
            return [];
          },
          authorizeSourceSync: async (source) => {
            expect(source).toEqual({
              sourceKey: 'shell-history:/tmp/.zsh_history',
              sourceCategory: 'shell',
              scopeId: 'scope-shell',
            });
            return false;
          },
          writeMemoryEvent: async () => {
            persisted = true;
          },
        },
      ),
    ).rejects.toThrowError(
      'Memory source shell-history:/tmp/.zsh_history is not authorized for scope scope-shell.',
    );

    expect(shellHistoryRead).toBe(false);
    expect(persisted).toBe(false);
  });
});
