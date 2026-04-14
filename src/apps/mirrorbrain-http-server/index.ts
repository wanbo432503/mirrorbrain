import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type {
  CandidateMemory,
  CandidateReviewSuggestion,
  KnowledgeArtifact,
  MemoryQueryInput,
  MemoryQueryResult,
  MemoryEvent,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';

interface MirrorBrainHttpService {
  service: {
    status: 'running' | 'stopped';
    config?: ReturnType<typeof getMirrorBrainConfig>;
  };
  syncBrowserMemory(): Promise<unknown>;
  syncShellMemory(): Promise<unknown>;
  listMemoryEvents(): Promise<MemoryEvent[]>;
  queryMemory?(input: MemoryQueryInput): Promise<MemoryQueryResult>;
  listKnowledge(): Promise<KnowledgeArtifact[]>;
  listKnowledgeTopics?(): Promise<
    Array<{
      topicKey: string;
      title: string;
      summary: string;
      currentBestKnowledgeId: string;
      updatedAt?: string;
      recencyLabel: string;
    }>
  >;
  getKnowledgeTopic?(topicKey: string): Promise<KnowledgeArtifact | null>;
  listKnowledgeHistory?(topicKey: string): Promise<KnowledgeArtifact[]>;
  listSkillDrafts(): Promise<SkillArtifact[]>;
  publishKnowledge?(artifact: KnowledgeArtifact): Promise<unknown>;
  publishSkillDraft?(artifact: SkillArtifact): Promise<unknown>;
  createDailyCandidateMemories(
    reviewDate: string,
    reviewTimeZone?: string,
  ): Promise<CandidateMemory[]>;
  suggestCandidateReviews(
    candidates: CandidateMemory[],
  ): Promise<CandidateReviewSuggestion[]>;
  reviewCandidateMemory(
    candidate: CandidateMemory,
    review: {
      decision: ReviewedMemory['decision'];
      reviewedAt: string;
    },
  ): Promise<ReviewedMemory>;
  generateKnowledgeFromReviewedMemories(
    reviewedMemories: ReviewedMemory[],
  ): Promise<KnowledgeArtifact>;
  generateSkillDraftFromReviewedMemories(
    reviewedMemories: ReviewedMemory[],
  ): Promise<SkillArtifact>;
}

interface StartMirrorBrainHttpServerInput {
  service: MirrorBrainHttpService;
  host?: string;
  port?: number;
  staticDir?: string;
}

interface MirrorBrainHttpServer {
  origin: string;
  host: string;
  port: number;
  stop(): Promise<void>;
}

const authorizationScopeSchema = {
  type: 'object',
  properties: {
    upstreamSource: { type: 'string' },
    checkpoint: { type: 'string' },
  },
  required: ['upstreamSource', 'checkpoint'],
} as const;

const memoryEventSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sourceType: { type: 'string' },
    sourceRef: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    timestamp: { type: 'string' },
    authorizationScopeId: { type: 'string' },
    content: {
      type: 'object',
      additionalProperties: true,
    },
    captureMetadata: authorizationScopeSchema,
  },
  required: [
    'id',
    'sourceType',
    'sourceRef',
    'timestamp',
    'authorizationScopeId',
    'content',
    'captureMetadata',
  ],
} as const;

const memoryTimeRangeSchema = {
  type: 'object',
  properties: {
    startAt: { type: 'string' },
    endAt: { type: 'string' },
  },
  required: ['startAt', 'endAt'],
} as const;

const memoryQuerySourceRefSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sourceType: { type: 'string' },
    sourceRef: { type: 'string' },
    timestamp: { type: 'string' },
  },
  required: ['id', 'sourceType', 'sourceRef', 'timestamp'],
} as const;

const memoryQueryItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    theme: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string' },
    timeRange: memoryTimeRangeSchema,
    sourceRefs: {
      type: 'array',
      items: memoryQuerySourceRefSchema,
    },
  },
  required: ['id', 'theme', 'title', 'summary', 'timeRange', 'sourceRefs'],
} as const;

const memoryQueryRequestSchema = {
  type: 'object',
  properties: {
    query: { type: 'string' },
    timeRange: memoryTimeRangeSchema,
    sourceTypes: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['browser', 'shell', 'openclaw-conversation'],
      },
    },
  },
  required: ['query'],
} as const;

const memoryQueryResponseSchema = {
  type: 'object',
  properties: {
    timeRange: memoryTimeRangeSchema,
    explanation: { type: 'string' },
    items: {
      type: 'array',
      items: memoryQueryItemSchema,
    },
  },
  required: ['items'],
} as const;

const candidateMemorySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    memoryEventIds: {
      type: 'array',
      items: { type: 'string' },
    },
    sourceRefs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          sourceType: { type: 'string' },
          timestamp: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['id', 'sourceType', 'timestamp'],
      },
    },
    title: { type: 'string' },
    summary: { type: 'string' },
    theme: { type: 'string' },
    reviewDate: { type: 'string' },
    timeRange: {
      type: 'object',
      properties: {
        startAt: { type: 'string' },
        endAt: { type: 'string' },
      },
      required: ['startAt', 'endAt'],
    },
    reviewState: { type: 'string', enum: ['pending'] },
  },
  required: [
    'id',
    'memoryEventIds',
    'title',
    'summary',
    'theme',
    'reviewDate',
    'timeRange',
    'reviewState',
  ],
} as const;

const reviewedMemorySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    candidateMemoryId: { type: 'string' },
    candidateTitle: { type: 'string' },
    candidateSummary: { type: 'string' },
    candidateTheme: { type: 'string' },
    memoryEventIds: {
      type: 'array',
      items: { type: 'string' },
    },
    reviewDate: { type: 'string' },
    decision: { type: 'string', enum: ['keep', 'discard'] },
    reviewedAt: { type: 'string' },
  },
  required: [
    'id',
    'candidateMemoryId',
    'candidateTitle',
    'candidateSummary',
    'candidateTheme',
    'memoryEventIds',
    'reviewDate',
    'decision',
    'reviewedAt',
  ],
} as const;

const candidateReviewSuggestionSchema = {
  type: 'object',
  properties: {
    candidateMemoryId: { type: 'string' },
    recommendation: {
      type: 'string',
      enum: ['keep', 'discard', 'review'],
    },
    confidenceScore: { type: 'number' },
    keepScore: { type: 'number' },
    priorityScore: { type: 'number' },
    rationale: { type: 'string' },
    supportingReasons: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'candidateMemoryId',
    'recommendation',
    'confidenceScore',
    'priorityScore',
    'rationale',
  ],
} as const;

const knowledgeArtifactSchema = {
  type: 'object',
  properties: {
    artifactType: {
      type: 'string',
      enum: ['daily-review-draft', 'topic-merge-candidate', 'topic-knowledge'],
    },
    id: { type: 'string' },
    draftState: { type: 'string', enum: ['draft', 'published'] },
    topicKey: { anyOf: [{ type: 'string' }, { type: 'null' }] },
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
    supersedesKnowledgeId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    updatedAt: { type: 'string' },
    reviewedAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
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
  },
  required: [
    'artifactType',
    'id',
    'draftState',
    'topicKey',
    'title',
    'summary',
    'body',
    'sourceReviewedMemoryIds',
    'derivedFromKnowledgeIds',
    'version',
    'isCurrentBest',
    'supersedesKnowledgeId',
    'reviewedAt',
    'recencyLabel',
    'provenanceRefs',
  ],
} as const;

const knowledgeTopicSummarySchema = {
  type: 'object',
  properties: {
    topicKey: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string' },
    currentBestKnowledgeId: { type: 'string' },
    updatedAt: { type: 'string' },
    recencyLabel: { type: 'string' },
  },
  required: [
    'topicKey',
    'title',
    'summary',
    'currentBestKnowledgeId',
    'recencyLabel',
  ],
} as const;

const skillArtifactSchema = {
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
  },
  required: [
    'id',
    'approvalState',
    'workflowEvidenceRefs',
    'executionSafetyMetadata',
  ],
} as const;

const browserSyncSummarySchema = {
  type: 'object',
  properties: {
    sourceKey: { type: 'string' },
    strategy: { type: 'string', enum: ['initial-backfill', 'incremental'] },
    importedCount: { type: 'number' },
    lastSyncedAt: { type: 'string' },
    importedEvents: {
      type: 'array',
      items: memoryEventSchema,
    },
  },
  required: ['sourceKey', 'strategy', 'importedCount', 'lastSyncedAt'],
} as const;

function createItemsResponseSchema(itemSchema: Record<string, unknown>) {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: itemSchema,
      },
    },
    required: ['items'],
  } as const;
}

function createArtifactResponseSchema(
  key: string,
  schema: Record<string, unknown>,
) {
  return {
    type: 'object',
    properties: {
      [key]: schema,
    },
    required: [key],
  } as const;
}

