export const skillArtifactDtoSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    approvalState: { type: 'string', enum: ['draft', 'approved'] },
    workflowEvidenceRefs: {
      type: 'array',
      items: { type: 'string' },
    },
    executionSafetyMetadata: {
      type: 'object',
      properties: {
        requiresConfirmation: { type: 'boolean' },
      },
      required: ['requiresConfirmation'],
    },
    updatedAt: { type: 'string' },
    reviewedAt: { type: ['string', 'null'] },
  },
  required: [
    'id',
    'approvalState',
    'workflowEvidenceRefs',
    'executionSafetyMetadata',
  ],
} as const;
