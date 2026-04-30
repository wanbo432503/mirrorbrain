import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type { KnowledgeArtifact } from '../../shared/types/index.js';
import { createMirrorBrainService } from './index.js';

const dailyReviewDraft: KnowledgeArtifact = {
  artifactType: 'daily-review-draft',
  id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
  draftState: 'draft',
  topicKey: null,
  title: 'Vitest Config',
  summary: 'Daily review draft for Vitest Config.',
  body: 'You investigated Vitest configuration choices for the MirrorBrain service.',
  sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
  derivedFromKnowledgeIds: [],
  version: 1,
  isCurrentBest: false,
  supersedesKnowledgeId: null,
  updatedAt: '2026-04-03T01:00:00.000Z',
  reviewedAt: '2026-04-03T01:00:00.000Z',
  recencyLabel: 'reviewed on 2026-04-03',
  provenanceRefs: [
    {
      kind: 'reviewed-memory',
      id: 'reviewed:candidate:browser:aw-event-1',
    },
  ],
};

describe('mirrorbrain service topic knowledge merge', () => {
  it('builds topic merge candidates from daily-review drafts through the service contract', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-service-'));
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
        listKnowledge: vi.fn(async () => [dailyReviewDraft]),
      },
    );

    await expect(api.buildTopicKnowledgeCandidates()).resolves.toEqual([
      {
        ...dailyReviewDraft,
        artifactType: 'topic-merge-candidate',
        id: 'topic-merge-candidate:vitest-config:knowledge-draft:reviewed:candidate:browser:aw-event-1',
        topicKey: 'vitest-config',
        derivedFromKnowledgeIds: ['knowledge-draft:reviewed:candidate:browser:aw-event-1'],
      },
    ]);
  });

  it('merges a topic candidate and publishes current-best plus superseded history', async () => {
    const existingCurrentBest: KnowledgeArtifact = {
      artifactType: 'topic-knowledge',
      id: 'topic-knowledge:vitest-config:v1',
      draftState: 'published',
      topicKey: 'vitest-config',
      title: 'Vitest Config',
      summary: 'Earlier summary.',
      body: 'Earlier body.',
      sourceReviewedMemoryIds: ['reviewed:candidate:older'],
      derivedFromKnowledgeIds: ['knowledge-draft:older'],
      version: 1,
      isCurrentBest: true,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-02T01:00:00.000Z',
      reviewedAt: '2026-04-02T01:00:00.000Z',
      recencyLabel: 'updated on 2026-04-02',
      provenanceRefs: [
        {
          kind: 'reviewed-memory',
          id: 'reviewed:candidate:older',
        },
      ],
    };
    const publishKnowledge = vi.fn(async () => ({
      sourcePath: '/tmp/knowledge.md',
      rootUri: 'viking://resources/topic-knowledge',
    }));
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-service-'));
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
        listKnowledge: vi.fn(async () => [existingCurrentBest]),
        publishKnowledge,
      },
    );

    await expect(
      api.mergeTopicKnowledgeCandidate({
        ...dailyReviewDraft,
        artifactType: 'topic-merge-candidate',
        id: 'topic-merge-candidate:vitest-config:knowledge-draft:reviewed:candidate:browser:aw-event-1',
        topicKey: 'vitest-config',
        derivedFromKnowledgeIds: ['knowledge-draft:reviewed:candidate:browser:aw-event-1'],
      }),
    ).resolves.toEqual({
      decision: 'update-current-best',
      artifact: {
        ...dailyReviewDraft,
        artifactType: 'topic-knowledge',
        id: 'topic-knowledge:vitest-config:v2',
        topicKey: 'vitest-config',
        draftState: 'published',
        derivedFromKnowledgeIds: ['knowledge-draft:reviewed:candidate:browser:aw-event-1'],
        version: 2,
        isCurrentBest: true,
        supersedesKnowledgeId: 'topic-knowledge:vitest-config:v1',
        recencyLabel: 'updated on 2026-04-03',
      },
      supersededArtifact: {
        ...existingCurrentBest,
        isCurrentBest: false,
      },
    });

    expect(publishKnowledge).toHaveBeenCalledTimes(2);
  });

  it('publishes the superseded topic artifact before the new current-best version on update', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-service-'));
    const existingCurrentBest: KnowledgeArtifact = {
      artifactType: 'topic-knowledge',
      id: 'topic-knowledge:vitest-config:v1',
      draftState: 'published',
      topicKey: 'vitest-config',
      title: 'Vitest Config',
      summary: 'Earlier summary.',
      body: 'Earlier body with enough detail.',
      sourceReviewedMemoryIds: ['reviewed:candidate:older'],
      derivedFromKnowledgeIds: ['knowledge-draft:older'],
      version: 1,
      isCurrentBest: true,
      supersedesKnowledgeId: null,
      updatedAt: '2026-03-20T10:00:00.000Z',
      reviewedAt: '2026-03-20T10:00:00.000Z',
      recencyLabel: '2026-03-20',
      provenanceRefs: [
        {
          kind: 'reviewed-memory',
          id: 'reviewed:candidate:older',
        },
      ],
    };
    const publishKnowledge = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain/knowledge/topic.md',
      rootUri: 'viking://resources/mirrorbrain/knowledge/topic.md',
    }));

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
        listMemoryEvents: vi.fn(async () => ({
          items: [],
          pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
        })),
        listKnowledge: vi.fn(async () => [dailyReviewDraft, existingCurrentBest]),
        listSkillDrafts: vi.fn(async () => []),
        queryMemory: vi.fn(async () => ({ items: [] })),
        publishKnowledge,
      },
    );

    const [candidate] = await api.buildTopicKnowledgeCandidates();
    const published = await api.mergeTopicKnowledgeCandidate(
      candidate,
      '2026-03-21T09:00:00.000Z',
    );

    expect(published.artifact.id).toBe('topic-knowledge:vitest-config:v2');
    expect(publishKnowledge).toHaveBeenNthCalledWith(1, {
      baseUrl: getMirrorBrainConfig().openViking.baseUrl,
      workspaceDir,
      artifact: expect.objectContaining({
        id: 'topic-knowledge:vitest-config:v1',
        isCurrentBest: false,
      }),
    });
    expect(publishKnowledge).toHaveBeenNthCalledWith(2, {
      baseUrl: getMirrorBrainConfig().openViking.baseUrl,
      workspaceDir,
      artifact: published.artifact,
    });
  });
});
