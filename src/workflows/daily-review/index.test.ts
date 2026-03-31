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
            decision: 'keep',
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
