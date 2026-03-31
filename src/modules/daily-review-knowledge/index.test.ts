import { describe, expect, it } from 'vitest';

import { createKnowledgeDraft } from './index.js';

describe('daily review knowledge', () => {
  it('creates a knowledge draft from reviewed memory only', () => {
    expect(
      createKnowledgeDraft({
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
      draftState: 'draft',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
    });
  });
});
