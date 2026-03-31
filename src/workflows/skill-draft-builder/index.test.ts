import { describe, expect, it } from 'vitest';

import { buildSkillDraftFromReviewedMemories } from './index.js';

describe('skill draft builder', () => {
  it('creates a skill draft from repeated reviewed workflow evidence', () => {
    expect(
      buildSkillDraftFromReviewedMemories([
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
        {
          id: 'reviewed:candidate:browser:aw-event-2',
          candidateMemoryId: 'candidate:browser:aw-event-2',
          candidateTitle: 'Example Com / issues',
          candidateSummary: '1 browser event about Example Com / issues on 2026-03-20.',
          candidateTheme: 'example.com / issues',
          memoryEventIds: ['browser:aw-event-2'],
          reviewDate: '2026-03-20',
          decision: 'keep',
          reviewedAt: '2026-03-20T10:05:00.000Z',
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
