import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeArtifact, SkillArtifact } from '../types/index';
import { createMirrorBrainBrowserApi } from './client';

const knowledgeDraft: KnowledgeArtifact = {
  id: 'knowledge-draft:reviewed:candidate:browser:vitest',
  artifactType: 'daily-review-draft',
  draftState: 'draft',
  topicKey: 'vitest-testing',
  title: 'Vitest setup and debugging',
  summary: '1 reviewed memory synthesized into tutorial knowledge.',
  body: '## Source Synthesis\nStep 1: install Vitest and configure projects.',
  sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
  derivedFromKnowledgeIds: [],
  version: 1,
  isCurrentBest: false,
  supersedesKnowledgeId: null,
  updatedAt: '2026-04-21T12:00:00.000Z',
  reviewedAt: '2026-04-21T10:00:00.000Z',
  recencyLabel: '2026-04-21',
  provenanceRefs: [
    {
      kind: 'reviewed-memory',
      id: 'reviewed:candidate:browser:vitest',
    },
  ],
};

const skillDraft: SkillArtifact = {
  id: 'skill-draft:reviewed:candidate:browser:vitest',
  approvalState: 'draft',
  workflowEvidenceRefs: ['reviewed:candidate:browser:vitest'],
  executionSafetyMetadata: {
    requiresConfirmation: true,
  },
  updatedAt: '2026-04-21T12:00:00.000Z',
};

