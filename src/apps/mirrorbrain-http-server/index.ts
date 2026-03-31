import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type {
  CandidateMemory,
  KnowledgeArtifact,
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
  queryMemory(): Promise<MemoryEvent[]>;
  listKnowledge(): Promise<KnowledgeArtifact[]>;
  listSkillDrafts(): Promise<SkillArtifact[]>;
  createCandidateMemory(memoryEvents: MemoryEvent[]): Promise<CandidateMemory>;
  reviewCandidateMemory(
    candidate: CandidateMemory,
    review: { decision: ReviewedMemory['decision'] },
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

const candidateMemorySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    memoryEventIds: {
      type: 'array',
      items: { type: 'string' },
    },
    reviewState: { type: 'string', enum: ['pending'] },
  },
  required: ['id', 'memoryEventIds', 'reviewState'],
} as const;

const reviewedMemorySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    candidateMemoryId: { type: 'string' },
    decision: { type: 'string', enum: ['keep', 'discard'] },
  },
  required: ['id', 'candidateMemoryId', 'decision'],
} as const;

const knowledgeArtifactSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    draftState: { type: 'string', enum: ['draft', 'published'] },
    sourceReviewedMemoryIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['id', 'draftState', 'sourceReviewedMemoryIds'],
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
    app.get(
      '/',
      {
        schema: {
          hide: true,
        },
      },
      async (_request, reply) => {
        reply.type('text/html; charset=utf-8');
        return readFile(join(input.staticDir!, 'index.html'), 'utf8');
      },
    );
    app.get(
      '/styles.css',
      {
        schema: {
          hide: true,
        },
      },
      async (_request, reply) => {
        reply.type('text/css; charset=utf-8');
        return readFile(join(input.staticDir!, 'styles.css'), 'utf8');
      },
    );
    app.get(
      '/main.js',
      {
        schema: {
          hide: true,
        },
      },
      async (_request, reply) => {
        reply.type('application/javascript; charset=utf-8');
        return readFile(join(input.staticDir!, 'main.js'), 'utf8');
      },
    );
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
      items: await input.service.queryMemory(),
    }),
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

  app.post<{ Body: { memoryEvents: MemoryEvent[] } }>(
    '/candidate-memories',
    {
      schema: {
        summary: 'Create a candidate memory from imported events',
        body: {
          type: 'object',
          properties: {
            memoryEvents: {
              type: 'array',
              items: memoryEventSchema,
            },
          },
          required: ['memoryEvents'],
        },
        response: {
          201: createArtifactResponseSchema('candidate', candidateMemorySchema),
        },
      },
    },
    async (request, reply) => {
      reply.code(201);
      return {
        candidate: await input.service.createCandidateMemory(
          request.body.memoryEvents,
        ),
      };
    },
  );

  app.post<{
    Body: {
      candidate: CandidateMemory;
      review: { decision: ReviewedMemory['decision'] };
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
              },
              required: ['decision'],
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
