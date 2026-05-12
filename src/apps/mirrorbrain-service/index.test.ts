import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type { BrowserPageContentArtifact } from '../../integrations/browser-page-content/index.js';
import type {
  CandidateMemory,
  CandidateReviewSuggestion,
  MemoryEvent,
  MemoryQueryResult,
  ReviewedMemory,
} from '../../shared/types/index.js';
import type { SourceAuditEvent } from '../../modules/source-ledger-importer/index.js';
import { createMirrorBrainService, startMirrorBrainService } from './index.js';

function createCandidateMemoryFixture(input: {
  id: string;
  memoryEventIds: string[];
  reviewDate?: string;
}): CandidateMemory {
  return {
    id: input.id,
    memoryEventIds: input.memoryEventIds,
    title: 'Work on Example Tasks',
    summary: `${input.memoryEventIds.length} browser event connected to Work on Example Tasks across one site over about 1 minutes.`,
    theme: 'example / tasks',
    reviewDate: input.reviewDate ?? '2026-03-20',
    timeRange: {
      startAt: '2026-03-20T08:00:00.000Z',
      endAt: '2026-03-20T08:15:00.000Z',
    },
    sourceRefs: input.memoryEventIds.map((memoryEventId, index) => ({
      id: memoryEventId,
      sourceType: 'activitywatch-browser',
      timestamp: `2026-03-20T08:${String(index).padStart(2, '0')}:00.000Z`,
      title: `Source ${index + 1}`,
      url: `https://example.com/${memoryEventId}`,
    })),
    reviewState: 'pending',
  };
}

function createReviewedMemoryFixture(input?: {
  id?: string;
  candidateMemoryId?: string;
  decision?: ReviewedMemory['decision'];
}): ReviewedMemory {
  return {
    id: input?.id ?? 'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
    candidateMemoryId:
      input?.candidateMemoryId ??
      'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
    candidateTitle: 'Work on Example Tasks',
    candidateSummary:
      '1 browser event connected to Work on Example Tasks across one site over about 1 minutes.',
    candidateTheme: 'example / tasks',
    memoryEventIds: ['browser:aw-event-1'],
    reviewDate: '2026-03-20',
    decision: input?.decision ?? 'keep',
    reviewedAt: '2026-03-20T10:00:00.000Z',
  };
}

