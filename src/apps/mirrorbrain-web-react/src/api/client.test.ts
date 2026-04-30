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
});
