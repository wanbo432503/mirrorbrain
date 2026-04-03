import { describe, expect, it } from 'vitest';

import type { KnowledgeArtifact } from '../../shared/types/index.js';
import { evaluateTopicKnowledgeQuality } from './index.js';

const dailyReviewDraft: KnowledgeArtifact = {
  artifactType: 'daily-review-draft',
  id: 'knowledge-draft:vitest-config',
  draftState: 'draft',
  topicKey: null,
  title: 'Vitest Config',
  summary: 'Draft summary.',
  body: 'Short draft body.',
  sourceReviewedMemoryIds: ['reviewed:1'],
  derivedFromKnowledgeIds: [],
  version: 1,
  isCurrentBest: false,
  supersedesKnowledgeId: null,
  updatedAt: '2026-04-03T09:00:00.000Z',
  reviewedAt: '2026-04-03T09:00:00.000Z',
  recencyLabel: 'reviewed on 2026-04-03',
  provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed:1' }],
};

const currentBestTopic: KnowledgeArtifact = {
  artifactType: 'topic-knowledge',
  id: 'topic-knowledge:vitest-config:v2',
  draftState: 'published',
  topicKey: 'vitest-config',
  title: 'Vitest Config',
  summary: 'Current best summary for Vitest Config migration decisions.',
  body: [
    'Problem',
    '',
    'Vitest configuration needed consistent ESM handling across the MirrorBrain service and tests.',
    '',
    'Current best approach',
    '',
    'Prefer one shared Vitest config path and keep fixture-driven verification in place for regression checks.',
  ].join('\n'),
  sourceReviewedMemoryIds: ['reviewed:1', 'reviewed:2'],
  derivedFromKnowledgeIds: ['knowledge-draft:vitest-config'],
  version: 2,
  isCurrentBest: true,
  supersedesKnowledgeId: 'topic-knowledge:vitest-config:v1',
  updatedAt: '2026-04-04T09:00:00.000Z',
  reviewedAt: '2026-04-04T09:00:00.000Z',
  recencyLabel: 'updated on 2026-04-04',
  provenanceRefs: [
    { kind: 'reviewed-memory', id: 'reviewed:1' },
    { kind: 'reviewed-memory', id: 'reviewed:2' },
    { kind: 'knowledge-artifact', id: 'topic-knowledge:vitest-config:v1' },
  ],
};

describe('topic knowledge quality evaluation', () => {
  it('returns structured rubric scores and passes a strong current-best topic artifact', () => {
    expect(
      evaluateTopicKnowledgeQuality({
        fixtureName: 'single-topic-multi-day',
        dailyReviewDraft,
        currentBestTopic,
        history: [currentBestTopic],
      }),
    ).toEqual({
      fixtureName: 'single-topic-multi-day',
      pass: true,
      scores: {
        summarizationFidelity: 4,
        structureAndReasoning: 4,
        futureUsefulness: 4,
        provenanceCompleteness: 4,
        recencyClarity: 4,
      },
      comparisons: {
        currentBestAtLeastAsReadableAsDraft: true,
        provenanceRetained: true,
        historyRetained: true,
      },
      notes: [],
    });
  });

  it('fails when provenance or history is missing', () => {
    expect(
      evaluateTopicKnowledgeQuality({
        fixtureName: 'rewrite-without-history',
        dailyReviewDraft,
        currentBestTopic: {
          ...currentBestTopic,
          provenanceRefs: [],
        },
        history: [],
      }),
    ).toEqual({
      fixtureName: 'rewrite-without-history',
      pass: false,
      scores: {
        summarizationFidelity: 4,
        structureAndReasoning: 4,
        futureUsefulness: 4,
        provenanceCompleteness: 0,
        recencyClarity: 4,
      },
      comparisons: {
        currentBestAtLeastAsReadableAsDraft: true,
        provenanceRetained: false,
        historyRetained: false,
      },
      notes: [
        'Current-best topic knowledge lost provenance references.',
        'Topic history is empty for this fixture.',
      ],
    });
  });
});