export async function startMirrorBrainHttpServer(
  input: StartMirrorBrainHttpServerInput,
): Promise<MirrorBrainHttpServer> {
  const config = input.service.service.config ?? getMirrorBrainConfig();
  const host = input.host ?? config.service.host;
  const port = input.port ?? config.service.port;
  const app = Fastify();

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'MirrorBrain Local API',
        version: '0.1.0',
        description:
          'Local-first MirrorBrain Phase 1 API for memory sync, review, knowledge, and skill flows.',
      },
    },
  });
  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  if (input.staticDir !== undefined) {
    // Serve React webui static files using @fastify/static
    await app.register(fastifyStatic, {
      root: input.staticDir,
      prefix: '/',
      decorateReply: true,
      serve: true,
    });

    // Fallback to index.html for SPA routing
    app.setNotFoundHandler((request, reply) => {
      reply.type('text/html; charset=utf-8');
      return readFile(join(input.staticDir!, 'index.html'), 'utf8');
    });
  }

  app.get(
    '/openapi.json',
    {
      schema: {
        hide: true,
      },
    },
    async () => app.swagger(),
  );

  app.get(
    '/health',
    {
      schema: {
        summary: 'Get service health',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['running', 'stopped'] },
              config: {
                type: 'object',
                additionalProperties: true,
              },
            },
            required: ['status', 'config'],
          },
        },
      },
    },
    async () => ({
      status: input.service.service.status,
      config,
    }),
  );

  app.get(
    '/memory',
    {
      schema: {
        summary: 'List imported memory events',
        response: {
          200: createItemsResponseSchema(memoryEventSchema),
        },
      },
    },
    async () => ({
      items: await input.service.listMemoryEvents(),
    }),
  );

  app.post<{
    Body: MemoryQueryInput;
  }>(
    '/memory/query',
    {
      schema: {
        summary: 'Query theme-level memory retrieval results',
        body: memoryQueryRequestSchema,
        response: {
          200: memoryQueryResponseSchema,
        },
      },
    },
    async (request) =>
      input.service.queryMemory
        ? input.service.queryMemory(request.body)
        : {
            items: [],
          },
  );

  app.get(
    '/knowledge',
    {
      schema: {
        summary: 'List knowledge artifacts',
        response: {
          200: createItemsResponseSchema(knowledgeArtifactSchema),
        },
      },
    },
    async () => ({
      items: await input.service.listKnowledge(),
    }),
  );

  app.get(
    '/knowledge/topics',
    {
      schema: {
        summary: 'List current-best topic knowledge summaries',
        response: {
          200: createItemsResponseSchema(knowledgeTopicSummarySchema),
        },
      },
    },
    async () => ({
      items: input.service.listKnowledgeTopics
        ? await input.service.listKnowledgeTopics()
        : [],
    }),
  );

  app.get<{
    Params: {
      topicKey: string;
    };
  }>(
    '/knowledge/topics/:topicKey',
    {
      schema: {
        summary: 'Get current-best topic knowledge by topic key',
        response: {
          200: createArtifactResponseSchema('topic', knowledgeArtifactSchema),
          404: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
        },
      },
    },
    async (request, reply) => {
      const topic = input.service.getKnowledgeTopic
        ? await input.service.getKnowledgeTopic(request.params.topicKey)
        : null;

      if (topic === null) {
        reply.code(404);
        return {
          message: `Knowledge topic ${request.params.topicKey} was not found.`,
        };
      }

      return {
        topic,
      };
    },
  );

  app.get<{
    Params: {
      topicKey: string;
    };
  }>(
    '/knowledge/topics/:topicKey/history',
    {
      schema: {
        summary: 'List topic knowledge history by topic key',
        response: {
          200: createItemsResponseSchema(knowledgeArtifactSchema),
        },
      },
    },
    async (request) => ({
      items: input.service.listKnowledgeHistory
        ? await input.service.listKnowledgeHistory(request.params.topicKey)
        : [],
    }),
  );

  app.get(
    '/skills',
    {
      schema: {
        summary: 'List skill drafts',
        response: {
          200: createItemsResponseSchema(skillArtifactSchema),
        },
      },
    },
    async () => ({
      items: await input.service.listSkillDrafts(),
    }),
  );

  app.post<{ Body: { artifact: KnowledgeArtifact } }>(
    '/knowledge',
    {
      schema: {
        summary: 'Save an edited knowledge artifact',
        body: {
          type: 'object',
          properties: {
            artifact: knowledgeArtifactSchema,
          },
          required: ['artifact'],
        },
        response: {
          201: createArtifactResponseSchema('artifact', knowledgeArtifactSchema),
        },
      },
    },
    async (request, reply) => {
      reply.code(201);

      if (input.service.publishKnowledge) {
        await input.service.publishKnowledge(request.body.artifact);
      }

      return {
        artifact: request.body.artifact,
      };
    },
  );

  app.post<{ Body: { artifact: SkillArtifact } }>(
    '/skills',
    {
      schema: {
        summary: 'Save an edited skill draft',
        body: {
          type: 'object',
          properties: {
            artifact: skillArtifactSchema,
          },
          required: ['artifact'],
        },
        response: {
          201: createArtifactResponseSchema('artifact', skillArtifactSchema),
        },
      },
    },
    async (request, reply) => {
      reply.code(201);

      if (input.service.publishSkillDraft) {
        await input.service.publishSkillDraft(request.body.artifact);
      }

      return {
        artifact: request.body.artifact,
      };
    },
  );

  app.post(
    '/sync/browser',
    {
      schema: {
        summary: 'Trigger browser memory sync',
        response: {
          202: createArtifactResponseSchema('sync', browserSyncSummarySchema),
        },
      },
    },
    async (_request, reply) => {
      reply.code(202);
      return {
        sync: await input.service.syncBrowserMemory(),
      };
    },
  );

  app.post(
    '/sync/shell',
    {
      schema: {
        summary: 'Trigger shell memory sync',
        response: {
          202: createArtifactResponseSchema('sync', browserSyncSummarySchema),
        },
      },
    },
    async (_request, reply) => {
      reply.code(202);
      return {
        sync: await input.service.syncShellMemory(),
      };
    },
  );

  app.post<{ Body: { reviewDate: string; reviewTimeZone?: string } }>(
    '/candidate-memories/daily',
    {
      schema: {
        summary: 'Create daily candidate memories from imported events',
        body: {
          type: 'object',
          properties: {
            reviewDate: { type: 'string' },
            reviewTimeZone: { type: 'string' },
          },
          required: ['reviewDate'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              candidates: {
                type: 'array',
                items: candidateMemorySchema,
              },
            },
            required: ['candidates'],
          },
        },
      },
    },
    async (request, reply) => {
      reply.code(201);
      return {
        candidates: await input.service.createDailyCandidateMemories(
          request.body.reviewDate,
          request.body.reviewTimeZone,
        ),
      };
    },
  );

  app.post<{
    Body: {
      candidates: CandidateMemory[];
    };
  }>(
    '/candidate-reviews/suggestions',
    {
      schema: {
        summary: 'Suggest review outcomes for candidate memories',
        body: {
          type: 'object',
          properties: {
            candidates: {
              type: 'array',
              items: candidateMemorySchema,
            },
          },
          required: ['candidates'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: candidateReviewSuggestionSchema,
              },
            },
            required: ['suggestions'],
          },
        },
      },
    },
    async (request) => ({
      suggestions: await input.service.suggestCandidateReviews(
        request.body.candidates,
      ),
    }),
  );

  app.post<{
    Body: {
      candidate: CandidateMemory;
      review: {
        decision: ReviewedMemory['decision'];
        reviewedAt: string;
      };
    };
  }>(
    '/reviewed-memories',
    {
      schema: {
        summary: 'Review a candidate memory',
        body: {
          type: 'object',
          properties: {
            candidate: candidateMemorySchema,
            review: {
              type: 'object',
              properties: {
                decision: { type: 'string', enum: ['keep', 'discard'] },
                reviewedAt: { type: 'string' },
              },
              required: ['decision', 'reviewedAt'],
            },
          },
          required: ['candidate', 'review'],
        },
        response: {
          201: createArtifactResponseSchema(
            'reviewedMemory',
            reviewedMemorySchema,
          ),
        },
      },
    },
    async (request, reply) => {
      reply.code(201);
      return {
        reviewedMemory: await input.service.reviewCandidateMemory(
          request.body.candidate,
          request.body.review,
        ),
      };
    },
  );

  app.post<{ Body: { reviewedMemories: ReviewedMemory[] } }>(
    '/knowledge/generate',
    {
      schema: {
        summary: 'Generate a knowledge artifact from reviewed memories',
        body: {
          type: 'object',
          properties: {
            reviewedMemories: {
              type: 'array',
              items: reviewedMemorySchema,
            },
          },
          required: ['reviewedMemories'],
        },
        response: {
          201: createArtifactResponseSchema('artifact', knowledgeArtifactSchema),
        },
      },
    },
    async (request, reply) => {
      reply.code(201);
      return {
        artifact: await input.service.generateKnowledgeFromReviewedMemories(
          request.body.reviewedMemories,
        ),
      };
    },
  );

  app.post<{ Body: { reviewedMemories: ReviewedMemory[] } }>(
    '/skills/generate',
    {
      schema: {
        summary: 'Generate a skill draft from reviewed memories',
        body: {
          type: 'object',
          properties: {
            reviewedMemories: {
              type: 'array',
              items: reviewedMemorySchema,
            },
          },
          required: ['reviewedMemories'],
        },
        response: {
          201: createArtifactResponseSchema('artifact', skillArtifactSchema),
        },
      },
    },
    async (request, reply) => {
      reply.code(201);
      return {
        artifact: await input.service.generateSkillDraftFromReviewedMemories(
          request.body.reviewedMemories,
        ),
      };
    },
  );

  await app.listen({
    host,
    port,
  });

  const address = app.server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve MirrorBrain HTTP server address');
  }

  return {
    origin: `http://${host}:${address.port}`,
    host,
    port: address.port,
    async stop() {
      await app.close();
    },
  };
}