describe('mirrorbrain service', () => {
  const expectedOpenVikingBaseUrl = getMirrorBrainConfig().openViking.baseUrl;

  it('starts browser sync polling and stops it through the service lifecycle', () => {
    const stopPolling = vi.fn();
    const startBrowserSyncPolling = vi.fn(() => ({
      stop: stopPolling,
    }));

    const service = startMirrorBrainService(
      {
        config: getMirrorBrainConfig(),
      },
      {
        startBrowserSyncPolling,
      },
    );

    expect(startBrowserSyncPolling).toHaveBeenCalledTimes(1);
    expect(service.status).toBe('running');

    service.stop();

    expect(stopPolling).toHaveBeenCalledTimes(1);
    expect(service.status).toBe('stopped');
  });

  it('wires real browser sync execution into the polling lifecycle', async () => {
    const config = getMirrorBrainConfig();
    const checkpointStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
    };
    const createCheckpointStore = vi.fn(() => checkpointStore);
    const writeMemoryEvent = vi.fn(async () => undefined);
    const createMemoryEventWriter = vi.fn(() => ({
      writeMemoryEvent,
    }));
    const runBrowserMemorySyncOnce = vi.fn(async () => ({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'initial-backfill' as const,
      importedCount: 0,
      lastSyncedAt: '2026-03-20T10:00:00.000Z',
    }));
    const startBrowserSyncPolling = vi.fn((_input, dependencies) => {
      void dependencies.runSyncOnce();

      return {
        stop: vi.fn(),
      };
    });

    startMirrorBrainService(
      {
        config,
        workspaceDir: '/tmp/mirrorbrain-workspace',
        browserBucketId: 'aw-watcher-web-chrome',
        browserScopeId: 'scope-browser',
      },
      {
        createCheckpointStore,
        createMemoryEventWriter,
        runBrowserMemorySyncOnce,
        startBrowserSyncPolling,
        now: () => '2026-03-20T10:00:00.000Z',
      },
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(createCheckpointStore).toHaveBeenCalledWith({
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
    expect(createMemoryEventWriter).toHaveBeenCalledWith({
      config,
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
    expect(runBrowserMemorySyncOnce).toHaveBeenCalledWith(
      {
        config,
        now: '2026-03-20T10:00:00.000Z',
        bucketId: 'aw-watcher-web-chrome',
        initialBackfillStartAt: undefined,
        scopeId: 'scope-browser',
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        checkpointStore,
        authorizeSourceSync: expect.any(Function),
        authorizePageContentCapture: expect.any(Function),
        writeMemoryEvent,
      },
    );
  });

  it('auto-discovers the most recent ActivityWatch browser bucket for browser sync', async () => {
    const config = getMirrorBrainConfig();
    const checkpointStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
    };
    const createCheckpointStore = vi.fn(() => checkpointStore);
    const writeMemoryEvent = vi.fn(async () => undefined);
    const createMemoryEventWriter = vi.fn(() => ({
      writeMemoryEvent,
    }));
    const fetchActivityWatchBuckets = vi.fn(async () => [
      {
        id: 'aw-watcher-web-chrome',
        last_updated: '2026-04-03T07:13:14.690000+00:00',
        created: '2026-04-01T00:00:00.000000+00:00',
      },
      {
        id: 'aw-watcher-web-chrome_wanbodeMacBook-Pro-2.local',
        last_updated: '2026-04-13T03:53:00.000000+00:00',
        created: '2026-04-07T10:00:00.000000+00:00',
      },
    ]);
    const runBrowserMemorySyncOnce = vi.fn(async () => ({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome_wanbodeMacBook-Pro-2.local',
      strategy: 'initial-backfill' as const,
      importedCount: 0,
      lastSyncedAt: '2026-04-13T03:53:00.000Z',
      importedEvents: [],
    }));
    const startBrowserSyncPolling = vi.fn((_input, dependencies) => {
      void dependencies.runSyncOnce();

      return {
        stop: vi.fn(),
      };
    });

    startMirrorBrainService(
      {
        config,
        workspaceDir: '/tmp/mirrorbrain-workspace',
        browserScopeId: 'scope-browser',
      },
      {
        createCheckpointStore,
        createMemoryEventWriter,
        fetchActivityWatchBuckets,
        runBrowserMemorySyncOnce,
        startBrowserSyncPolling,
        now: () => '2026-04-13T03:53:51.918Z',
      },
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchActivityWatchBuckets).toHaveBeenCalledWith({
      baseUrl: config.activityWatch.baseUrl,
    });
    expect(runBrowserMemorySyncOnce).toHaveBeenCalledWith(
      {
        config,
        now: '2026-04-13T03:53:51.918Z',
        bucketId: 'aw-watcher-web-chrome_wanbodeMacBook-Pro-2.local',
        initialBackfillStartAt: '2026-04-07T10:00:00.000000+00:00',
        scopeId: 'scope-browser',
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        checkpointStore,
        authorizeSourceSync: expect.any(Function),
        authorizePageContentCapture: expect.any(Function),
        writeMemoryEvent,
      },
    );
  });

  it('wires shell history sync execution into the runtime service when a history path is configured', async () => {
    const config = getMirrorBrainConfig();
    const checkpointStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
    };
    const createCheckpointStore = vi.fn(() => checkpointStore);
    const writeMemoryEvent = vi.fn(async () => undefined);
    const createMemoryEventWriter = vi.fn(() => ({
      writeMemoryEvent,
    }));
    const runShellMemorySyncOnce = vi.fn(async () => ({
      sourceKey: 'shell-history:/tmp/.zsh_history',
      strategy: 'initial-backfill' as const,
      importedCount: 0,
      lastSyncedAt: '2026-03-20T10:00:00.000Z',
    }));

    const service = startMirrorBrainService(
      {
        config,
        workspaceDir: '/tmp/mirrorbrain-workspace',
        shellHistoryPath: '/tmp/.zsh_history',
        shellScopeId: 'scope-shell',
      },
      {
        createCheckpointStore,
        createMemoryEventWriter,
        runShellMemorySyncOnce,
        startBrowserSyncPolling: vi.fn(() => ({
          stop: vi.fn(),
        })),
        now: () => '2026-03-20T10:00:00.000Z',
      },
    );

    await service.syncShellMemory();

    expect(createCheckpointStore).toHaveBeenCalledWith({
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
    expect(createMemoryEventWriter).toHaveBeenCalledWith({
      config,
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
    expect(runShellMemorySyncOnce).toHaveBeenCalledWith(
      {
        config,
        now: '2026-03-20T10:00:00.000Z',
        historyPath: '/tmp/.zsh_history',
        scopeId: 'scope-shell',
      },
      {
        checkpointStore,
        authorizeSourceSync: expect.any(Function),
        writeMemoryEvent,
      },
    );
  });

  it('wires revoked runtime authorization scopes into browser sync execution', async () => {
    const config = getMirrorBrainConfig();
    const checkpointStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
    };
    const runBrowserMemorySyncOnce = vi.fn(async (_input, dependencies) => {
      const isAuthorized = await dependencies.authorizeSourceSync?.({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        sourceCategory: 'browser',
        scopeId: 'scope-browser',
      });

      if (!isAuthorized) {
        throw new Error('browser sync was rejected by runtime authorization');
      }

      return {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'initial-backfill' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      };
    });
    const service = startMirrorBrainService(
      {
        config,
        browserBucketId: 'aw-watcher-web-chrome',
        browserScopeId: 'scope-browser',
      },
      {
        createCheckpointStore: vi.fn(() => checkpointStore),
        createMemoryEventWriter: vi.fn(() => ({
          writeMemoryEvent: vi.fn(async () => undefined),
        })),
        getAuthorizationScope: vi.fn(async () => ({
          id: 'scope-browser',
          sourceCategory: 'browser' as const,
          revokedAt: '2026-03-20T09:59:00.000Z',
        })),
        runBrowserMemorySyncOnce,
        startBrowserSyncPolling: vi.fn(() => ({
          stop: vi.fn(),
        })),
        now: () => '2026-03-20T10:00:00.000Z',
      },
    );

    await expect(service.syncBrowserMemory()).rejects.toThrowError(
      'browser sync was rejected by runtime authorization',
    );
  });

  it('keeps page content capture authorization independent from browser source sync authorization', async () => {
    const config = getMirrorBrainConfig();
    const checkpointStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
    };
    const pageAuthorizationDecisions: boolean[] = [];
    const runBrowserMemorySyncOnce = vi.fn(async (_input, dependencies) => {
      const sourceAuthorized = await dependencies.authorizeSourceSync?.({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        sourceCategory: 'browser',
        scopeId: 'scope-browser',
      });
      const pageAuthorized = await dependencies.authorizePageContentCapture?.({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        scopeId: 'scope-browser',
        url: 'https://example.com/private',
      });

      pageAuthorizationDecisions.push(Boolean(pageAuthorized));

      if (!sourceAuthorized) {
        throw new Error('browser sync was rejected by runtime authorization');
      }

      return {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'initial-backfill' as const,
        importedCount: 1,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      };
    });
    const service = startMirrorBrainService(
      {
        config,
        browserBucketId: 'aw-watcher-web-chrome',
        browserScopeId: 'scope-browser',
      },
      {
        createCheckpointStore: vi.fn(() => checkpointStore),
        createMemoryEventWriter: vi.fn(() => ({
          writeMemoryEvent: vi.fn(async () => undefined),
        })),
        getAuthorizationScope: vi.fn(async () => ({
          id: 'scope-browser',
          sourceCategory: 'browser' as const,
          revokedAt: null,
        })),
        runBrowserMemorySyncOnce,
        startBrowserSyncPolling: vi.fn(() => ({
          stop: vi.fn(),
        })),
        now: () => '2026-03-20T10:00:00.000Z',
      },
    );

    await expect(service.syncBrowserMemory()).resolves.toMatchObject({
      importedCount: 1,
    });
    expect(pageAuthorizationDecisions).toEqual([false]);
  });

  it('rejects shell sync when no shell history path is configured', async () => {
    const service = startMirrorBrainService(
      {
        config: getMirrorBrainConfig(),
      },
      {
        startBrowserSyncPolling: vi.fn(() => ({
          stop: vi.fn(),
        })),
      },
    );

    await expect(service.syncShellMemory()).rejects.toThrowError(
      'Shell history sync is not configured for this MirrorBrain runtime.',
    );
  });

  it('creates an openclaw-facing service contract that queries OpenViking through the configured base URL and forwards retrieval input', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const queryMemory = vi.fn(
      async (): Promise<MemoryQueryResult> => ({
        timeRange: {
          startAt: '2026-03-20T00:00:00.000Z',
          endAt: '2026-03-20T23:59:59.999Z',
        },
        items: [],
      }),
    );
    const listKnowledge = vi.fn(async () => []);
    const listSkillDrafts = vi.fn(async () => []);

    const api = createMirrorBrainService(
      {
        service,
      },
      {
        queryMemory,
        listKnowledge,
        listSkillDrafts,
      },
    );

    await api.queryMemory({
      query: 'What did I work on yesterday?',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      sourceTypes: ['browser'],
    });
    await api.listKnowledge();
    await api.listSkillDrafts();

    expect(queryMemory).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
      query: 'What did I work on yesterday?',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      sourceTypes: ['browser'],
    });
    expect(listKnowledge).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
    });
    expect(listSkillDrafts).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
    });
    expect(api.service).toBe(service);
  });

  it('imports Phase 4 source ledgers through the service facade and exposes operational source state', async () => {
    const memoryEvent: MemoryEvent = {
      id: 'ledger:browser:event-1',
      sourceType: 'browser',
      sourceRef: 'browser:chrome-main:event-1',
      timestamp: '2026-05-12T10:00:00.000Z',
      authorizationScopeId: 'scope-source-ledger',
      content: {
        title: 'Phase 4 Design',
        summary: 'Phase 4 source ledgers.',
        contentKind: 'browser-page',
        sourceSpecific: {},
      },
      captureMetadata: {
        upstreamSource: 'source-ledger:browser',
        checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
      },
    };
    const auditEvent: SourceAuditEvent = {
      id: 'source-audit:entry-1',
      eventType: 'entry-imported',
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      lineNumber: 1,
      occurredAt: '2026-05-12T10:31:00.000Z',
      severity: 'info',
      message: 'Imported browser ledger entry.',
    };
    const stateStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
      writeSourceAuditEvent: vi.fn(async () => undefined),
      listSourceAuditEvents: vi.fn(async () => [auditEvent]),
      listSourceInstanceSummaries: vi.fn(async () => [
        {
          sourceKind: 'browser' as const,
          sourceInstanceId: 'chrome-main',
          lifecycleStatus: 'enabled' as const,
          recorderStatus: 'unknown' as const,
          importedCount: 1,
          skippedCount: 0,
        },
      ]),
    };
    const writeMemoryEvent = vi.fn(async () => undefined);
    const importSourceLedgers = vi.fn(async (_input, dependencies) => {
      await dependencies.writeMemoryEvent(memoryEvent);
      await dependencies.writeSourceAuditEvent(auditEvent);
      await dependencies.writeCheckpoint({
        ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
        nextLineNumber: 2,
        updatedAt: '2026-05-12T10:31:00.000Z',
      });

      return {
        importedCount: 1,
        skippedCount: 0,
        scannedLedgerCount: 1,
        changedLedgerCount: 1,
        ledgerResults: [],
      };
    });
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        createSourceLedgerStateStore: vi.fn(() => stateStore),
        createMemoryEventWriter: vi.fn(() => ({
          writeMemoryEvent,
        })),
        importSourceLedgers,
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
        now: () => '2026-05-12T10:31:00.000Z',
      },
    );

    await expect(api.importSourceLedgers()).resolves.toMatchObject({
      importedCount: 1,
      skippedCount: 0,
      scannedLedgerCount: 1,
    });
    await expect(api.listSourceAuditEvents({ sourceKind: 'browser' })).resolves.toEqual([
      auditEvent,
    ]);
    await expect(api.listSourceInstanceSummaries()).resolves.toEqual([
      expect.objectContaining({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      }),
    ]);

    expect(importSourceLedgers).toHaveBeenCalledWith(
      {
        authorizationScopeId: 'scope-source-ledger',
        importedAt: '2026-05-12T10:31:00.000Z',
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      expect.objectContaining({
        readCheckpoint: stateStore.readCheckpoint,
        writeCheckpoint: stateStore.writeCheckpoint,
        writeSourceAuditEvent: stateStore.writeSourceAuditEvent,
        writeMemoryEvent: expect.any(Function),
      }),
    );
    expect(writeMemoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        recordType: 'memory-event',
        recordId: 'ledger:browser:event-1',
        payload: memoryEvent,
      }),
    );
    expect(stateStore.listSourceAuditEvents).toHaveBeenCalledWith({
      sourceKind: 'browser',
    });
  });

  it('returns only the most recent imported browser events in explicit sync responses', async () => {
    const importedEvents: MemoryEvent[] = Array.from({ length: 60 }, (_, index) => {
      const minute = String(index).padStart(2, '0');
      const timestamp = `2026-03-20T10:${minute}:00.000Z`;

      return {
        id: `browser:${index + 1}`,
        sourceType: 'activitywatch-browser',
        sourceRef: String(index + 1),
        timestamp,
        authorizationScopeId: 'scope-browser',
        content: {
          url: `https://example.com/${index + 1}`,
          title: `Event ${index + 1}`,
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: timestamp,
        },
      };
    });
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: importedEvents.length,
        lastSyncedAt: '2026-03-20T10:59:00.000Z',
        importedEvents,
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:59:00.000Z',
        importedEvents: [],
      })),
      stop: vi.fn(),
    };

    const api = createMirrorBrainService(
      {
        service,
      },
      {
        listMemoryEvents: vi.fn(async () => ({
      items: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    })),
        buildBrowserThemeNarratives: vi.fn(() => []),
        publishMemoryNarrative: vi.fn(async () => ({
          sourcePath: '/tmp/memory-narrative.json',
          rootUri: 'viking://resources/memory-narrative',
        })),
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    const result = await api.syncBrowserMemory();

    expect(result.importedCount).toBe(60);
    expect(result.importedEvents).toHaveLength(50);
    expect(result.importedEvents?.[0]?.id).toBe('browser:60');
    expect(result.importedEvents?.at(-1)?.id).toBe('browser:11');
  });

  it('falls back to workspace memory events when OpenViking memory reads fail', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
        importedEvents: [],
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
        importedEvents: [],
      })),
      stop: vi.fn(),
    };
    const listMemoryEvents = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const listWorkspaceMemoryEvents = vi.fn(async () => [
      {
        id: 'browser:aw-event-1',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/tasks',
          title: 'Example Tasks',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:00:00.000Z',
        },
      },
    ]);

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listMemoryEvents,
        listWorkspaceMemoryEvents,
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    await expect(api.listMemoryEvents()).resolves.toEqual({
      items: [
        {
          id: 'browser:aw-event-1',
          sourceType: 'activitywatch-browser',
          sourceRef: 'aw-event-1',
          timestamp: '2026-03-20T08:00:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {
            url: 'https://example.com/tasks',
            title: 'Example Tasks',
          },
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-03-20T08:00:00.000Z',
          },
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    });
    expect(listWorkspaceMemoryEvents).toHaveBeenCalledWith({
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
  });

  it('builds daily candidates from workspace-cached raw memory history', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
        importedEvents: [],
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
        importedEvents: [],
      })),
      stop: vi.fn(),
    };
    const rawMemoryEvents = [
      {
        id: 'browser:aw-event-1',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-04-12T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/tasks',
          title: 'Tasks',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-04-12T08:00:00.000Z',
        },
      },
    ];
    const listRawWorkspaceMemoryEvents = vi.fn(async () => rawMemoryEvents);
    const createCandidateMemories = vi.fn(() => [
      createCandidateMemoryFixture({
        id: 'candidate:2026-04-12:activitywatch-browser:example-com:tasks',
        memoryEventIds: ['browser:aw-event-1'],
        reviewDate: '2026-04-12',
      }),
    ]);

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listMemoryEvents: vi.fn(async () => ({
      items: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    })),
        listRawWorkspaceMemoryEvents,
        createCandidateMemories,
        publishCandidateMemory: vi.fn(async () => ({
          sourcePath: '/tmp/candidate.json',
          rootUri: 'viking://resources/candidate',
        })),
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    await api.createDailyCandidateMemories('2026-04-12', 'Asia/Shanghai');

    expect(listRawWorkspaceMemoryEvents).toHaveBeenCalledWith({
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
    expect(createCandidateMemories).toHaveBeenCalledWith({
      reviewDate: '2026-04-12',
      reviewTimeZone: 'Asia/Shanghai',
      memoryEvents: rawMemoryEvents,
    });
  });

  it('syncs browser memory before building daily candidates', async () => {
    const syncBrowserMemory = vi.fn(async () => ({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'incremental' as const,
      importedCount: 3,
      lastSyncedAt: '2026-04-15T00:00:00.000Z',
      importedEvents: [],
    }));
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory,
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
        importedEvents: [],
      })),
      stop: vi.fn(),
    };
    const callOrder: string[] = [];
    const listRawWorkspaceMemoryEvents = vi.fn(async () => {
      callOrder.push('listRawWorkspaceMemoryEvents');
      return [
        {
          id: 'browser:aw-event-1',
          sourceType: 'activitywatch-browser',
          sourceRef: 'aw-event-1',
          timestamp: '2026-04-14T08:00:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {
            url: 'https://example.com/tasks',
            title: 'Tasks',
          },
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-04-14T08:00:00.000Z',
          },
        },
      ];
    });
    const createCandidateMemories = vi.fn(({ memoryEvents }) => {
      callOrder.push('createCandidateMemories');
      return [
        createCandidateMemoryFixture({
          id: 'candidate:2026-04-14:activitywatch-browser:example-com:tasks',
          memoryEventIds: memoryEvents.map((event: { id: string }) => event.id),
          reviewDate: '2026-04-14',
        }),
      ];
    });

    syncBrowserMemory.mockImplementation(async () => {
      callOrder.push('syncBrowserMemory');
      return {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 3,
        lastSyncedAt: '2026-04-15T00:00:00.000Z',
        importedEvents: [],
      };
    });

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listMemoryEvents: vi.fn(async () => ({
      items: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    })),
        listRawWorkspaceMemoryEvents,
        createCandidateMemories,
        publishCandidateMemory: vi.fn(async () => ({
          sourcePath: '/tmp/candidate.json',
          rootUri: 'viking://resources/candidate',
        })),
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    await api.createDailyCandidateMemories('2026-04-14', 'Asia/Shanghai');

    expect(syncBrowserMemory).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual([
      'syncBrowserMemory',
      'listRawWorkspaceMemoryEvents',
      'createCandidateMemories',
    ]);
  });

  it('persists knowledge and skill artifacts through the configured OpenViking writers', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const publishKnowledge = vi.fn(async () => ({
      sourcePath: '/tmp/knowledge.md',
      rootUri: 'viking://resources/mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
    }));
    const publishSkill = vi.fn(async () => ({
      sourcePath: '/tmp/skill-draft.md',
      uri: 'viking://resources/mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
    }));

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        publishKnowledge,
        publishSkill,
      },
    );

    await api.publishKnowledge({
      id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
      draftState: 'draft',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
    });
    await api.publishSkillDraft({
      id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
      executionSafetyMetadata: {
        requiresConfirmation: true,
      },
    });

    expect(publishKnowledge).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact: {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    });
    expect(publishSkill).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact: {
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    });
  });

  it('falls back to workspace copies when OpenViking listings are empty', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-service-'));
    mkdirSync(join(workspaceDir, 'mirrorbrain', 'knowledge'), {
      recursive: true,
    });
    mkdirSync(join(workspaceDir, 'mirrorbrain', 'skill-drafts'), {
      recursive: true,
    });

    writeFileSync(
      join(
        workspaceDir,
        'mirrorbrain',
        'knowledge',
        'knowledge-draft:workspace.md',
      ),
      [
        '# knowledge-draft:workspace',
        '',
        '- artifactType: daily-review-draft',
        '- draftState: draft',
        '- topicKey: workspace-topic',
        '- title: Workspace knowledge',
        '- summary: Workspace summary',
        '- version: 1',
        '- isCurrentBest: false',
        '- supersedesKnowledgeId: ',
        '- updatedAt: 2026-04-29T10:00:00.000Z',
        '- reviewedAt: 2026-04-29T09:00:00.000Z',
        '- recencyLabel: 2026-04-29',
        '',
        '## Body',
        'Workspace body',
        '',
        '## Source Reviewed Memories',
        '- reviewed:workspace',
        '',
        '## Derived Knowledge Artifacts',
        '',
        '## Provenance Refs',
        '- reviewed-memory:reviewed:workspace',
      ].join('\n'),
    );
    writeFileSync(
      join(
        workspaceDir,
        'mirrorbrain',
        'skill-drafts',
        'skill-draft:workspace.md',
      ),
      [
        '# skill-draft:workspace',
        '',
        '- approvalState: draft',
        '- requiresConfirmation: true',
        '',
        '## Workflow Evidence',
        '- reviewed:workspace',
      ].join('\n'),
    );

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-04-29T10:00:00.000Z',
          })),
          syncShellMemory: vi.fn(async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-04-29T10:00:00.000Z',
          })),
          stop: vi.fn(),
        },
        workspaceDir,
      },
      {
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    await expect(api.listKnowledge()).resolves.toEqual([
      expect.objectContaining({
        id: 'knowledge-draft:workspace',
        title: 'Workspace knowledge',
        body: 'Workspace body',
        sourceReviewedMemoryIds: ['reviewed:workspace'],
      }),
    ]);
    await expect(api.listSkillDrafts()).resolves.toEqual([
      expect.objectContaining({
        id: 'skill-draft:workspace',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:workspace'],
      }),
    ]);
  });

  it('keeps approved workspace knowledge visible when a stale deletion marker exists for the same id', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-service-'));
    const artifactId = 'topic-knowledge:workspace-approved:v1';
    mkdirSync(join(workspaceDir, 'mirrorbrain', 'knowledge'), {
      recursive: true,
    });
    mkdirSync(join(workspaceDir, 'mirrorbrain', 'deleted-artifacts', 'knowledge'), {
      recursive: true,
    });
    writeFileSync(
      join(workspaceDir, 'mirrorbrain', 'knowledge', `${artifactId}.md`),
      [
        `# ${artifactId}`,
        '',
        '- artifactType: topic-knowledge',
        '- draftState: published',
        '- topicKey: workspace-approved',
        '- title: Workspace approved knowledge',
        '- summary: Workspace approved summary',
        '- version: 1',
        '- isCurrentBest: true',
        '- supersedesKnowledgeId: ',
        '- updatedAt: 2026-05-10T10:00:00.000Z',
        '- reviewedAt: 2026-05-10T09:00:00.000Z',
        '- recencyLabel: 2026-05-10',
        '',
        '## Body',
        'Workspace approved body',
        '',
        '## Source Reviewed Memories',
        '- reviewed:workspace-approved',
        '',
        '## Derived Knowledge Artifacts',
        '- knowledge-draft:workspace-approved',
        '',
        '## Provenance Refs',
        '- reviewed-memory:reviewed:workspace-approved',
      ].join('\n'),
    );
    writeFileSync(
      join(
        workspaceDir,
        'mirrorbrain',
        'deleted-artifacts',
        'knowledge',
        `${encodeURIComponent(artifactId)}.json`,
      ),
      JSON.stringify({ artifactId, deletedAt: '2026-05-09T10:00:00.000Z' }),
    );

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-05-10T10:00:00.000Z',
          })),
          syncShellMemory: vi.fn(async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-05-10T10:00:00.000Z',
          })),
          stop: vi.fn(),
        },
        workspaceDir,
      },
      {
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    await expect(api.listKnowledge()).resolves.toEqual([
      expect.objectContaining({
        id: artifactId,
        draftState: 'published',
        title: 'Workspace approved knowledge',
        body: 'Workspace approved body',
      }),
    ]);
  });

  it('deletes persisted knowledge and skill artifacts and filters them from later reads', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-service-'));
    mkdirSync(join(workspaceDir, 'mirrorbrain', 'knowledge'), {
      recursive: true,
    });
    mkdirSync(join(workspaceDir, 'mirrorbrain', 'skill-drafts'), {
      recursive: true,
    });

    const knowledgeArtifact = {
      id: 'knowledge-draft:workspace-delete',
      draftState: 'draft' as const,
      artifactType: 'daily-review-draft' as const,
      title: 'Workspace knowledge',
      summary: 'Workspace summary',
      body: 'Workspace body',
      sourceReviewedMemoryIds: ['reviewed:workspace'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-29T10:00:00.000Z',
      reviewedAt: '2026-04-29T09:00:00.000Z',
      recencyLabel: '2026-04-29',
      provenanceRefs: [{ kind: 'reviewed-memory' as const, id: 'reviewed:workspace' }],
    };
    const skillArtifact = {
      id: 'skill-draft:workspace-delete',
      approvalState: 'draft' as const,
      workflowEvidenceRefs: ['reviewed:workspace'],
      executionSafetyMetadata: { requiresConfirmation: true },
      updatedAt: '2026-04-29T10:00:00.000Z',
    };

    writeFileSync(
      join(workspaceDir, 'mirrorbrain', 'knowledge', `${knowledgeArtifact.id}.md`),
      [
        `# ${knowledgeArtifact.id}`,
        '',
        '- artifactType: daily-review-draft',
        '- draftState: draft',
        '- topicKey: ',
        `- title: ${knowledgeArtifact.title}`,
        `- summary: ${knowledgeArtifact.summary}`,
        '- version: 1',
        '- isCurrentBest: false',
        '- supersedesKnowledgeId: ',
        `- updatedAt: ${knowledgeArtifact.updatedAt}`,
        `- reviewedAt: ${knowledgeArtifact.reviewedAt}`,
        '- recencyLabel: 2026-04-29',
        '',
        '## Body',
        knowledgeArtifact.body,
        '',
        '## Source Reviewed Memories',
        '- reviewed:workspace',
        '',
        '## Derived Knowledge Artifacts',
        '',
        '## Provenance Refs',
        '- reviewed-memory:reviewed:workspace',
      ].join('\n'),
    );
    writeFileSync(
      join(workspaceDir, 'mirrorbrain', 'skill-drafts', `${skillArtifact.id}.md`),
      [
        `# ${skillArtifact.id}`,
        '',
        '- approvalState: draft',
        '- requiresConfirmation: true',
        '',
        '## Workflow Evidence',
        '- reviewed:workspace',
      ].join('\n'),
    );

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-04-29T10:00:00.000Z',
          })),
          syncShellMemory: vi.fn(async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-04-29T10:00:00.000Z',
          })),
          stop: vi.fn(),
        },
        workspaceDir,
      },
      {
        listKnowledge: vi.fn(async () => [knowledgeArtifact]),
        listSkillDrafts: vi.fn(async () => [skillArtifact]),
      },
    );

    await api.deleteKnowledgeArtifact(knowledgeArtifact.id);
    await api.deleteSkillArtifact(skillArtifact.id);

    await expect(
      access(join(workspaceDir, 'mirrorbrain', 'knowledge', `${knowledgeArtifact.id}.md`)),
    ).rejects.toThrow();
    await expect(
      access(join(workspaceDir, 'mirrorbrain', 'skill-drafts', `${skillArtifact.id}.md`)),
    ).rejects.toThrow();
    await expect(api.listKnowledge()).resolves.toEqual([]);
    await expect(api.listSkillDrafts()).resolves.toEqual([]);
  });

  it('generates and publishes knowledge and skill artifacts from reviewed memories', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const reviewedMemories = [createReviewedMemoryFixture()];
    const generateKnowledge = vi.fn(() => ({
      id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
      draftState: 'draft' as const,
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
    }));
    const generateSkillDraft = vi.fn(() => ({
      id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
      approvalState: 'draft' as const,
      workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
      executionSafetyMetadata: {
        requiresConfirmation: true,
      },
    }));
    const publishKnowledge = vi.fn(async () => ({
      sourcePath: '/tmp/knowledge.md',
      rootUri: 'viking://resources/mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
    }));
    const publishSkill = vi.fn(async () => ({
      sourcePath: '/tmp/skill-draft.md',
      uri: 'viking://resources/mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
    }));

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        generateKnowledge,
        generateSkillDraft,
        publishKnowledge,
        publishSkill,
      },
    );

    await api.generateKnowledgeFromReviewedMemories(reviewedMemories);
    await api.generateSkillDraftFromReviewedMemories(reviewedMemories);

    expect(generateKnowledge).toHaveBeenCalledWith({
      reviewedMemories,
    });
    expect(generateSkillDraft).toHaveBeenCalledWith(reviewedMemories);
    expect(publishKnowledge).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact: {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    });
    expect(publishSkill).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact: {
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    });
  });

  it('reviews a candidate memory through the service contract', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const reviewMemory = vi.fn((_candidate, _input) =>
      createReviewedMemoryFixture(),
    );
    const publishReviewedMemory = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain-workspace/reviewed.json',
      rootUri:
        'viking://resources/mirrorbrain/reviewed-memories/reviewed:candidate:browser:aw-event-1.json',
    }));

    const api = createMirrorBrainService(
      {
        service,
      },
      {
        reviewMemory,
        publishReviewedMemory,
      },
    );

    await expect(
      api.reviewCandidateMemory(
        {
          id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          memoryEventIds: ['browser:aw-event-1'],
          title: 'Docs Example Com / guides',
          summary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
          theme: 'docs.example.com / guides',
          reviewDate: '2026-03-20',
          timeRange: {
            startAt: '2026-03-20T08:00:00.000Z',
            endAt: '2026-03-20T08:00:00.000Z',
          },
          reviewState: 'pending',
        },
        {
          decision: 'keep',
          reviewedAt: '2026-03-20T10:00:00.000Z',
        },
      ),
    ).resolves.toEqual(createReviewedMemoryFixture());

    expect(reviewMemory).toHaveBeenCalledWith(
      {
        id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        memoryEventIds: ['browser:aw-event-1'],
        title: 'Docs Example Com / guides',
        summary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
        theme: 'docs.example.com / guides',
        reviewDate: '2026-03-20',
        timeRange: {
          startAt: '2026-03-20T08:00:00.000Z',
          endAt: '2026-03-20T08:00:00.000Z',
        },
        reviewState: 'pending',
      },
      {
        decision: 'keep',
        reviewedAt: '2026-03-20T10:00:00.000Z',
      },
    );
    expect(publishReviewedMemory).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
      workspaceDir: process.cwd(),
      artifact: createReviewedMemoryFixture(),
    });
  });

  it('creates daily candidate memory streams through the service contract', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const memoryEvents = [
      {
        id: 'browser:aw-event-1',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://docs.example.com/guides/mirrorbrain',
          title: 'MirrorBrain Guide',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:00:00.000Z',
        },
      },
      {
        id: 'browser:aw-event-2',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-2',
        timestamp: '2026-03-20T08:15:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://github.com/example/mirrorbrain/issues/42',
          title: 'Fix review workflow',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:15:00.000Z',
        },
      },
    ];
    const listRawWorkspaceMemoryEvents = vi.fn(async () => memoryEvents);
    const createCandidateMemories = vi.fn(() => [
      createCandidateMemoryFixture({
        id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        memoryEventIds: ['browser:aw-event-1'],
      }),
      createCandidateMemoryFixture({
        id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
        memoryEventIds: ['browser:aw-event-2'],
      }),
    ]);
    const publishCandidateMemory = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain-workspace/candidate.json',
      rootUri:
        'viking://resources/mirrorbrain/candidate-memories/candidate:2026-03-20:activitywatch-browser:docs-example-com:guides.json',
    }));

    const api = createMirrorBrainService(
      {
        service,
      },
      {
        listRawWorkspaceMemoryEvents,
        createCandidateMemories,
        publishCandidateMemory,
      },
    );

    await expect(
      api.createDailyCandidateMemories('2026-03-20', 'Asia/Shanghai'),
    ).resolves.toEqual([
      createCandidateMemoryFixture({
        id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        memoryEventIds: ['browser:aw-event-1'],
      }),
      createCandidateMemoryFixture({
        id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
        memoryEventIds: ['browser:aw-event-2'],
      }),
    ]);

    expect(listRawWorkspaceMemoryEvents).toHaveBeenCalledWith({
      workspaceDir: process.cwd(),
    });
    expect(createCandidateMemories).toHaveBeenCalledWith({
      reviewDate: '2026-03-20',
      reviewTimeZone: 'Asia/Shanghai',
      memoryEvents,
    });
    expect(publishCandidateMemory).toHaveBeenCalledTimes(2);
  });

  it('enriches review candidate inputs with browser page text from stored browser page content', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-04-14T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-04-14T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const memoryEvents: MemoryEvent[] = [
      {
        id: 'browser:aw-event-1',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-04-14T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://docs.example.com/reference/cache-invalidation',
          title: 'Cache Invalidation Guide',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-04-14T08:00:00.000Z',
        },
      },
    ];
    const loadBrowserPageContentArtifactFromWorkspace = vi.fn(
      async (): Promise<BrowserPageContentArtifact | null> => ({
        id: 'browser-page:url-cache',
        url: 'https://docs.example.com/reference/cache-invalidation',
        title: 'Cache Invalidation Guide',
        text: 'MirrorBrain cache invalidation task. Fix stale cache bug.',
        accessTimes: ['2026-04-14T08:00:00.000Z'],
        latestAccessedAt: '2026-04-14T08:00:00.000Z',
      }),
    );
    const createCandidateMemories = vi.fn(() => [
      createCandidateMemoryFixture({
        id: 'candidate:2026-04-14:activitywatch-browser:cache-invalidation',
        memoryEventIds: ['browser:aw-event-1'],
        reviewDate: '2026-04-14',
      }),
    ]);

    const api = createMirrorBrainService(
      {
        service,
      },
      {
        listCandidateMemories: vi.fn(async () => []),
        listWorkspaceCandidateMemories: vi.fn(async () => []),
        listRawWorkspaceMemoryEvents: vi.fn(async () => memoryEvents),
        createCandidateMemories,
        publishCandidateMemory: vi.fn(async () => ({
          sourcePath: '/tmp/mirrorbrain-workspace/candidate.json',
          rootUri: 'viking://resources/mirrorbrain/candidate.json',
        })),
        loadBrowserPageContentArtifactFromWorkspace,
      },
    );

    await api.createDailyCandidateMemories('2026-04-14', 'Asia/Shanghai');

    expect(loadBrowserPageContentArtifactFromWorkspace).toHaveBeenCalledWith({
      workspaceDir: process.cwd(),
      url: 'https://docs.example.com/reference/cache-invalidation',
    });
    expect(createCandidateMemories).toHaveBeenCalledWith({
      reviewDate: '2026-04-14',
      reviewTimeZone: 'Asia/Shanghai',
      memoryEvents: [
        expect.objectContaining({
          content: expect.objectContaining({
            pageText: 'MirrorBrain cache invalidation task. Fix stale cache bug.',
            pageTitle: 'Cache Invalidation Guide',
          }),
        }),
      ],
    });
  });

  it('lists candidate memories filtered by review date', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };

    const allCandidates = [
      createCandidateMemoryFixture({
        id: 'candidate:2026-04-12:activitywatch-browser:example-com:task-1',
        memoryEventIds: ['browser:aw-event-1'],
        reviewDate: '2026-04-12',
      }),
      createCandidateMemoryFixture({
        id: 'candidate:2026-04-12:activitywatch-browser:example-com:task-2',
        memoryEventIds: ['browser:aw-event-2'],
        reviewDate: '2026-04-12',
      }),
      createCandidateMemoryFixture({
        id: 'candidate:2026-04-13:activitywatch-browser:example-com:task-3',
        memoryEventIds: ['browser:aw-event-3'],
        reviewDate: '2026-04-13',
      }),
    ];

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listMemoryEvents: vi.fn(async () => ({
      items: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    })),
        listCandidateMemories: vi.fn(async () => allCandidates),
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    const candidatesForDate = await api.listCandidateMemoriesByDate('2026-04-12');

    expect(candidatesForDate).toHaveLength(2);
    expect(candidatesForDate[0]?.reviewDate).toBe('2026-04-12');
    expect(candidatesForDate[1]?.reviewDate).toBe('2026-04-12');
  });

  it('returns existing candidates after sync when no new browser events were imported for the review date', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-04-12T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-04-12T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };

    const existingCandidates = [
      createCandidateMemoryFixture({
        id: 'candidate:2026-04-12:activitywatch-browser:example-com:existing-task',
        memoryEventIds: ['browser:aw-event-1'],
        reviewDate: '2026-04-12',
      }),
    ];

    const listCandidateMemories = vi.fn(async () => existingCandidates);
    const listRawWorkspaceMemoryEvents = vi.fn(async () => []);
    const createCandidateMemories = vi.fn(() => []);

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listMemoryEvents: vi.fn(async () => ({
      items: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    })),
        listCandidateMemories,
        listRawWorkspaceMemoryEvents,
        createCandidateMemories,
        publishCandidateMemory: vi.fn(async () => ({
          sourcePath: '/tmp/candidate.json',
          rootUri: 'viking://resources/candidate',
        })),
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    const result = await api.createDailyCandidateMemories('2026-04-12', 'Asia/Shanghai');

    expect(result).toEqual(existingCandidates);
    expect(service.syncBrowserMemory).toHaveBeenCalledTimes(1);

    expect(listRawWorkspaceMemoryEvents).not.toHaveBeenCalled();
    expect(createCandidateMemories).not.toHaveBeenCalled();
  });

  it('regenerates existing daily candidates after browser sync imports newer events', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 1,
        lastSyncedAt: '2026-05-10T12:05:00.000Z',
        importedEvents: [
          {
            id: 'browser:late-event',
            sourceType: 'activitywatch-browser',
            sourceRef: 'late-event',
            timestamp: '2026-05-10T12:05:00.000Z',
            authorizationScopeId: 'scope-browser',
            content: {
              url: 'https://example.com/new-url',
              title: 'New URL after existing candidates',
            },
            captureMetadata: {
              upstreamSource: 'activitywatch',
              checkpoint: '2026-05-10T12:05:00.000Z',
            },
          },
        ],
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-05-10T12:05:00.000Z',
      })),
      stop: vi.fn(),
    };

    const existingCandidate = createCandidateMemoryFixture({
      id: 'candidate:2026-05-10:activitywatch-browser:example-com:old-task',
      memoryEventIds: ['browser:old-event'],
      reviewDate: '2026-05-10',
    });
    existingCandidate.timeRange = {
      startAt: '2026-05-09T16:00:00.000Z',
      endAt: '2026-05-10T08:05:00.000Z',
    };

    const memoryEvents: MemoryEvent[] = [
      {
        id: 'browser:old-event',
        sourceType: 'activitywatch-browser',
        sourceRef: 'old-event',
        timestamp: '2026-05-10T08:05:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/old-url',
          title: 'Old URL',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-05-10T08:05:00.000Z',
        },
      },
      {
        id: 'browser:late-event',
        sourceType: 'activitywatch-browser',
        sourceRef: 'late-event',
        timestamp: '2026-05-10T12:05:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/new-url',
          title: 'New URL after existing candidates',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-05-10T12:05:00.000Z',
        },
      },
    ];
    const regeneratedCandidates = [
      createCandidateMemoryFixture({
        id: 'candidate:2026-05-10:activitywatch-browser:example-com:new-task',
        memoryEventIds: ['browser:old-event', 'browser:late-event'],
        reviewDate: '2026-05-10',
      }),
    ];
    regeneratedCandidates[0].timeRange = {
      startAt: '2026-05-10T08:05:00.000Z',
      endAt: '2026-05-10T12:05:00.000Z',
    };

    const listCandidateMemories = vi.fn(async () => [existingCandidate]);
    const listRawWorkspaceMemoryEvents = vi.fn(async () => memoryEvents);
    const createCandidateMemories = vi.fn(() => regeneratedCandidates);
    const publishCandidateMemory = vi.fn(async () => ({
      sourcePath: '/tmp/candidate.json',
      rootUri: 'viking://resources/candidate',
    }));

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listMemoryEvents: vi.fn(async () => ({
          items: [],
          pagination: {
            total: 0,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          },
        })),
        listCandidateMemories,
        listRawWorkspaceMemoryEvents,
        createCandidateMemories,
        publishCandidateMemory,
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    const result = await api.createDailyCandidateMemories('2026-05-10', 'Asia/Shanghai');

    expect(result).toEqual(regeneratedCandidates);
    expect(service.syncBrowserMemory).toHaveBeenCalledTimes(1);
    expect(listRawWorkspaceMemoryEvents).toHaveBeenCalledTimes(1);
    expect(createCandidateMemories).toHaveBeenCalledWith({
      reviewDate: '2026-05-10',
      reviewTimeZone: 'Asia/Shanghai',
      memoryEvents,
    });
    expect(publishCandidateMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: regeneratedCandidates[0],
      }),
    );
  });

  it('excludes memory events already used by published knowledge from regenerated candidates', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 1,
        lastSyncedAt: '2026-05-10T12:05:00.000Z',
        importedEvents: [
          {
            id: 'browser:new-event',
            sourceType: 'activitywatch-browser',
            sourceRef: 'new-event',
            timestamp: '2026-05-10T12:05:00.000Z',
            authorizationScopeId: 'scope-browser',
            content: {
              url: 'https://example.com/new-url',
              title: 'New URL',
            },
            captureMetadata: {
              upstreamSource: 'activitywatch',
              checkpoint: '2026-05-10T12:05:00.000Z',
            },
          },
        ],
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-05-10T12:05:00.000Z',
      })),
      stop: vi.fn(),
    };
    const memoryEvents: MemoryEvent[] = [
      {
        id: 'browser:consumed-event',
        sourceType: 'activitywatch-browser',
        sourceRef: 'consumed-event',
        timestamp: '2026-05-10T08:05:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/already-used',
          title: 'Already used',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-05-10T08:05:00.000Z',
        },
      },
      {
        id: 'browser:new-event',
        sourceType: 'activitywatch-browser',
        sourceRef: 'new-event',
        timestamp: '2026-05-10T12:05:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/new-url',
          title: 'New URL',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-05-10T12:05:00.000Z',
        },
      },
      {
        id: 'browser:revisited-consumed-url',
        sourceType: 'activitywatch-browser',
        sourceRef: 'revisited-consumed-url',
        timestamp: '2026-05-10T12:10:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/already-used',
          title: 'Already used revisited',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-05-10T12:10:00.000Z',
        },
      },
    ];
    const publishedKnowledge = {
      id: 'topic-knowledge:used:v1',
      artifactType: 'topic-knowledge' as const,
      draftState: 'published' as const,
      sourceReviewedMemoryIds: ['reviewed:candidate:used'],
    };
    const reviewedMemory = {
      id: 'reviewed:candidate:used',
      candidateMemoryId: 'candidate:used',
      candidateTitle: 'Already used candidate',
      candidateSummary: 'Already used summary',
      candidateTheme: 'used',
      memoryEventIds: ['browser:consumed-event'],
      candidateSourceRefs: [
        {
          id: 'browser:consumed-event',
          sourceType: 'activitywatch-browser',
          timestamp: '2026-05-10T08:05:00.000Z',
          url: 'https://example.com/already-used',
        },
      ],
      reviewDate: '2026-05-10',
      decision: 'keep' as const,
      reviewedAt: '2026-05-10T09:00:00.000Z',
    };
    const createCandidateMemories = vi.fn(() => [
      createCandidateMemoryFixture({
        id: 'candidate:2026-05-10:activitywatch-browser:example-com:new-url',
        memoryEventIds: ['browser:new-event'],
        reviewDate: '2026-05-10',
      }),
    ]);

    const api = createMirrorBrainService(
      {
        service,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listCandidateMemories: vi.fn(async () => [
          createCandidateMemoryFixture({
            id: 'candidate:2026-05-10:activitywatch-browser:example-com:old',
            memoryEventIds: ['browser:consumed-event'],
            reviewDate: '2026-05-10',
          }),
        ]),
        listRawWorkspaceMemoryEvents: vi.fn(async () => memoryEvents),
        listKnowledge: vi.fn(async () => [publishedKnowledge]),
        listReviewedMemories: vi.fn(async () => [reviewedMemory]),
        createCandidateMemories,
        publishCandidateMemory: vi.fn(async () => ({
          sourcePath: '/tmp/candidate.json',
          rootUri: 'viking://resources/candidate',
        })),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    await api.createDailyCandidateMemories('2026-05-10', 'Asia/Shanghai');

    expect(createCandidateMemories).toHaveBeenCalledWith({
      reviewDate: '2026-05-10',
      reviewTimeZone: 'Asia/Shanghai',
      memoryEvents: [memoryEvents[1]],
    });
  });

  it('returns candidate review suggestions without publishing review artifacts', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const candidates = [
      createCandidateMemoryFixture({
        id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        memoryEventIds: ['browser:aw-event-1', 'browser:aw-event-2'],
      }),
    ];
    const suggestCandidateReviews = vi.fn(
      (): CandidateReviewSuggestion[] => [
        {
          candidateMemoryId:
            'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          recommendation: 'keep',
          confidenceScore: 0.8,
          priorityScore: 2,
          rationale:
            'This daily stream has repeated activity and is a strong keep candidate.',
        },
      ],
    );
    const publishReviewedMemory = vi.fn();

    const api = createMirrorBrainService(
      {
        service,
      },
      {
        suggestCandidateReviews,
        publishReviewedMemory,
      },
    );

    await expect(api.suggestCandidateReviews(candidates)).resolves.toEqual([
      {
        candidateMemoryId:
          'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        recommendation: 'keep',
        confidenceScore: 0.8,
        priorityScore: 2,
        rationale:
          'This daily stream has repeated activity and is a strong keep candidate.',
      },
    ]);

    expect(suggestCandidateReviews).toHaveBeenCalledWith(candidates);
    expect(publishReviewedMemory).not.toHaveBeenCalled();
  });

  it('persists candidate memories sequentially to avoid OpenViking resource lock contention', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const memoryEvents = [
      {
        id: 'browser:aw-event-1',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://docs.example.com/guides/mirrorbrain',
          title: 'MirrorBrain Guide',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:00:00.000Z',
        },
      },
    ];
    const artifacts = [
      createCandidateMemoryFixture({
        id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        memoryEventIds: ['browser:aw-event-1'],
      }),
      createCandidateMemoryFixture({
        id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
        memoryEventIds: ['browser:aw-event-2'],
      }),
    ];
    const createCandidateMemories = vi.fn(() => artifacts);
    const publishOrder: string[] = [];
    let releaseFirstPublish: (() => void) | undefined;
    const publishCandidateMemory = vi
      .fn()
      .mockImplementationOnce(
        async ({ artifact }: { artifact: { id: string } }) =>
          await new Promise<{ sourcePath: string; rootUri: string }>((resolve) => {
            publishOrder.push(`start:${artifact.id}`);
            releaseFirstPublish = () => {
              publishOrder.push(`end:${artifact.id}`);
              resolve({
                sourcePath: '/tmp/mirrorbrain-workspace/candidate-1.json',
                rootUri: 'viking://resources/mirrorbrain/candidate-1.json',
              });
            };
          }),
      )
      .mockImplementationOnce(async ({ artifact }: { artifact: { id: string } }) => {
        publishOrder.push(`start:${artifact.id}`);
        publishOrder.push(`end:${artifact.id}`);
        return {
          sourcePath: '/tmp/mirrorbrain-workspace/candidate-2.json',
          rootUri: 'viking://resources/mirrorbrain/candidate-2.json',
        };
      });

    const api = createMirrorBrainService(
      {
        service,
      },
      {
        listCandidateMemories: vi.fn(async () => []),
        listRawWorkspaceMemoryEvents: vi.fn(async () => memoryEvents),
        listKnowledge: vi.fn(async () => []),
        listReviewedMemories: vi.fn(async () => []),
        createCandidateMemories,
        publishCandidateMemory,
        loadBrowserPageContentArtifactFromWorkspace: vi.fn(async () => null),
      },
    );

    const createPromise = api.createDailyCandidateMemories('2026-03-20', 'Asia/Shanghai');

    for (let attempt = 0; attempt < 10 && publishOrder.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(publishOrder).toEqual([
      'start:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
    ]);

    releaseFirstPublish?.();
    await createPromise;

    expect(publishOrder).toEqual([
      'start:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
      'end:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
      'start:candidate:2026-03-20:activitywatch-browser:github-com:example',
      'end:candidate:2026-03-20:activitywatch-browser:github-com:example',
    ]);
  });

  describe('deleteCandidateMemory', () => {
    it('should delete existing candidate memory file', async () => {
      const service = {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        syncBrowserMemory: vi.fn(async () => ({
          sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        syncShellMemory: vi.fn(async () => ({
          sourceKey: 'shell-history:/tmp/.zsh_history',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        stop: vi.fn(),
      };

      const workspaceDir = '/tmp/mirrorbrain-test-workspace';
      const candidateId = 'candidate:test-delete';
      const candidateDir = join(workspaceDir, 'mirrorbrain', 'candidate-memories');
      const filePath = join(candidateDir, `${candidateId}.json`);

      // Create test candidate file
      await mkdir(candidateDir, { recursive: true });
      await writeFile(filePath, JSON.stringify({ id: candidateId }));

      const api = createMirrorBrainService(
        {
          service,
          workspaceDir,
        },
        {
          listMemoryEvents: vi.fn(async () => ({
            items: [],
            pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          })),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
        },
      );

      // Delete candidate
      await api.deleteCandidateMemory(candidateId);

      // Verify file is deleted
      await expect(access(filePath)).rejects.toThrow();

      // Cleanup
      await rm(workspaceDir, { recursive: true, force: true });
    });

    it('deletes candidate memory from workspace and OpenViking resources', async () => {
      const service = {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        syncBrowserMemory: vi.fn(async () => ({
          sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        syncShellMemory: vi.fn(async () => ({
          sourceKey: 'shell-history:/tmp/.zsh_history',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        stop: vi.fn(),
      };
      const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-candidate-delete-'));
      const candidateId = 'candidate:delete-both-stores';
      const candidateDir = join(workspaceDir, 'mirrorbrain', 'candidate-memories');
      const filePath = join(candidateDir, `${candidateId}.json`);
      const deleteCandidateMemoryResource = vi.fn(async () => undefined);

      await mkdir(candidateDir, { recursive: true });
      await writeFile(filePath, JSON.stringify({ id: candidateId }));

      const api = createMirrorBrainService(
        {
          service,
          workspaceDir,
        },
        {
          listMemoryEvents: vi.fn(async () => ({
            items: [],
            pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          })),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
          deleteCandidateMemoryResource,
        },
      );

      await api.deleteCandidateMemory(candidateId);

      await expect(access(filePath)).rejects.toThrow();
      expect(deleteCandidateMemoryResource).toHaveBeenCalledWith({
        baseUrl: service.config.openViking.baseUrl,
        candidateMemoryId: candidateId,
      });

      await rm(workspaceDir, { recursive: true, force: true });
    });

    it('should succeed if file already deleted (idempotent)', async () => {
      const service = {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        syncBrowserMemory: vi.fn(async () => ({
          sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        syncShellMemory: vi.fn(async () => ({
          sourceKey: 'shell-history:/tmp/.zsh_history',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        stop: vi.fn(),
      };

      const workspaceDir = '/tmp/mirrorbrain-test-workspace';
      const candidateId = 'candidate:non-existent';
      const deleteCandidateMemoryResource = vi.fn(async () => undefined);

      const api = createMirrorBrainService(
        {
          service,
          workspaceDir,
        },
        {
          listMemoryEvents: vi.fn(async () => ({
            items: [],
            pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          })),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
          deleteCandidateMemoryResource,
        },
      );

      // Delete non-existent candidate - should succeed without error
      await expect(api.deleteCandidateMemory(candidateId)).resolves.toBeUndefined();
      expect(deleteCandidateMemoryResource).toHaveBeenCalledWith({
        baseUrl: service.config.openViking.baseUrl,
        candidateMemoryId: candidateId,
      });

      // Cleanup
      await rm(workspaceDir, { recursive: true, force: true });
    });

    it('should reject invalid candidate ID format', async () => {
      const service = {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        syncBrowserMemory: vi.fn(async () => ({
          sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        syncShellMemory: vi.fn(async () => ({
          sourceKey: 'shell-history:/tmp/.zsh_history',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        stop: vi.fn(),
      };

      const api = createMirrorBrainService(
        {
          service,
        },
        {
          listMemoryEvents: vi.fn(async () => ({
            items: [],
            pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          })),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
        },
      );

      const invalidId = 'invalid-id-format';

      await expect(api.deleteCandidateMemory(invalidId)).rejects.toThrow(
        'Invalid candidate memory ID format: invalid-id-format',
      );
    });

    it('should reject path traversal in candidate ID', async () => {
      const service = {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        syncBrowserMemory: vi.fn(async () => ({
          sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        syncShellMemory: vi.fn(async () => ({
          sourceKey: 'shell-history:/tmp/.zsh_history',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: '2026-03-20T10:00:00.000Z',
          importedEvents: [],
        })),
        stop: vi.fn(),
      };

      const api = createMirrorBrainService(
        {
          service,
        },
        {
          listMemoryEvents: vi.fn(async () => ({
            items: [],
            pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          })),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
        },
      );

      const maliciousId = 'candidate:../secret-file';

      await expect(api.deleteCandidateMemory(maliciousId)).rejects.toThrow(
        'Invalid candidate memory ID format: candidate:../secret-file',
      );
    });
  });
});
