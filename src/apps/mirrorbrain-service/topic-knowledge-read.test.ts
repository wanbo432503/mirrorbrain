import { describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type { KnowledgeArtifact } from '../../shared/types/index.js';
import { createMirrorBrainService } from './index.js';

const currentBestTopic: KnowledgeArtifact = {
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
};

const supersededTopic: KnowledgeArtifact = {
  ...currentBestTopic,
  id: 'topic-knowledge:vitest-config:v1',
  summary: 'Older summary.',
  body: 'Older body.',
  version: 1,
  isCurrentBest: false,
  supersedesKnowledgeId: null,
  updatedAt: '2026-04-02T09:00:00.000Z',
  reviewedAt: '2026-04-02T09:00:00.000Z',
  recencyLabel: 'updated on 2026-04-02',
  sourceReviewedMemoryIds: ['reviewed:candidate:older'],
  derivedFromKnowledgeIds: ['knowledge-draft:older'],
  provenanceRefs: [
    { kind: 'reviewed-memory', id: 'reviewed:candidate:older' },
  ],
};

describe('mirrorbrain service topic knowledge read model', () => {
  it('lists current-best topic knowledge grouped by topic key', async () => {
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        listKnowledge: vi.fn(async () => [currentBestTopic, supersededTopic]),
      },
    );

    await expect(api.listKnowledgeTopics()).resolves.toEqual([
      {
        topicKey: 'vitest-config',
        title: 'Vitest Config',
        summary: 'Current best summary.',
        currentBestKnowledgeId: 'topic-knowledge:vitest-config:v2',
        updatedAt: '2026-04-03T09:00:00.000Z',
        recencyLabel: 'updated on 2026-04-03',
      },
    ]);
  });

  it('returns the current-best topic knowledge for a topic key', async () => {
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        listKnowledge: vi.fn(async () => [currentBestTopic, supersededTopic]),
      },
    );

    await expect(api.getKnowledgeTopic('vitest-config')).resolves.toEqual(currentBestTopic);
  });

  it('returns topic history ordered from newest to oldest', async () => {
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running' as const,
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn(),
        },
      },
      {
        listKnowledge: vi.fn(async () => [currentBestTopic, supersededTopic]),
      },
    );

    await expect(api.listKnowledgeHistory('vitest-config')).resolves.toEqual([
      currentBestTopic,
      supersededTopic,
    ]);
  });
});
