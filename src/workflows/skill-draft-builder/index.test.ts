import { describe, expect, it } from 'vitest';

import { buildSkillDraftFromReviewedMemories } from './index.js';

describe('skill draft builder', () => {
  it('creates a skill draft from repeated reviewed workflow evidence', () => {
    expect(
      buildSkillDraftFromReviewedMemories([
        {
          id: 'reviewed:candidate:browser:aw-event-1',
          candidateMemoryId: 'candidate:browser:aw-event-1',
          decision: 'keep',
        },
        {
          id: 'reviewed:candidate:browser:aw-event-2',
          candidateMemoryId: 'candidate:browser:aw-event-2',
          decision: 'keep',
        },
      ]),
    ).toMatchObject({
      approvalState: 'draft',
      workflowEvidenceRefs: [
        'reviewed:candidate:browser:aw-event-1',
        'reviewed:candidate:browser:aw-event-2',
      ],
    });
  });
});
