import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import type { ReviewedWorkSession } from '../../modules/project-work-session/index.js';
import type { WorkSessionCandidate } from '../../workflows/work-session-analysis/index.js';
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

  it('refuses to default runtime storage to the source directory', () => {
    const previousWorkspaceDir = process.env.MIRRORBRAIN_WORKSPACE_DIR;
    delete process.env.MIRRORBRAIN_WORKSPACE_DIR;

    try {
      expect(() =>
        startMirrorBrainService(
          {
            config: getMirrorBrainConfig(),
          },
          {
            startBrowserSyncPolling: vi.fn(),
            startSourceLedgerImportPolling: vi.fn(),
          },
        ),
      ).toThrow('workspaceDir is required');

      expect(() =>
        createMirrorBrainService({
          service: {
            status: 'running',
            config: getMirrorBrainConfig(),
            syncBrowserMemory: vi.fn(),
            syncShellMemory: vi.fn(),
            stop: vi.fn(),
          },
        }),
      ).toThrow('workspaceDir is required');
    } finally {
      if (previousWorkspaceDir === undefined) {
        delete process.env.MIRRORBRAIN_WORKSPACE_DIR;
      } else {
        process.env.MIRRORBRAIN_WORKSPACE_DIR = previousWorkspaceDir;
      }
    }
  });

  it('starts ledger import polling without starting legacy browser sync polling by default', () => {
    const stopPolling = vi.fn();
    const stopSourceImportPolling = vi.fn();
    const startBrowserSyncPolling = vi.fn(() => ({
      stop: stopPolling,
    }));
    const startSourceLedgerImportPolling = vi.fn(() => ({
      stop: stopSourceImportPolling,
    }));

    const service = startMirrorBrainService(
      {
        config: getMirrorBrainConfig(),
      },
      {
        startBrowserSyncPolling,
        startSourceLedgerImportPolling,
      },
    );

    expect(startBrowserSyncPolling).not.toHaveBeenCalled();
    expect(startSourceLedgerImportPolling).toHaveBeenCalledTimes(1);
    expect(service.status).toBe('running');

    service.stop();

    expect(stopPolling).not.toHaveBeenCalled();
    expect(stopSourceImportPolling).toHaveBeenCalledTimes(1);
    expect(service.status).toBe('stopped');
  });

  it('wires source ledger import execution into the polling lifecycle', async () => {
    const config = getMirrorBrainConfig();
    const stateStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
      writeSourceAuditEvent: vi.fn(async () => undefined),
      listSourceAuditEvents: vi.fn(async () => []),
      listSourceInstanceSummaries: vi.fn(async () => []),
      writeSourceInstanceConfig: vi.fn(async () => undefined),
      listSourceInstanceConfigs: vi.fn(async () => []),
    };
    const writeMemoryEvent = vi.fn(async () => undefined);
    const importSourceLedgers = vi.fn(async () => ({
      importedCount: 0,
      skippedCount: 0,
      scannedLedgerCount: 0,
      changedLedgerCount: 0,
      ledgerResults: [],
    }));
    const startSourceLedgerImportPolling = vi.fn((_input, dependencies) => {
      void dependencies.runImportOnce();

      return {
        stop: vi.fn(),
      };
    });

    startMirrorBrainService(
      {
        config,
        workspaceDir: '/tmp/mirrorbrain-source-ledger-runtime',
      },
      {
        startBrowserSyncPolling: vi.fn(() => ({
          stop: vi.fn(),
        })),
        startSourceLedgerImportPolling,
        createSourceLedgerStateStore: vi.fn(() => stateStore),
        createMemoryEventWriter: vi.fn(() => ({
          writeMemoryEvent,
        })),
        importSourceLedgers,
        now: () => '2026-05-12T10:31:00.000Z',
      },
    );

    await Promise.resolve();

    expect(importSourceLedgers).toHaveBeenCalledWith(
      {
        authorizationScopeId: 'scope-source-ledger',
        importedAt: '2026-05-12T10:31:00.000Z',
        workspaceDir: '/tmp/mirrorbrain-source-ledger-runtime',
      },
      expect.objectContaining({
        readCheckpoint: stateStore.readCheckpoint,
        writeCheckpoint: stateStore.writeCheckpoint,
        writeSourceAuditEvent: stateStore.writeSourceAuditEvent,
        writeMemoryEvent: expect.any(Function),
      }),
    );
  });

  it('captures latest ActivityWatch browser records before manual source import', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-manual-source-import-'));
    const captureBrowserLedgerRecords = vi.fn(async () => [
      {
        occurredAt: '2026-05-12T08:05:00.000Z',
        capturedAt: '2026-05-12T08:06:00.000Z',
        payload: {
          id: 'aw-event-latest',
          title: 'Latest browser page',
          url: 'https://example.com/latest',
          page_content: 'Latest browser page\n\nhttps://example.com/latest',
        },
      },
    ]);
    const callOrder: string[] = [];
    const importSourceLedgers = vi.fn(async () => {
      callOrder.push('import');
      return {
        importedCount: 1,
        skippedCount: 0,
        scannedLedgerCount: 1,
        changedLedgerCount: 1,
        ledgerResults: [],
      };
    });
    captureBrowserLedgerRecords.mockImplementation(async () => {
      callOrder.push('capture');
      return [
        {
          occurredAt: '2026-05-12T08:05:00.000Z',
          capturedAt: '2026-05-12T08:06:00.000Z',
          payload: {
            id: 'aw-event-latest',
            title: 'Latest browser page',
            url: 'https://example.com/latest',
            page_content: 'Latest browser page\n\nhttps://example.com/latest',
          },
        },
      ];
    });
    const service = createMirrorBrainService(
      {
        workspaceDir,
        browserBucketId: 'aw-watcher-web-chrome',
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        captureBrowserLedgerRecords,
        importSourceLedgers,
        now: () => '2026-05-12T08:06:00.000Z',
      },
    );

    const result = await service.importSourceLedgers();

    expect(result.importedCount).toBe(1);
    expect(callOrder).toEqual(['capture', 'import']);
    expect(captureBrowserLedgerRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        config: getMirrorBrainConfig(),
        now: '2026-05-12T08:06:00.000Z',
        scopeId: 'scope-browser',
      }),
      expect.objectContaining({
        checkpointStore: expect.any(Object),
      }),
    );

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('still scans source ledgers when manual browser refresh fails', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-manual-source-import-'));
    const captureBrowserLedgerRecords = vi.fn(async () => {
      throw new Error('ActivityWatch is unavailable');
    });
    const importSourceLedgers = vi.fn(async () => ({
      importedCount: 1,
      skippedCount: 0,
      scannedLedgerCount: 1,
      changedLedgerCount: 1,
      ledgerResults: [
        {
          ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
          importedCount: 1,
          skippedCount: 0,
          checkpoint: {
            ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
            nextLineNumber: 2,
            updatedAt: '2026-05-12T08:06:00.000Z',
          },
        },
      ],
    }));
    const service = createMirrorBrainService(
      {
        workspaceDir,
        browserBucketId: 'aw-watcher-web-chrome',
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        captureBrowserLedgerRecords,
        importSourceLedgers,
        now: () => '2026-05-12T08:06:00.000Z',
      },
    );

    await expect(service.importSourceLedgers()).resolves.toMatchObject({
      importedCount: 1,
      scannedLedgerCount: 1,
    });
    expect(captureBrowserLedgerRecords).toHaveBeenCalledTimes(1);
    expect(importSourceLedgers).toHaveBeenCalledTimes(1);

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('starts built-in source ledger recorder supervision for enabled runtime sources', async () => {
    const stopSourceImportPolling = vi.fn();
    const stopRecorderSupervisor = vi.fn(async () => undefined);
    const stateStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
      writeSourceAuditEvent: vi.fn(async () => undefined),
      listSourceAuditEvents: vi.fn(async () => []),
      listSourceInstanceSummaries: vi.fn(async () => []),
      writeSourceInstanceConfig: vi.fn(async () => undefined),
      listSourceInstanceConfigs: vi.fn(async () => [
        {
          sourceKind: 'shell' as const,
          sourceInstanceId: 'shell-main',
          enabled: false,
          updatedAt: '2026-05-12T12:00:00.000Z',
          updatedBy: 'user',
        },
      ]),
    };
    const startSourceLedgerImportPolling = vi.fn(() => ({
      stop: stopSourceImportPolling,
    }));
    const startSourceRecorderSupervisor = vi.fn(async () => ({
      stop: stopRecorderSupervisor,
    }));
    const captureSourceRecord = vi.fn(async () => null);

    const service = startMirrorBrainService(
      {
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        createSourceLedgerStateStore: vi.fn(() => stateStore),
        startSourceLedgerImportPolling,
        startSourceRecorderSupervisor,
        captureSourceRecord,
        now: () => '2026-05-12T12:00:00.000Z',
      },
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(startSourceRecorderSupervisor).toHaveBeenCalledWith(
      {
        intervalMs: 60 * 1000,
        workspaceDir: '/tmp/mirrorbrain-workspace',
        now: expect.any(Function),
        sources: [
          { sourceKind: 'browser', sourceInstanceId: 'chrome-main', enabled: true },
          {
            sourceKind: 'file-activity',
            sourceInstanceId: 'filesystem-main',
            enabled: true,
          },
          { sourceKind: 'screenshot', sourceInstanceId: 'desktop-main', enabled: true },
          {
            sourceKind: 'audio-recording',
            sourceInstanceId: 'recording-main',
            enabled: true,
          },
          { sourceKind: 'shell', sourceInstanceId: 'shell-main', enabled: false },
          {
            sourceKind: 'agent',
            sourceInstanceId: 'agent-main',
            enabled: true,
          },
        ],
      },
      {
        captureSourceRecord: expect.any(Function),
        writeSourceAuditEvent: stateStore.writeSourceAuditEvent,
      },
    );
    expect(startSourceLedgerImportPolling).toHaveBeenCalledWith(
      {
        schedule: {
          scanIntervalMs: 60 * 1000,
        },
      },
      {
        runImportOnce: expect.any(Function),
      },
    );
    const [, supervisorDependencies] =
      startSourceRecorderSupervisor.mock.calls[0] as unknown as [
        unknown,
        {
          captureSourceRecord(input: {
            sourceKind: 'browser';
            sourceInstanceId: string;
            enabled: boolean;
          }): Promise<unknown>;
        },
      ];

    await expect(
      supervisorDependencies.captureSourceRecord({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: true,
      }),
    ).resolves.toBeNull();
    expect(captureSourceRecord).toHaveBeenCalledWith({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: true,
    });

    service.stop();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stopRecorderSupervisor).toHaveBeenCalledTimes(1);
    expect(stopSourceImportPolling).toHaveBeenCalledTimes(1);
  });

  it('provides an ActivityWatch browser capture bridge for the browser ledger recorder', async () => {
    const stopSourceImportPolling = vi.fn();
    const checkpointStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
    };
    const stateStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
      writeSourceAuditEvent: vi.fn(async () => undefined),
      listSourceAuditEvents: vi.fn(async () => []),
      listSourceInstanceSummaries: vi.fn(async () => []),
      writeSourceInstanceConfig: vi.fn(async () => undefined),
      listSourceInstanceConfigs: vi.fn(async () => []),
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          id: 'aw-event-1',
          timestamp: '2026-05-12T10:15:00.000Z',
          data: {
            title: 'Phase 4 browser ledger',
            url: 'https://example.com/phase4',
          },
        },
      ],
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    let capturedRecord: unknown = null;
    const startSourceRecorderSupervisor = vi.fn(async (_input, dependencies) => {
      capturedRecord = await dependencies.captureSourceRecord({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: true,
      });

      return {
        stop: vi.fn(),
      };
    });

    try {
      startMirrorBrainService(
        {
          config: getMirrorBrainConfig(),
          workspaceDir: '/tmp/mirrorbrain-browser-ledger-runtime',
          browserBucketId: 'aw-watcher-web-chrome',
        },
        {
          createCheckpointStore: vi.fn(() => checkpointStore),
          createSourceLedgerStateStore: vi.fn(() => stateStore),
          startSourceLedgerImportPolling: vi.fn(() => ({
            stop: stopSourceImportPolling,
          })),
          startSourceRecorderSupervisor,
          now: () => '2026-05-12T10:30:00.000Z',
        },
      );

      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(capturedRecord).toEqual([
        {
          occurredAt: '2026-05-12T10:15:00.000Z',
          capturedAt: '2026-05-12T10:30:00.000Z',
          payload: {
            id: 'aw-event-1',
            title: 'Phase 4 browser ledger',
            url: 'https://example.com/phase4',
            page_content:
              'Phase 4 browser ledger\n\nhttps://example.com/phase4',
          },
        },
      ]);
      expect(checkpointStore.writeCheckpoint).toHaveBeenCalledWith({
        sourceKey: 'activitywatch-browser-ledger:aw-watcher-web-chrome',
        lastSyncedAt: '2026-05-12T10:30:00.000Z',
        updatedAt: '2026-05-12T10:30:00.000Z',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('analyzes a user-selected work-session window from stored memory events', async () => {
    const memoryEvents: MemoryEvent[] = [
      {
        id: 'browser-1',
        sourceType: 'browser',
        sourceRef: 'browser:default:1',
        timestamp: '2026-05-12T10:00:00.000Z',
        authorizationScopeId: 'scope-source-ledger',
        content: {
          title: 'Phase 4 design',
          summary: 'Read source ledger design.',
          entities: [{ kind: 'project', label: 'mirrorbrain' }],
        },
        captureMetadata: {
          upstreamSource: 'source-ledger:browser',
          checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
        },
      },
      {
        id: 'shell-1',
        sourceType: 'shell',
        sourceRef: 'shell:default:1',
        timestamp: '2026-05-12T10:30:00.000Z',
        authorizationScopeId: 'scope-source-ledger',
        content: {
          title: 'Run tests',
          summary: 'Ran source ledger tests.',
          entities: [{ kind: 'project', label: 'mirrorbrain' }],
        },
        captureMetadata: {
          upstreamSource: 'source-ledger:shell',
          checkpoint: 'ledgers/2026-05-12/shell.jsonl:1',
        },
      },
    ];
    const service = createMirrorBrainService(
      {
        service: {
          status: 'running',
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        listMemoryEvents: vi.fn(async () => memoryEvents),
        now: () => '2026-05-12T12:00:00.000Z',
      },
    );

    const result = await service.analyzeWorkSessions({
      preset: 'last-6-hours',
    });

    expect(result.analysisWindow).toEqual({
      preset: 'last-6-hours',
      startAt: '2026-05-12T06:00:00.000Z',
      endAt: '2026-05-12T12:00:00.000Z',
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      projectHint: 'mirrorbrain',
      memoryEventIds: ['browser-1', 'shell-1'],
      reviewState: 'pending',
    });
  });

  it('reviews a work-session candidate with explicit project assignment', async () => {
    const candidate: WorkSessionCandidate = {
      id: 'work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
      projectHint: 'mirrorbrain',
      title: 'mirrorbrain work session',
      summary: 'Imported source ledgers.',
      memoryEventIds: ['browser-1', 'shell-1'],
      sourceTypes: ['browser', 'shell'],
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:30:00.000Z',
      },
      relationHints: ['Phase 4 design', 'Run tests'],
      reviewState: 'pending',
    };
    const service = createMirrorBrainService(
      {
        service: {
          status: 'running',
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        now: () => '2026-05-12T12:05:00.000Z',
      },
    );

    const result = await service.reviewWorkSessionCandidate(candidate, {
      decision: 'keep',
      reviewedBy: 'user',
      projectAssignment: {
        kind: 'confirmed-new-project',
        name: 'MirrorBrain',
      },
    });

    expect(result.project).toMatchObject({
      id: 'project:mirrorbrain',
      name: 'MirrorBrain',
    });
    expect(result.reviewedWorkSession).toMatchObject({
      candidateId: candidate.id,
      projectId: 'project:mirrorbrain',
      reviewState: 'reviewed',
      reviewedAt: '2026-05-12T12:05:00.000Z',
    });
  });

  it('generates and publishes Knowledge Article Drafts from reviewed work sessions', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-article-service-'));
    const candidate: WorkSessionCandidate = {
      id: 'work-session-candidate:source-ledger',
      projectHint: 'mirrorbrain',
      title: 'Source ledger integration',
      summary: 'Built source ledger import.',
      memoryEventIds: ['browser-1'],
      sourceTypes: ['browser'],
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:30:00.000Z',
      },
      relationHints: ['Phase 4 design'],
      reviewState: 'pending',
    };
    const service = createMirrorBrainService(
      {
        workspaceDir,
        service: {
          status: 'running',
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        now: () => '2026-05-12T12:10:00.000Z',
      },
    );
    const review = await service.reviewWorkSessionCandidate(candidate, {
      decision: 'keep',
      reviewedBy: 'user',
      projectAssignment: {
        kind: 'confirmed-new-project',
        name: 'MirrorBrain',
      },
    });

    const draft = await service.generateKnowledgeArticleDraft({
      reviewedWorkSessionIds: [review.reviewedWorkSession.id],
      title: 'Source ledger architecture',
      summary: 'How source ledgers feed memory.',
      body: 'Source ledgers are the acquisition boundary.',
      topicProposal: {
        kind: 'new-topic',
        name: 'Source ledger',
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
    });
    const published = await service.publishKnowledgeArticleDraft({
      draft,
      publishedBy: 'user',
      topicAssignment: {
        kind: 'confirmed-new-topic',
        name: 'Source ledger',
      },
    });

    expect(draft).toMatchObject({
      draftState: 'draft',
      projectId: 'project:mirrorbrain',
      sourceReviewedWorkSessionIds: [review.reviewedWorkSession.id],
    });
    expect(published.article).toMatchObject({
      projectId: 'project:mirrorbrain',
      version: 1,
      isCurrentBest: true,
      publishState: 'published',
      publishedBy: 'user',
    });
    await expect(
      service.listKnowledgeArticleHistory({
        projectId: 'project:mirrorbrain',
        topicId: published.article.topicId,
      }),
    ).resolves.toEqual([published.article]);

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('rejects Knowledge Article Draft generation from unpersisted reviewed work-session ids', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-article-service-'));
    const service = createMirrorBrainService(
      {
        workspaceDir,
        service: {
          status: 'running',
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        now: () => '2026-05-12T12:10:00.000Z',
      },
    );

    await expect(
      service.generateKnowledgeArticleDraft({
        reviewedWorkSessionIds: ['reviewed-work-session:forged'],
        title: 'Forged article',
        summary: 'This should not be generated.',
        body: 'Unpersisted review inputs are not trusted.',
        topicProposal: {
          kind: 'new-topic',
          name: 'Forged',
        },
        articleOperationProposal: {
          kind: 'create-new-article',
        },
      }),
    ).rejects.toThrow(
      'Reviewed work session was not found: reviewed-work-session:forged',
    );

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('keeps legacy browser sync execution explicit instead of starting it during polling', async () => {
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
    const service = startMirrorBrainService(
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
        now: () => '2026-03-20T10:00:00.000Z',
      },
    );

    expect(runBrowserMemorySyncOnce).not.toHaveBeenCalled();

    await service.syncBrowserMemory();

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

  it('auto-discovers the most recent ActivityWatch browser bucket for explicit browser sync', async () => {
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
    const service = startMirrorBrainService(
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
        now: () => '2026-04-13T03:53:51.918Z',
      },
    );

    expect(fetchActivityWatchBuckets).not.toHaveBeenCalled();

    await service.syncBrowserMemory();

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

  it('creates an openclaw-facing service contract that queries the qmd workspace and forwards retrieval input', async () => {
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
        workspaceDir: '/tmp/mirrorbrain-workspace',
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
      workspaceDir: '/tmp/mirrorbrain-workspace',
      query: 'What did I work on yesterday?',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      sourceTypes: ['browser'],
    });
    expect(listKnowledge).toHaveBeenCalledWith({
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
    expect(listSkillDrafts).toHaveBeenCalledWith({
      workspaceDir: '/tmp/mirrorbrain-workspace',
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
      writeSourceInstanceConfig: vi.fn(async () => undefined),
      listSourceInstanceConfigs: vi.fn(async () => []),
    };
    const writeMemoryEvent = vi.fn(async () => undefined);
    const importSourceLedgers = vi.fn(async (_input, dependencies) => {
      await expect(
        dependencies.isSourceImportAllowed({
          sourceKind: 'browser',
          sourceInstanceId: 'chrome-main',
        }),
      ).resolves.toBe(true);
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

  it('refreshes the memory event cache after importing source ledgers', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-service-cache-'));
    const cacheDir = join(workspaceDir, 'mirrorbrain', 'cache');
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      join(cacheDir, 'memory-events-cache.json'),
      JSON.stringify({
        version: 1,
        updatedAt: '2026-05-12T10:00:00.000Z',
        total: 0,
        events: [],
        lastSyncSummary: {},
      }),
    );
    const memoryEvent: MemoryEvent = {
      id: 'ledger:browser:event-1',
      sourceType: 'browser',
      sourceRef: 'browser:chrome-main:event-1',
      timestamp: '2026-05-12T10:00:00.000Z',
      authorizationScopeId: 'scope-source-ledger',
      content: {
        title: 'Imported Browser Page',
        summary: 'Imported from source ledger.',
        contentKind: 'browser-page',
        entities: [],
        sourceSpecific: {
          id: 'event-1',
          url: 'https://example.com/imported',
          pageContent: 'Imported from source ledger.',
        },
      },
      captureMetadata: {
        upstreamSource: 'source-ledger:browser',
        checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
      },
    };
    const stateStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
      writeSourceAuditEvent: vi.fn(async () => undefined),
      listSourceAuditEvents: vi.fn(async () => []),
      listSourceInstanceSummaries: vi.fn(async () => []),
      writeSourceInstanceConfig: vi.fn(async () => undefined),
      listSourceInstanceConfigs: vi.fn(async () => []),
    };
    const importSourceLedgers = vi.fn(async (_input, dependencies) => {
      await dependencies.writeMemoryEvent(memoryEvent);

      return {
        importedCount: 1,
        skippedCount: 0,
        scannedLedgerCount: 1,
        changedLedgerCount: 1,
        ledgerResults: [],
      };
    });
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
        workspaceDir,
      },
      {
        createSourceLedgerStateStore: vi.fn(() => stateStore),
        createMemoryEventWriter: vi.fn(() => ({
          writeMemoryEvent: async (record: {
            recordId: string;
            payload: MemoryEvent;
          }) => {
            const memoryEventsDir = join(workspaceDir, 'mirrorbrain', 'memory-events');
            await mkdir(memoryEventsDir, { recursive: true });
            await writeFile(
              join(memoryEventsDir, `${record.recordId}.json`),
              JSON.stringify(record.payload, null, 2),
            );
          },
        })),
        importSourceLedgers,
      },
    );

    await api.importSourceLedgers();

    await expect(api.listMemoryEvents()).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          id: 'ledger:browser:event-1',
          content: expect.objectContaining({
            title: 'Imported Browser Page',
          }),
        }),
      ],
      pagination: expect.objectContaining({ total: 1 }),
    });
  });

  it('refreshes a stale empty memory event cache after source import scans existing events', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-service-stale-cache-'));
    const cacheDir = join(workspaceDir, 'mirrorbrain', 'cache');
    const memoryEventsDir = join(workspaceDir, 'mirrorbrain', 'memory-events');
    await mkdir(cacheDir, { recursive: true });
    await mkdir(memoryEventsDir, { recursive: true });
    await writeFile(
      join(cacheDir, 'memory-events-cache.json'),
      JSON.stringify({
        version: 1,
        updatedAt: '2026-05-12T10:00:00.000Z',
        total: 0,
        events: [],
        lastSyncSummary: {},
      }),
    );
    await writeFile(
      join(memoryEventsDir, 'ledger:browser:event-1.json'),
      JSON.stringify({
        id: 'ledger:browser:event-1',
        sourceType: 'browser',
        sourceRef: 'browser:chrome-main:event-1',
        timestamp: '2026-05-12T10:00:00.000Z',
        authorizationScopeId: 'scope-source-ledger',
        content: {
          title: 'Existing Browser Page',
          summary: 'Already imported from source ledger.',
          contentKind: 'browser-page',
          entities: [],
          sourceSpecific: {},
        },
        captureMetadata: {
          upstreamSource: 'source-ledger:browser',
          checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
        },
      } satisfies MemoryEvent),
    );
    const stateStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
      writeSourceAuditEvent: vi.fn(async () => undefined),
      listSourceAuditEvents: vi.fn(async () => []),
      listSourceInstanceSummaries: vi.fn(async () => []),
      writeSourceInstanceConfig: vi.fn(async () => undefined),
      listSourceInstanceConfigs: vi.fn(async () => []),
    };
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
        workspaceDir,
      },
      {
        createSourceLedgerStateStore: vi.fn(() => stateStore),
        importSourceLedgers: vi.fn(async () => ({
          importedCount: 0,
          skippedCount: 0,
          scannedLedgerCount: 1,
          changedLedgerCount: 0,
          ledgerResults: [],
        })),
      },
    );

    await api.importSourceLedgers();

    await expect(api.listMemoryEvents()).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          id: 'ledger:browser:event-1',
          content: expect.objectContaining({
            title: 'Existing Browser Page',
          }),
        }),
      ],
      pagination: expect.objectContaining({ total: 1 }),
    });
  });

  it('updates Phase 4 source instance config with an audit event', async () => {
    const stateStore = {
      readCheckpoint: vi.fn(async () => null),
      writeCheckpoint: vi.fn(async () => undefined),
      writeSourceAuditEvent: vi.fn(async () => undefined),
      listSourceAuditEvents: vi.fn(async () => []),
      listSourceInstanceSummaries: vi.fn(async () => []),
      writeSourceInstanceConfig: vi.fn(async () => undefined),
      listSourceInstanceConfigs: vi.fn(async () => []),
    };
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
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
        now: () => '2026-05-12T11:00:00.000Z',
      },
    );

    await expect(
      api.updateSourceInstanceConfig({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: false,
        updatedBy: 'mirrorbrain-web',
      }),
    ).resolves.toEqual({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: false,
      updatedAt: '2026-05-12T11:00:00.000Z',
      updatedBy: 'mirrorbrain-web',
    });

    expect(stateStore.writeSourceInstanceConfig).toHaveBeenCalledWith({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: false,
      updatedAt: '2026-05-12T11:00:00.000Z',
      updatedBy: 'mirrorbrain-web',
    });
    expect(stateStore.writeSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'source-disabled',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        occurredAt: '2026-05-12T11:00:00.000Z',
        metadata: {
          updatedBy: 'mirrorbrain-web',
        },
      }),
    );
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
          rootUri: 'qmd://mirrorbrain/memory-narrative',
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

  it('falls back to workspace memory events when qmd memory reads fail', async () => {
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

  it('lists recent memory events for a Phase 4 source instance', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-source-memory-'));
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
    const memoryEvents: MemoryEvent[] = [
      {
        id: 'ledger:browser:recent',
        sourceType: 'browser',
        sourceRef: 'browser:chrome-main:recent',
        timestamp: '2026-05-12T10:00:00.000Z',
        authorizationScopeId: 'scope-source-ledger',
        content: {
          title: 'Recent browser memory',
          summary: 'Imported browser page.',
          contentKind: 'browser-page',
          sourceSpecific: {},
        },
        captureMetadata: {
          upstreamSource: 'source-ledger:browser',
          checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
        },
      },
      {
        id: 'ledger:shell:other',
        sourceType: 'shell',
        sourceRef: 'shell:iterm-main:other',
        timestamp: '2026-05-12T09:00:00.000Z',
        authorizationScopeId: 'scope-source-ledger',
        content: {
          title: 'Other shell memory',
          summary: 'Imported shell command.',
          contentKind: 'shell-command',
          sourceSpecific: {},
        },
        captureMetadata: {
          upstreamSource: 'source-ledger:shell',
          checkpoint: 'ledgers/2026-05-12/shell.jsonl:1',
        },
      },
    ];

    try {
      const api = createMirrorBrainService(
        {
          service,
          workspaceDir,
        },
        {
          listMemoryEvents: vi.fn(async () => ({
            items: memoryEvents,
            pagination: {
              total: memoryEvents.length,
              page: 1,
              pageSize: 10,
              totalPages: 1,
            },
          })),
          listWorkspaceMemoryEvents: vi.fn(async () => memoryEvents),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
        },
      );

      await expect(
        api.listMemoryEvents({
          page: 1,
          pageSize: 10,
          sourceKind: 'browser',
          sourceInstanceId: 'chrome-main',
        }),
      ).resolves.toEqual({
        items: [
          expect.objectContaining({
            id: 'ledger:browser:recent',
            sourceRef: 'browser:chrome-main:recent',
          }),
        ],
        pagination: {
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      });
    } finally {
      await rm(workspaceDir, { recursive: true, force: true });
    }
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
          rootUri: 'qmd://mirrorbrain/candidate',
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

  it('imports source ledgers before building daily candidates', async () => {
    const syncBrowserMemory = vi.fn(async () => ({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'incremental' as const,
      importedCount: 3,
      lastSyncedAt: '2026-04-15T00:00:00.000Z',
      importedEvents: [],
    }));
    const importSourceLedgers = vi.fn(async () => {
      callOrder.push('importSourceLedgers');
      return {
        importedCount: 3,
        skippedCount: 0,
        scannedLedgerCount: 1,
        changedLedgerCount: 1,
        ledgerResults: [],
      };
    });
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
        importSourceLedgers,
        publishCandidateMemory: vi.fn(async () => ({
          sourcePath: '/tmp/candidate.json',
          rootUri: 'qmd://mirrorbrain/candidate',
        })),
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    await api.createDailyCandidateMemories('2026-04-14', 'Asia/Shanghai');

    expect(importSourceLedgers).toHaveBeenCalledTimes(1);
    expect(syncBrowserMemory).not.toHaveBeenCalled();
    expect(callOrder).toEqual([
      'importSourceLedgers',
      'listRawWorkspaceMemoryEvents',
      'createCandidateMemories',
    ]);
  });

  it('persists knowledge and skill artifacts through the configured qmd workspace writers', async () => {
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
      rootUri: 'qmd://mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
    }));
    const publishSkill = vi.fn(async () => ({
      sourcePath: '/tmp/skill-draft.md',
      uri: 'qmd://mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
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
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact: {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    });
    expect(publishSkill).toHaveBeenCalledWith({
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

  it('falls back to workspace copies when qmd listings are empty', async () => {
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
      rootUri: 'qmd://mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
    }));
    const publishSkill = vi.fn(async () => ({
      sourcePath: '/tmp/skill-draft.md',
      uri: 'qmd://mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
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
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact: {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    });
    expect(publishSkill).toHaveBeenCalledWith({
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
        'qmd://mirrorbrain/reviewed-memories/reviewed:candidate:browser:aw-event-1.json',
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
      workspaceDir: process.env.MIRRORBRAIN_WORKSPACE_DIR,
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
        'qmd://mirrorbrain/candidate-memories/candidate:2026-03-20:activitywatch-browser:docs-example-com:guides.json',
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
      workspaceDir: process.env.MIRRORBRAIN_WORKSPACE_DIR,
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
          rootUri: 'qmd://mirrorbrain/candidate.json',
        })),
        loadBrowserPageContentArtifactFromWorkspace,
      },
    );

    await api.createDailyCandidateMemories('2026-04-14', 'Asia/Shanghai');

    expect(loadBrowserPageContentArtifactFromWorkspace).toHaveBeenCalledWith({
      workspaceDir: process.env.MIRRORBRAIN_WORKSPACE_DIR,
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
    const importSourceLedgers = vi.fn(async () => ({
      importedCount: 0,
      skippedCount: 0,
      scannedLedgerCount: 0,
      changedLedgerCount: 0,
      ledgerResults: [],
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
        importSourceLedgers,
        publishCandidateMemory: vi.fn(async () => ({
          sourcePath: '/tmp/candidate.json',
          rootUri: 'qmd://mirrorbrain/candidate',
        })),
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    const result = await api.createDailyCandidateMemories('2026-04-12', 'Asia/Shanghai');

    expect(result).toEqual(existingCandidates);
    expect(importSourceLedgers).toHaveBeenCalledTimes(1);
    expect(service.syncBrowserMemory).not.toHaveBeenCalled();

    expect(listRawWorkspaceMemoryEvents).not.toHaveBeenCalled();
    expect(createCandidateMemories).not.toHaveBeenCalled();
  });

  it('regenerates existing daily candidates after source ledger import adds newer events', async () => {
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
    const importSourceLedgers = vi.fn(async () => ({
      importedCount: 1,
      skippedCount: 0,
      scannedLedgerCount: 1,
      changedLedgerCount: 1,
      ledgerResults: [],
    }));
    const publishCandidateMemory = vi.fn(async () => ({
      sourcePath: '/tmp/candidate.json',
      rootUri: 'qmd://mirrorbrain/candidate',
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
        importSourceLedgers,
        publishCandidateMemory,
        listKnowledge: vi.fn(async () => []),
        listSkillDrafts: vi.fn(async () => []),
      },
    );

    const result = await api.createDailyCandidateMemories('2026-05-10', 'Asia/Shanghai');

    expect(result).toEqual(regeneratedCandidates);
    expect(importSourceLedgers).toHaveBeenCalledTimes(1);
    expect(service.syncBrowserMemory).not.toHaveBeenCalled();
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
    const importSourceLedgers = vi.fn(async () => ({
      importedCount: 1,
      skippedCount: 0,
      scannedLedgerCount: 1,
      changedLedgerCount: 1,
      ledgerResults: [],
    }));

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
        importSourceLedgers,
        publishCandidateMemory: vi.fn(async () => ({
          sourcePath: '/tmp/candidate.json',
          rootUri: 'qmd://mirrorbrain/candidate',
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

  it('persists candidate memories sequentially to avoid workspace write ordering', async () => {
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
                rootUri: 'qmd://mirrorbrain/candidate-1.json',
              });
            };
          }),
      )
      .mockImplementationOnce(async ({ artifact }: { artifact: { id: string } }) => {
        publishOrder.push(`start:${artifact.id}`);
        publishOrder.push(`end:${artifact.id}`);
        return {
          sourcePath: '/tmp/mirrorbrain-workspace/candidate-2.json',
          rootUri: 'qmd://mirrorbrain/candidate-2.json',
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
        importSourceLedgers: vi.fn(async () => ({
          importedCount: 0,
          skippedCount: 0,
          scannedLedgerCount: 0,
          changedLedgerCount: 0,
          ledgerResults: [],
        })),
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

    it('deletes candidate memory from workspace resources', async () => {
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
        workspaceDir,
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
        workspaceDir,
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
