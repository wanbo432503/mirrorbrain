import { describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type { BrowserPageContentArtifact } from '../../integrations/browser-page-content/index.js';
import type {
  CandidateMemory,
  CandidateReviewSuggestion,
  MemoryEvent,
  MemoryQueryResult,
  ReviewedMemory,
} from '../../shared/types/index.js';
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
        scopeId: 'scope-browser',
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        checkpointStore,
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
        writeMemoryEvent,
      },
    );
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
        listMemoryEvents: vi.fn(async () => []),
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

    await expect(api.listMemoryEvents()).resolves.toEqual([
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
        listMemoryEvents: vi.fn(async () => []),
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
        listRawWorkspaceMemoryEvents: vi.fn(async () => memoryEvents),
        createCandidateMemories,
        publishCandidateMemory,
        loadBrowserPageContentArtifactFromWorkspace: vi.fn(async () => null),
      },
    );

    const createPromise = api.createDailyCandidateMemories('2026-03-20', 'Asia/Shanghai');

    for (let attempt = 0; attempt < 5 && publishOrder.length === 0; attempt += 1) {
      await Promise.resolve();
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
});
