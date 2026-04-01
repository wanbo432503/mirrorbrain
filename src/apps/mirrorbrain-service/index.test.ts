import { describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type {
  CandidateMemory,
  CandidateReviewSuggestion,
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
    title: 'Docs Example Com / guides',
    summary: `${input.memoryEventIds.length} browser events about Docs Example Com / guides on ${
      input.reviewDate ?? '2026-03-20'
    }.`,
    theme: 'docs.example.com / guides',
    reviewDate: input.reviewDate ?? '2026-03-20',
    timeRange: {
      startAt: '2026-03-20T08:00:00.000Z',
      endAt: '2026-03-20T08:15:00.000Z',
    },
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
    candidateTitle: 'Docs Example Com / guides',
    candidateSummary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
    candidateTheme: 'docs.example.com / guides',
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
      baseUrl: expectedOpenVikingBaseUrl,
    });
    expect(listKnowledge).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
    });
    expect(listSkillDrafts).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
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
    const queryMemory = vi.fn(async () => memoryEvents);
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
        queryMemory,
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

    expect(queryMemory).toHaveBeenCalledWith({
      baseUrl: expectedOpenVikingBaseUrl,
    });
    expect(createCandidateMemories).toHaveBeenCalledWith({
      reviewDate: '2026-03-20',
      reviewTimeZone: 'Asia/Shanghai',
      memoryEvents,
    });
    expect(publishCandidateMemory).toHaveBeenCalledTimes(2);
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
});
