import { describe, expect, it } from 'vitest';

import {
  buildTopicKnowledgeCandidates,
  mergeDailyReviewIntoTopicKnowledge,
} from './index.js';
import type { KnowledgeArtifact } from '../../shared/types/index.js';

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
  recencyLabel: 'updated on 2026-04-03',
  provenanceRefs: [
    {
      kind: 'reviewed-memory',
      id: 'reviewed:candidate:browser:aw-event-1',
    },
  ],
};

describe('topic knowledge merge workflow', () => {
  it('builds topic merge candidates from daily-review drafts', () => {
    expect(
      buildTopicKnowledgeCandidates({
        knowledgeDrafts: [dailyReviewDraft],
      }),
    ).toEqual([
      {
        ...dailyReviewDraft,
        artifactType: 'topic-merge-candidate',
        id: 'topic-merge-candidate:vitest-config:knowledge-draft:reviewed:candidate:browser:aw-event-1',
        topicKey: 'vitest-config',
        derivedFromKnowledgeIds: ['knowledge-draft:reviewed:candidate:browser:aw-event-1'],
      },
    ]);
  });

  it('creates a new current-best topic when no existing topic matches', () => {
    const [candidate] = buildTopicKnowledgeCandidates({
      knowledgeDrafts: [dailyReviewDraft],
    });

    expect(
      mergeDailyReviewIntoTopicKnowledge({
        candidate,
        existingKnowledgeArtifacts: [],
      }),
    ).toEqual({
      decision: 'create-topic',
      artifact: {
        ...candidate,
        artifactType: 'topic-knowledge',
        id: 'topic-knowledge:vitest-config:v1',
        draftState: 'published',
        isCurrentBest: true,
        version: 1,
      },
    });
  });

  it('updates current-best topic knowledge and supersedes the previous version', () => {
    const [candidate] = buildTopicKnowledgeCandidates({
      knowledgeDrafts: [dailyReviewDraft],
    });
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
      recencyLabel: 'reviewed on 2026-04-02',
      provenanceRefs: [
        {
          kind: 'reviewed-memory',
          id: 'reviewed:candidate:older',
        },
      ],
    };

    expect(
      mergeDailyReviewIntoTopicKnowledge({
        candidate,
        existingKnowledgeArtifacts: [existingCurrentBest],
      }),
    ).toEqual({
      decision: 'update-current-best',
      artifact: {
        ...candidate,
        artifactType: 'topic-knowledge',
        id: 'topic-knowledge:vitest-config:v2',
        draftState: 'published',
        isCurrentBest: true,
        version: 2,
        supersedesKnowledgeId: 'topic-knowledge:vitest-config:v1',
      },
      supersededArtifact: {
        ...existingCurrentBest,
        isCurrentBest: false,
      },
    });
  });

  it('keeps weak candidates as drafts instead of publishing topic knowledge', () => {
    const weakCandidate: KnowledgeArtifact = {
      ...dailyReviewDraft,
      artifactType: 'topic-merge-candidate',
      id: 'topic-merge-candidate:vitest-config:weak',
      topicKey: 'vitest-config',
      body: 'Too short',
      sourceReviewedMemoryIds: [],
      provenanceRefs: [],
    };

    expect(
      mergeDailyReviewIntoTopicKnowledge({
        candidate: weakCandidate,
        existingKnowledgeArtifacts: [],
      }),
    ).toEqual({
      decision: 'keep-draft',
      artifact: weakCandidate,
    });
  });
});
