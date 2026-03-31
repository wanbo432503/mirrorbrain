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