describe('createMirrorBrainBrowserApi', () => {
  it('throws server errors from knowledge approval instead of returning an undefined topic', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        message: 'Knowledge draft not found: knowledge-draft:missing',
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await expect(
      api.approveKnowledge?.({
        ...knowledgeDraft,
        id: 'knowledge-draft:missing',
      }),
    ).rejects.toThrow(
      'Knowledge draft not found: knowledge-draft:missing',
    );
  });

  it('throws server errors from daily candidate creation instead of returning undefined candidates', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        message: 'No memory events found for review date 2026-05-10.',
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await expect(
      api.createDailyCandidates('2026-05-10', 'Asia/Shanghai'),
    ).rejects.toThrow(
      'No memory events found for review date 2026-05-10.',
    );
  });

  it('sends the current knowledge draft snapshot when approving a draft', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        publishedArtifact: {
          ...knowledgeDraft,
          artifactType: 'topic-knowledge',
          draftState: 'published',
        },
        assignedTopic: {
          topicKey: 'vitest-testing',
          title: 'Vitest setup and debugging',
        },
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await api.approveKnowledge?.(knowledgeDraft);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/knowledge/approve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          draftId: knowledgeDraft.id,
          draft: knowledgeDraft,
        }),
      }),
    );
  });

  it('sends delete requests for persisted knowledge and skill artifacts', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 204,
      json: async () => ({}),
      text: async () => '',
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await api.deleteKnowledgeArtifact?.(knowledgeDraft.id);
    await api.deleteSkillArtifact?.(skillDraft.id);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `http://localhost:3000/knowledge/${knowledgeDraft.id}`,
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://localhost:3000/skills/${skillDraft.id}`,
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('sends delete requests for published Knowledge Article lineages', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 204,
      json: async () => ({}),
      text: async () => '',
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const articleId = 'article:project-mirrorbrain:topic-source-ledger:source-ledger';
    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await api.deleteKnowledgeArticle(articleId);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/knowledge-articles/${encodeURIComponent(articleId)}`,
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('calls Phase 4 source management endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              sourceKind: 'browser',
              sourceInstanceId: 'chrome-main',
              lifecycleStatus: 'enabled',
              recorderStatus: 'unknown',
              importedCount: 1,
              skippedCount: 0,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'source-audit:entry-1',
              eventType: 'entry-imported',
              sourceKind: 'browser',
              sourceInstanceId: 'chrome-main',
              ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
              lineNumber: 1,
              occurredAt: '2026-05-12T10:31:00.000Z',
              severity: 'info',
              message: 'Imported browser ledger entry.',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          import: {
            importedCount: 1,
            skippedCount: 0,
            scannedLedgerCount: 1,
            changedLedgerCount: 1,
            ledgerResults: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          config: {
            sourceKind: 'browser',
            sourceInstanceId: 'chrome-main',
            enabled: false,
            updatedAt: '2026-05-12T11:00:00.000Z',
            updatedBy: 'mirrorbrain-web',
          },
        }),
      }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await expect(api.listSourceStatuses?.()).resolves.toEqual([
      expect.objectContaining({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      }),
    ]);
    await expect(api.listSourceAuditEvents?.({ sourceKind: 'browser' })).resolves.toEqual([
      expect.objectContaining({
        id: 'source-audit:entry-1',
        sourceKind: 'browser',
      }),
    ]);
    await expect(api.importSourceLedgers?.()).resolves.toMatchObject({
      importedCount: 1,
      scannedLedgerCount: 1,
    });
    await expect(
      api.updateSourceConfig?.({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: false,
        updatedBy: 'mirrorbrain-web',
      }),
    ).resolves.toMatchObject({
      enabled: false,
      updatedBy: 'mirrorbrain-web',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3000/sources/status');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/sources/audit?sourceKind=browser',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/sources/import',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://localhost:3000/sources/config',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          sourceKind: 'browser',
          sourceInstanceId: 'chrome-main',
          enabled: false,
          updatedBy: 'mirrorbrain-web',
        }),
      }),
    );
  });

  it('requests recent memory for a Phase 4 source instance', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'ledger:browser:recent',
            sourceType: 'browser',
            sourceRef: 'browser:chrome-main:recent',
            timestamp: '2026-05-12T10:00:00.000Z',
            authorizationScopeId: 'scope-source-ledger',
            content: {
              title: 'Recent browser memory',
              summary: 'Imported browser page.',
            },
            captureMetadata: {
              upstreamSource: 'source-ledger:browser',
              checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
            },
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          pageSize: 5,
          totalPages: 1,
        },
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await expect(
      api.listMemory(1, 5, {
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'ledger:browser:recent',
          }),
        ],
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/memory?page=1&pageSize=5&sourceKind=browser&sourceInstanceId=chrome-main',
    );
  });

  it('calls the Phase 4 manual work-session analysis endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        analysis: {
          analysisWindow: {
            preset: 'last-6-hours',
            startAt: '2026-05-12T06:00:00.000Z',
            endAt: '2026-05-12T12:00:00.000Z',
          },
          generatedAt: '2026-05-12T12:00:00.000Z',
          candidates: [
            {
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
            },
          ],
          excludedMemoryEventIds: [],
        },
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await expect(api.analyzeWorkSessions('last-6-hours')).resolves.toMatchObject({
      analysisWindow: {
        preset: 'last-6-hours',
      },
      candidates: [
        expect.objectContaining({
          projectHint: 'mirrorbrain',
          memoryEventIds: ['browser-1', 'shell-1'],
        }),
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/work-sessions/analyze',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ preset: 'last-6-hours' }),
      }),
    );
  });

  it('calls the Phase 4 work-session review endpoint with explicit project assignment', async () => {
    const candidate = {
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
      reviewState: 'pending' as const,
    };
    const review = {
      decision: 'keep' as const,
      reviewedBy: 'mirrorbrain-web',
      projectAssignment: {
        kind: 'confirmed-new-project' as const,
        name: 'MirrorBrain',
      },
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        reviewedWorkSession: {
          id: 'reviewed-work-session:mirrorbrain',
          candidateId: candidate.id,
          projectId: 'project:mirrorbrain',
          title: candidate.title,
          summary: candidate.summary,
          memoryEventIds: candidate.memoryEventIds,
          sourceTypes: candidate.sourceTypes,
          timeRange: candidate.timeRange,
          relationHints: candidate.relationHints,
          reviewState: 'reviewed',
          reviewedAt: '2026-05-12T12:05:00.000Z',
          reviewedBy: 'mirrorbrain-web',
        },
        project: {
          id: 'project:mirrorbrain',
          name: 'MirrorBrain',
          status: 'active',
          createdAt: '2026-05-12T12:05:00.000Z',
          updatedAt: '2026-05-12T12:05:00.000Z',
        },
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await expect(api.reviewWorkSessionCandidate(candidate, review)).resolves.toMatchObject({
      reviewedWorkSession: {
        candidateId: candidate.id,
        projectId: 'project:mirrorbrain',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/work-sessions/reviews',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ candidate, review }),
      }),
    );
  });

  it('loads the Phase 4 published knowledge article tree', async () => {
    const tree = {
      projects: [
        {
          project: {
            id: 'project:mirrorbrain',
            name: 'MirrorBrain',
            status: 'active',
            createdAt: '2026-05-12T12:00:00.000Z',
            updatedAt: '2026-05-12T12:00:00.000Z',
          },
          topics: [
            {
              topic: {
                id: 'topic:project-mirrorbrain:source-ledger',
                projectId: 'project:mirrorbrain',
                name: 'Source ledger',
                status: 'active',
                createdAt: '2026-05-12T12:00:00.000Z',
                updatedAt: '2026-05-12T12:00:00.000Z',
              },
              articles: [
                {
                  articleId:
                    'article:project-mirrorbrain:topic-source-ledger:source-ledger-architecture',
                  title: 'Source ledger architecture',
                  currentBestArticle: {
                    id: 'knowledge-article:source-ledger:v1',
                    articleId:
                      'article:project-mirrorbrain:topic-source-ledger:source-ledger-architecture',
                    projectId: 'project:mirrorbrain',
                    topicId: 'topic:project-mirrorbrain:source-ledger',
                    title: 'Source ledger architecture',
                    summary: 'How source ledgers feed memory.',
                    body: 'Source ledgers are the acquisition boundary.',
                    version: 1,
                    isCurrentBest: true,
                    supersedesArticleId: null,
                    sourceReviewedWorkSessionIds: ['reviewed-work-session:source-ledger'],
                    sourceMemoryEventIds: ['browser-1'],
                    provenanceRefs: [{ kind: 'memory-event', id: 'browser-1' }],
                    publishState: 'published',
                    publishedAt: '2026-05-12T12:20:00.000Z',
                    publishedBy: 'user',
                  },
                  history: [],
                },
              ],
            },
          ],
        },
      ],
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => tree,
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');

    await expect(api.listKnowledgeArticleTree()).resolves.toEqual(tree);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/knowledge-articles/tree',
    );
  });

  it('generates and publishes Phase 4 knowledge article drafts', async () => {
    const draft = {
      id: 'knowledge-article-draft:source-ledger',
      draftState: 'draft' as const,
      projectId: 'project:mirrorbrain',
      title: 'Source ledger architecture',
      summary: 'How source ledgers feed memory.',
      body: 'Source ledgers are the acquisition boundary.',
      topicProposal: { kind: 'new-topic' as const, name: 'Source ledger' },
      articleOperationProposal: { kind: 'create-new-article' as const },
      sourceReviewedWorkSessionIds: ['reviewed-work-session:source-ledger'],
      sourceMemoryEventIds: ['browser-1'],
      provenanceRefs: [{ kind: 'memory-event' as const, id: 'browser-1' }],
      generatedAt: '2026-05-12T12:10:00.000Z',
    };
    const article = {
      id: 'knowledge-article:source-ledger:v1',
      articleId: 'article:source-ledger',
      projectId: draft.projectId,
      topicId: 'topic:project-mirrorbrain:source-ledger',
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: draft.sourceReviewedWorkSessionIds,
      sourceMemoryEventIds: draft.sourceMemoryEventIds,
      provenanceRefs: draft.provenanceRefs,
      publishState: 'published' as const,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'user',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ draft }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ article }),
      }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const api = createMirrorBrainBrowserApi('http://localhost:3000');
    const draftRequest = {
      reviewedWorkSessionIds: draft.sourceReviewedWorkSessionIds,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      topicProposal: draft.topicProposal,
      articleOperationProposal: draft.articleOperationProposal,
    };

    await expect(api.generateKnowledgeArticleDraft(draftRequest)).resolves.toEqual(draft);
    await expect(
      api.publishKnowledgeArticleDraft({
        draft,
        publishedBy: 'mirrorbrain-web',
        topicAssignment: { kind: 'confirmed-new-topic', name: 'Source ledger' },
      }),
    ).resolves.toEqual({ article });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/knowledge-articles/drafts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(draftRequest),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/knowledge-articles/publish',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          draft,
          publishedBy: 'mirrorbrain-web',
          topicAssignment: { kind: 'confirmed-new-topic', name: 'Source ledger' },
        }),
      }),
    );
  });
});
