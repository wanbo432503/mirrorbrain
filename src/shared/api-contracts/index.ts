export const knowledgeArtifactDtoSchema = {
  type: 'object',
  properties: {
    artifactType: {
      type: 'string',
      enum: ['daily-review-draft', 'topic-merge-candidate', 'topic-knowledge'],
    },
    id: { type: 'string' },
    draftState: { type: 'string', enum: ['draft', 'published'] },
    topicKey: { type: ['string', 'null'] },
    title: { type: 'string' },
    summary: { type: 'string' },
    body: { type: 'string' },
    sourceReviewedMemoryIds: {
      type: 'array',
      items: { type: 'string' },
    },
    derivedFromKnowledgeIds: {
      type: 'array',
      items: { type: 'string' },
    },
    version: { type: 'number' },
    isCurrentBest: { type: 'boolean' },
    supersedesKnowledgeId: { type: ['string', 'null'] },
    updatedAt: { type: 'string' },
    reviewedAt: { type: ['string', 'null'] },
    recencyLabel: { type: 'string' },
    provenanceRefs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['reviewed-memory', 'knowledge-artifact'],
          },
          id: { type: 'string' },
        },
        required: ['kind', 'id'],
      },
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    relatedKnowledgeIds: {
      type: 'array',
      items: { type: 'string' },
    },
    compilationMetadata: {
      type: 'object',
      properties: {
        discoveryInsights: {
          type: 'array',
          items: { type: 'string' },
        },
        generationMethod: {
          type: 'string',
          enum: ['two-stage-compilation', 'legacy'],
        },
        discoveryStageCompletedAt: { type: 'string' },
        executeStageCompletedAt: { type: 'string' },
      },
      required: ['discoveryInsights', 'generationMethod'],
    },
  },
  required: ['id', 'draftState', 'sourceReviewedMemoryIds'],
} as const;
