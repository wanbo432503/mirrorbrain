import { describe, expect, it } from 'vitest';

import type { KnowledgeArtifact } from '../../shared/types/index.js';
import { lintKnowledgeArtifacts } from './index.js';

describe('lintKnowledgeArtifacts', () => {
  it('updates knowledge relations and marks duplicated generated drafts for deletion', () => {
    const generatedDraft: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:new',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'mirrorbrain-review',
      title: 'MirrorBrain review flow',
      summary: 'Generate knowledge from reviewed memories.',
      body: 'MirrorBrain review candidates generate knowledge and refresh relations.',
      sourceReviewedMemoryIds: ['reviewed:memory:1'],
      tags: ['mirrorbrain', 'review'],
      updatedAt: '2026-05-11T01:00:00.000Z',
    };
    const duplicatedOlderDraft: KnowledgeArtifact = {
      ...generatedDraft,
      id: 'knowledge-draft:reviewed:candidate:browser:old',
      updatedAt: '2026-05-11T00:00:00.000Z',
    };
    const relatedKnowledge: KnowledgeArtifact = {
      id: 'topic-knowledge:openclaw-memory:v1',
      artifactType: 'topic-knowledge',
      draftState: 'published',
      topicKey: 'openclaw-memory',
      title: 'OpenClaw memory',
      summary: 'OpenClaw uses MirrorBrain memory retrieval.',
      body: 'OpenClaw can retrieve MirrorBrain knowledge and memory context.',
      sourceReviewedMemoryIds: ['reviewed:memory:2'],
      tags: ['mirrorbrain', 'openclaw'],
      relatedKnowledgeIds: [],
    };

    const plan = lintKnowledgeArtifacts({
      knowledgeArtifacts: [duplicatedOlderDraft, generatedDraft, relatedKnowledge],
      seedKnowledgeIds: [generatedDraft.id],
    });

    expect(plan.deleteArtifactIds).toEqual([duplicatedOlderDraft.id]);
    expect(plan.updateArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: generatedDraft.id,
          relatedKnowledgeIds: [relatedKnowledge.id],
        }),
        expect.objectContaining({
          id: relatedKnowledge.id,
          relatedKnowledgeIds: [generatedDraft.id],
        }),
      ]),
    );
  });

  it('creates merge candidates for similar non-duplicate knowledge instead of merging automatically', () => {
    const generatedDraft: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:new',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'mirrorbrain-review',
      title: 'MirrorBrain review flow',
      summary: 'Generate knowledge from reviewed memories.',
      body: 'MirrorBrain review candidates generate knowledge and refresh relations.',
      sourceReviewedMemoryIds: ['reviewed:memory:1'],
      tags: ['mirrorbrain', 'review'],
      updatedAt: '2026-05-11T01:00:00.000Z',
    };
    const similarPublishedKnowledge: KnowledgeArtifact = {
      id: 'topic-knowledge:mirrorbrain-review:v1',
      artifactType: 'topic-knowledge',
      draftState: 'published',
      topicKey: 'mirrorbrain-review',
      title: 'MirrorBrain candidate review',
      summary: 'Review candidates before publishing knowledge.',
      body: 'MirrorBrain review candidates should be human approved.',
      sourceReviewedMemoryIds: ['reviewed:memory:2'],
      tags: ['mirrorbrain', 'review'],
      version: 1,
      isCurrentBest: true,
      updatedAt: '2026-05-10T01:00:00.000Z',
    };

    const plan = lintKnowledgeArtifacts({
      knowledgeArtifacts: [generatedDraft, similarPublishedKnowledge],
      seedKnowledgeIds: [generatedDraft.id],
    });

    expect(plan.mergeCandidateArtifacts).toEqual([
      expect.objectContaining({
        artifactType: 'topic-merge-candidate',
        draftState: 'draft',
        topicKey: 'mirrorbrain-review',
        derivedFromKnowledgeIds: [
          generatedDraft.id,
          similarPublishedKnowledge.id,
        ],
      }),
    ]);
    expect(plan.deleteArtifactIds).toEqual([]);
  });
});
