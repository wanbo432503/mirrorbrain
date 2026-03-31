import { describe, expect, it } from 'vitest';

import {
  approveSkillDraft,
  createSkillDraft,
} from './index.js';

describe('skill draft management', () => {
  it('creates a skill draft from workflow evidence', () => {
    expect(
      createSkillDraft({
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
      }),
    ).toMatchObject({
      id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
      executionSafetyMetadata: {
        requiresConfirmation: true,
      },
    });
  });

  it('keeps approval separate from execution safety', () => {
    expect(
      approveSkillDraft(
        createSkillDraft({
          workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        }),
      ),
    ).toMatchObject({
      approvalState: 'approved',
      executionSafetyMetadata: {
        requiresConfirmation: true,
      },
    });
  });
});
