import { describe, expect, it } from 'vitest';

import {
  knowledgeArtifactDtoSchema,
  skillArtifactDtoSchema,
} from './index.js';

describe('api contracts', () => {
  it('keeps knowledge artifact HTTP response required fields aligned with the domain type', () => {
    expect(knowledgeArtifactDtoSchema.required).toEqual([
      'id',
      'draftState',
      'sourceReviewedMemoryIds',
    ]);
  });

  it('declares optional knowledge artifact enrichment fields so response serialization preserves them', () => {
    expect(knowledgeArtifactDtoSchema.properties).toHaveProperty('tags');
    expect(knowledgeArtifactDtoSchema.properties).toHaveProperty(
      'relatedKnowledgeIds',
    );
    expect(knowledgeArtifactDtoSchema.properties).toHaveProperty(
      'compilationMetadata',
    );
  });

  it('declares optional skill artifact review timestamps so response serialization preserves them', () => {
    expect(skillArtifactDtoSchema.required).toEqual([
      'id',
      'approvalState',
      'workflowEvidenceRefs',
      'executionSafetyMetadata',
    ]);
    expect(skillArtifactDtoSchema.properties).toHaveProperty('updatedAt');
    expect(skillArtifactDtoSchema.properties).toHaveProperty('reviewedAt');
  });
});
