import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type {
  CandidateMemory,
  CandidateReviewSuggestion,
  KnowledgeArtifact,
  MemoryQueryResult,
  MemoryEvent,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';
import { startMirrorBrainHttpServer } from './index.js';

function createCandidateMemoryFixture(input: {
  id: string;
  memoryEventIds: string[];
}): CandidateMemory {
  return {
    id: input.id,
    memoryEventIds: input.memoryEventIds,
    title: 'Docs Example Com / guides',
    summary: `${input.memoryEventIds.length} browser events about Docs Example Com / guides on 2026-03-20.`,
    theme: 'docs.example.com / guides',
    reviewDate: '2026-03-20',
    timeRange: {
      startAt: '2026-03-20T08:00:00.000Z',
      endAt: '2026-03-20T08:15:00.000Z',
    },
    reviewState: 'pending',
  };
}

function createReviewedMemoryFixture(): ReviewedMemory {
  return {
    id: 'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
    candidateMemoryId:
      'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
    candidateTitle: 'Docs Example Com / guides',
    candidateSummary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
    candidateTheme: 'docs.example.com / guides',
    memoryEventIds: ['browser:aw-event-1'],
    reviewDate: '2026-03-20',
    decision: 'keep',
    reviewedAt: '2026-03-20T10:00:00.000Z',
  };
}

describe('mirrorbrain http server', () => {
  const servers: Array<{ stop(): Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();

      if (server) {
        await server.stop();
      }
    }
  });

  it('serves health and read endpoints through the local HTTP API', async () => {
    const listMemoryEvents = vi.fn(async (): Promise<MemoryEvent[]> => [
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
    const listKnowledge = vi.fn(async (): Promise<KnowledgeArtifact[]> => [
      {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    ]);
    const listSkillDrafts = vi.fn(async (): Promise<SkillArtifact[]> => [
      {
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    ]);
    const syncBrowserMemory = vi.fn(async () => ({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'incremental' as const,
      importedCount: 1,
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
    }));
    const syncShellMemory = vi.fn(async () => ({
      sourceKey: 'shell-history:/tmp/.zsh_history',
      strategy: 'incremental' as const,
      importedCount: 2,
      lastSyncedAt: '2026-03-20T09:05:00.000Z',
    }));
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents,
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge,
      listSkillDrafts,
      syncBrowserMemory,
      syncShellMemory,
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const healthResponse = await fetch(`${server.origin}/health`);
    const healthBody = await healthResponse.json();
    const memoryResponse = await fetch(`${server.origin}/memory`);
    const memoryBody = await memoryResponse.json();
    const knowledgeResponse = await fetch(`${server.origin}/knowledge`);
    const knowledgeBody = await knowledgeResponse.json();
    const skillsResponse = await fetch(`${server.origin}/skills`);
    const skillsBody = await skillsResponse.json();
    const syncResponse = await fetch(`${server.origin}/sync/browser`, {
      method: 'POST',
    });
    const syncBody = await syncResponse.json();
    const shellSyncResponse = await fetch(`${server.origin}/sync/shell`, {
      method: 'POST',
    });
    const shellSyncBody = await shellSyncResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthBody).toEqual({
      status: 'running',
      config: getMirrorBrainConfig(),
    });
    expect(memoryResponse.status).toBe(200);
    expect(memoryBody).toEqual({
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
    });
    expect(knowledgeResponse.status).toBe(200);
    expect(knowledgeBody).toEqual({
      items: [
        {
          id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
          draftState: 'draft',
          sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
        },
      ],
    });
    expect(skillsResponse.status).toBe(200);
    expect(skillsBody).toEqual({
      items: [
        {
          id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
          approvalState: 'draft',
          workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
          executionSafetyMetadata: {
            requiresConfirmation: true,
          },
        },
      ],
    });
    expect(syncResponse.status).toBe(202);
    expect(syncBody).toEqual({
      sync: {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental',
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
      },
    });
    expect(shellSyncResponse.status).toBe(202);
    expect(shellSyncBody).toEqual({
      sync: {
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental',
        importedCount: 2,
        lastSyncedAt: '2026-03-20T09:05:00.000Z',
      },
    });
  });

  it('serves theme-level memory retrieval results through a query endpoint', async () => {
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => []),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({
        timeRange: {
          startAt: '2026-03-20T00:00:00.000Z',
          endAt: '2026-03-20T23:59:59.999Z',
        },
        items: [
          {
            id: 'memory-result:activitywatch-browser-example-tasks',
            theme: 'Example Tasks',
            title: 'Example Tasks',
            summary:
              '1 matching memory event about Example Tasks during the requested time range.',
            timeRange: {
              startAt: '2026-03-20T08:00:00.000Z',
              endAt: '2026-03-20T08:00:00.000Z',
            },
            sourceRefs: [
              {
                id: 'browser:aw-event-1',
                sourceType: 'activitywatch-browser',
                sourceRef: 'aw-event-1',
                timestamp: '2026-03-20T08:00:00.000Z',
              },
            ],
          },
        ],
      })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
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
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const response = await fetch(`${server.origin}/memory/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What did I work on yesterday?',
        timeRange: {
          startAt: '2026-03-20T00:00:00.000Z',
          endAt: '2026-03-20T23:59:59.999Z',
        },
        sourceTypes: ['browser'],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      items: [
        {
          id: 'memory-result:activitywatch-browser-example-tasks',
          theme: 'Example Tasks',
          title: 'Example Tasks',
          summary:
            '1 matching memory event about Example Tasks during the requested time range.',
          timeRange: {
            startAt: '2026-03-20T08:00:00.000Z',
            endAt: '2026-03-20T08:00:00.000Z',
          },
          sourceRefs: [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
            },
          ],
        },
      ],
    });
    expect(service.queryMemory).toHaveBeenCalledWith({
      query: 'What did I work on yesterday?',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      sourceTypes: ['browser'],
    });
  });

  it('serves candidate review and artifact generation endpoints through the local HTTP API', async () => {
    const createDailyCandidateMemories = vi.fn(
      async (_reviewDate: string): Promise<CandidateMemory[]> => [
        createCandidateMemoryFixture({
          id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          memoryEventIds: ['browser:aw-event-1'],
        }),
        createCandidateMemoryFixture({
          id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
          memoryEventIds: ['browser:aw-event-2'],
        }),
      ],
    );
    const suggestCandidateReviews = vi.fn(
      async (_candidates: CandidateMemory[]): Promise<CandidateReviewSuggestion[]> => [
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
    const reviewCandidateMemory = vi.fn(
      async (
        candidate: CandidateMemory,
        _review: {
          decision: ReviewedMemory['decision'];
          reviewedAt: string;
        },
      ): Promise<ReviewedMemory> => createReviewedMemoryFixture(),
    );
    const generateKnowledgeFromReviewedMemories = vi.fn(
      async (reviewedMemories: ReviewedMemory[]): Promise<KnowledgeArtifact> => ({
        id: `knowledge-draft:${reviewedMemories[0]?.id ?? 'empty'}`,
        draftState: 'draft',
        sourceReviewedMemoryIds: reviewedMemories.map((memory) => memory.id),
      }),
    );
    const generateSkillDraftFromReviewedMemories = vi.fn(
      async (reviewedMemories: ReviewedMemory[]): Promise<SkillArtifact> => ({
        id: `skill-draft:${reviewedMemories[0]?.id ?? 'empty'}`,
        approvalState: 'draft',
        workflowEvidenceRefs: reviewedMemories.map((memory) => memory.id),
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      }),
    );
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => []),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
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
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories,
      suggestCandidateReviews,
      reviewCandidateMemory,
      generateKnowledgeFromReviewedMemories,
      generateSkillDraftFromReviewedMemories,
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const candidateResponse = await fetch(`${server.origin}/candidate-memories/daily`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reviewDate: '2026-03-20',
        reviewTimeZone: 'Asia/Shanghai',
      }),
    });
    const candidateBody = await candidateResponse.json();

    const suggestionResponse = await fetch(
      `${server.origin}/candidate-reviews/suggestions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          candidates: candidateBody.candidates,
        }),
      },
    );
    const suggestionBody = await suggestionResponse.json();

    const reviewResponse = await fetch(`${server.origin}/reviewed-memories`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        candidate: candidateBody.candidates[0],
        review: {
          decision: 'keep',
          reviewedAt: '2026-03-20T10:00:00.000Z',
        },
      }),
    });
    const reviewBody = await reviewResponse.json();
    const knowledgeResponse = await fetch(`${server.origin}/knowledge/generate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reviewedMemories: [createReviewedMemoryFixture()],
      }),
    });
    const knowledgeBody = await knowledgeResponse.json();
    const skillResponse = await fetch(`${server.origin}/skills/generate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reviewedMemories: [createReviewedMemoryFixture()],
      }),
    });
    const skillBody = await skillResponse.json();

    expect(candidateResponse.status).toBe(201);
    expect(candidateBody).toEqual({
      candidates: [
        createCandidateMemoryFixture({
          id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          memoryEventIds: ['browser:aw-event-1'],
        }),
        createCandidateMemoryFixture({
          id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
          memoryEventIds: ['browser:aw-event-2'],
        }),
      ],
    });
    expect(createDailyCandidateMemories).toHaveBeenCalledWith(
      '2026-03-20',
      'Asia/Shanghai',
    );
    expect(suggestionResponse.status).toBe(200);
    expect(suggestionBody).toEqual({
      suggestions: [
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
    });
    expect(reviewResponse.status).toBe(201);
    expect(reviewBody).toEqual({
      reviewedMemory: createReviewedMemoryFixture(),
    });
    expect(knowledgeResponse.status).toBe(201);
    expect(knowledgeBody).toEqual({
      artifact: {
        id: 'knowledge-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        draftState: 'draft',
        sourceReviewedMemoryIds: [
          'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        ],
      },
    });
    expect(skillResponse.status).toBe(201);
    expect(skillBody).toEqual({
      artifact: {
        id: 'skill-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        approvalState: 'draft',
        workflowEvidenceRefs: [
          'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        ],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    });
  });

  it('serves the standalone UI shell and static assets when a static directory is configured', async () => {
    const staticDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-http-static-'));

    writeFileSync(
      join(staticDir, 'index.html'),
      '<!doctype html><html><body><h1>MirrorBrain UI</h1></body></html>',
    );
    writeFileSync(join(staticDir, 'styles.css'), 'body { color: black; }');
    writeFileSync(join(staticDir, 'main.js'), 'console.log("mirrorbrain");');

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => []),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
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
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
      staticDir,
    });
    servers.push(server);

    const indexResponse = await fetch(`${server.origin}/`);
    const stylesResponse = await fetch(`${server.origin}/styles.css`);
    const mainResponse = await fetch(`${server.origin}/main.js`);

    expect(indexResponse.status).toBe(200);
    expect(await indexResponse.text()).toContain('MirrorBrain UI');
    expect(stylesResponse.status).toBe(200);
    expect(await stylesResponse.text()).toContain('color: black');
    expect(mainResponse.status).toBe(200);
    expect(await mainResponse.text()).toContain('mirrorbrain');
  });

  it('serves OpenAPI schema and Swagger UI docs for the local HTTP API', async () => {
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => []),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
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
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const docsResponse = await fetch(`${server.origin}/docs`);
    const schemaResponse = await fetch(`${server.origin}/openapi.json`);
    const schemaBody = await schemaResponse.json();

    expect(docsResponse.status).toBe(200);
    expect(await docsResponse.text()).toContain('Swagger UI');
    expect(schemaResponse.status).toBe(200);
    expect(schemaBody.openapi).toBe('3.0.3');
    expect(schemaBody.paths['/health']).toBeDefined();
    expect(schemaBody.paths['/sync/browser']).toBeDefined();
    expect(schemaBody.paths['/candidate-memories/daily']).toBeDefined();
    expect(schemaBody.paths['/candidate-reviews/suggestions']).toBeDefined();
  });

  it('hides static asset routes from the OpenAPI schema', async () => {
    const staticDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-http-static-'));

    writeFileSync(
      join(staticDir, 'index.html'),
      '<!doctype html><html><body><h1>MirrorBrain UI</h1></body></html>',
    );
    writeFileSync(join(staticDir, 'styles.css'), 'body { color: black; }');
    writeFileSync(join(staticDir, 'main.js'), 'console.log("mirrorbrain");');

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => []),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
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
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
      staticDir,
    });
    servers.push(server);

    const schemaResponse = await fetch(`${server.origin}/openapi.json`);
    const schemaBody = await schemaResponse.json();

    expect(schemaResponse.status).toBe(200);
    expect(schemaBody.paths['/']).toBeUndefined();
    expect(schemaBody.paths['/styles.css']).toBeUndefined();
    expect(schemaBody.paths['/main.js']).toBeUndefined();
    expect(schemaBody.paths['/health']).toBeDefined();
  });
});
