import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type { KnowledgeArtifact } from '../../shared/types/index.js';
import { startMirrorBrainHttpServer } from './index.js';

describe('mirrorbrain http server topic knowledge endpoints', () => {
  const servers: Array<{ stop(): Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      if (server) {
        await server.stop();
      }
    }
  });

  it('serves topic knowledge list, detail, and history endpoints', async () => {
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      listMemoryEvents: vi.fn(async () => ({ items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 } })),
      queryMemory: vi.fn(async () => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listKnowledgeTopics: vi.fn(async () => [
        {
          topicKey: 'vitest-config',
          title: 'Vitest Config',
          summary: 'Current best summary.',
          currentBestKnowledgeId: 'topic-knowledge:vitest-config:v2',
          updatedAt: '2026-04-03T09:00:00.000Z',
          recencyLabel: 'updated on 2026-04-03',
        },
      ]),
      getKnowledgeTopic: vi.fn(async (): Promise<KnowledgeArtifact> => ({
        artifactType: 'topic-knowledge',
        id: 'topic-knowledge:vitest-config:v2',
        draftState: 'published',
        topicKey: 'vitest-config',
        title: 'Vitest Config',
        summary: 'Current best summary.',
        body: 'Current best body.',
        sourceReviewedMemoryIds: ['reviewed:candidate:new'],
        derivedFromKnowledgeIds: ['knowledge-draft:new'],
        version: 2,
        isCurrentBest: true,
        supersedesKnowledgeId: 'topic-knowledge:vitest-config:v1',
        updatedAt: '2026-04-03T09:00:00.000Z',
        reviewedAt: '2026-04-03T09:00:00.000Z',
        recencyLabel: 'updated on 2026-04-03',
        provenanceRefs: [
          { kind: 'reviewed-memory', id: 'reviewed:candidate:new' },
        ],
      })),
      listKnowledgeHistory: vi.fn(async (): Promise<KnowledgeArtifact[]> => [
        {
          artifactType: 'topic-knowledge',
          id: 'topic-knowledge:vitest-config:v2',
          draftState: 'published',
          topicKey: 'vitest-config',
          title: 'Vitest Config',
          summary: 'Current best summary.',
          body: 'Current best body.',
          sourceReviewedMemoryIds: ['reviewed:candidate:new'],
          derivedFromKnowledgeIds: ['knowledge-draft:new'],
          version: 2,
          isCurrentBest: true,
          supersedesKnowledgeId: 'topic-knowledge:vitest-config:v1',
          updatedAt: '2026-04-03T09:00:00.000Z',
          reviewedAt: '2026-04-03T09:00:00.000Z',
          recencyLabel: 'updated on 2026-04-03',
          provenanceRefs: [
            { kind: 'reviewed-memory', id: 'reviewed:candidate:new' },
          ],
        },
        {
          artifactType: 'topic-knowledge',
          id: 'topic-knowledge:vitest-config:v1',
          draftState: 'published',
          topicKey: 'vitest-config',
          title: 'Vitest Config',
          summary: 'Older summary.',
          body: 'Older body.',
          sourceReviewedMemoryIds: ['reviewed:candidate:older'],
          derivedFromKnowledgeIds: ['knowledge-draft:older'],
          version: 1,
          isCurrentBest: false,
          supersedesKnowledgeId: null,
          updatedAt: '2026-04-02T09:00:00.000Z',
          reviewedAt: '2026-04-02T09:00:00.000Z',
          recencyLabel: 'updated on 2026-04-02',
          provenanceRefs: [
            { kind: 'reviewed-memory', id: 'reviewed:candidate:older' },
          ],
        },
      ]),
      listSkillDrafts: vi.fn(async () => []),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({ service, port: 0 });
    servers.push(server);

    const topicsResponse = await fetch(`${server.origin}/knowledge/topics`);
    const topicsBody = await topicsResponse.json();
    const topicResponse = await fetch(`${server.origin}/knowledge/topics/vitest-config`);
    const topicBody = await topicResponse.json();
    const historyResponse = await fetch(`${server.origin}/knowledge/topics/vitest-config/history`);
    const historyBody = await historyResponse.json();

    expect(topicsResponse.status).toBe(200);
    expect(topicsBody).toEqual({
      items: [
        {
          topicKey: 'vitest-config',
          title: 'Vitest Config',
          summary: 'Current best summary.',
          currentBestKnowledgeId: 'topic-knowledge:vitest-config:v2',
          updatedAt: '2026-04-03T09:00:00.000Z',
          recencyLabel: 'updated on 2026-04-03',
        },
      ],
    });
    expect(topicResponse.status).toBe(200);
    expect(topicBody.topic.id).toBe('topic-knowledge:vitest-config:v2');
    expect(historyResponse.status).toBe(200);
    expect(historyBody.items).toHaveLength(2);
    expect(historyBody.items[0].id).toBe('topic-knowledge:vitest-config:v2');
  });
});
