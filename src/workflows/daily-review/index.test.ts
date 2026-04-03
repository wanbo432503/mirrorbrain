import { describe, expect, it } from 'vitest';

import { runDailyReview } from './index.js';

describe('daily review workflow', () => {
  it('returns a draft knowledge artifact with provenance', () => {
    expect(
      runDailyReview({
        reviewedMemories: [
          {
            id: 'reviewed:candidate:browser:aw-event-1',
            candidateMemoryId: 'candidate:browser:aw-event-1',
            candidateTitle: 'Example Com / tasks',
            candidateSummary: '1 browser event about Example Com / tasks on 2026-03-20.',
            candidateTheme: 'example.com / tasks',
            memoryEventIds: ['browser:aw-event-1'],
            reviewDate: '2026-03-20',
            decision: 'keep',
            reviewedAt: '2026-03-20T10:00:00.000Z',
          },
        ],
      }),
    ).toMatchObject({
      id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'example-com-tasks',
      title: 'Example Com / tasks',
      summary: '1 reviewed memory about Example Com / tasks from 2026-03-20.',
      body: '- Example Com / tasks: 1 browser event about Example Com / tasks on 2026-03-20.',
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      derivedFromKnowledgeIds: [],
      reviewedAt: '2026-03-20T10:00:00.000Z',
      recencyLabel: '2026-03-20',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      provenanceRefs: [
        {
          kind: 'reviewed-memory',
          id: 'reviewed:candidate:browser:aw-event-1',
        },
      ],
    });
  });
});
