import { describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import { createMirrorBrainService, startMirrorBrainService } from './index.js';

describe('mirrorbrain service', () => {
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
      },
      {
        checkpointStore,
        writeMemoryEvent,
      },
    );
  });

  it('creates an openclaw-facing service contract that queries OpenViking through the configured base URL', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const queryMemory = vi.fn(async () => []);
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

    await api.queryMemory();
    await api.listKnowledge();
    await api.listSkillDrafts();

    expect(queryMemory).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:8080',
    });
    expect(listKnowledge).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:8080',
    });
    expect(listSkillDrafts).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:8080',
    });
    expect(api.service).toBe(service);
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
      baseUrl: 'http://127.0.0.1:8080',
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact: {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    });
    expect(publishSkill).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:8080',
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
      stop: vi.fn(),
    };
    const reviewedMemories = [
      {
        id: 'reviewed:candidate:browser:aw-event-1',
        candidateMemoryId: 'candidate:browser:aw-event-1',
        decision: 'keep' as const,
      },
    ];
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
      baseUrl: 'http://127.0.0.1:8080',
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact: {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    });
    expect(publishSkill).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:8080',
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
      stop: vi.fn(),
    };
    const reviewMemory = vi.fn((_candidate, _input) => ({
      id: 'reviewed:candidate:browser:aw-event-1',
      candidateMemoryId: 'candidate:browser:aw-event-1',
      decision: 'keep' as const,
    }));
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
          id: 'candidate:browser:aw-event-1',
          memoryEventIds: ['browser:aw-event-1'],
          reviewState: 'pending',
        },
        {
          decision: 'keep',
        },
      ),
    ).resolves.toEqual({
      id: 'reviewed:candidate:browser:aw-event-1',
      candidateMemoryId: 'candidate:browser:aw-event-1',
      decision: 'keep',
    });

    expect(reviewMemory).toHaveBeenCalledWith(
      {
        id: 'candidate:browser:aw-event-1',
        memoryEventIds: ['browser:aw-event-1'],
        reviewState: 'pending',
      },
      {
        decision: 'keep',
      },
    );
    expect(publishReviewedMemory).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:8080',
      workspaceDir: process.cwd(),
      artifact: {
        id: 'reviewed:candidate:browser:aw-event-1',
        candidateMemoryId: 'candidate:browser:aw-event-1',
        decision: 'keep',
      },
    });
  });

  it('creates a candidate memory from raw memory events through the service contract', async () => {
    const service = {
      status: 'running' as const,
      config: getMirrorBrainConfig(),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const createCandidate = vi.fn((memoryEvents) => ({
      id: 'candidate:browser:aw-event-1',
      memoryEventIds: memoryEvents.map((event: { id: string }) => event.id),
      reviewState: 'pending' as const,
    }));
    const publishCandidateMemory = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain-workspace/candidate.json',
      rootUri:
        'viking://resources/mirrorbrain/candidate-memories/candidate:browser:aw-event-1.json',
    }));

    const api = createMirrorBrainService(
      {
        service,
      },
      {
        createCandidate,
        publishCandidateMemory,
      },
    );

    await expect(
      api.createCandidateMemory([
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
      ]),
    ).resolves.toEqual({
      id: 'candidate:browser:aw-event-1',
      memoryEventIds: ['browser:aw-event-1'],
      reviewState: 'pending',
    });

    expect(createCandidate).toHaveBeenCalledWith([
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
    expect(publishCandidateMemory).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:8080',
      workspaceDir: process.cwd(),
      artifact: {
        id: 'candidate:browser:aw-event-1',
        memoryEventIds: ['browser:aw-event-1'],
        reviewState: 'pending',
      },
    });
  });
});
