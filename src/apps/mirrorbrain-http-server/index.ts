import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import {
  knowledgeArtifactDtoSchema,
  skillArtifactDtoSchema,
} from '../../shared/api-contracts/index.js';
import { ValidationError } from '../mirrorbrain-service/errors.js';
import type {
  SourceAuditEvent,
  SourceLedgerKind,
} from '../../modules/source-ledger-importer/index.js';
import type {
  SourceInstanceSummary,
} from '../../integrations/source-ledger-state-store/index.js';
import type {
  SourceLedgerImportResult,
} from '../../workflows/source-ledger-import/index.js';
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
import type { KnowledgeGraphSnapshot } from '../../modules/knowledge-graph/index.js';

interface MirrorBrainHttpService {
  service: {
    status: 'running' | 'stopped';
    config?: ReturnType<typeof getMirrorBrainConfig>;
  };
  syncBrowserMemory(): Promise<unknown>;
  syncShellMemory(): Promise<unknown>;
  importSourceLedgers?(): Promise<SourceLedgerImportResult>;
  listSourceAuditEvents?(filter: {
    sourceKind?: SourceLedgerKind;
    sourceInstanceId?: string;
  }): Promise<SourceAuditEvent[]>;
  listSourceInstanceSummaries?(): Promise<SourceInstanceSummary[]>;
  listMemoryEvents(input?: {
    page?: number;
    pageSize?: number;
  }): Promise<MemoryEvent[] | PaginatedMemoryEvents>;
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
  getKnowledgeGraph?(): Promise<KnowledgeGraphSnapshot>;
  listCandidateMemoriesByDate?(reviewDate: string): Promise<CandidateMemory[]>;
  listSkillDrafts(): Promise<SkillArtifact[]>;
  publishKnowledge?(artifact: KnowledgeArtifact): Promise<unknown>;
  publishSkillDraft?(artifact: SkillArtifact): Promise<unknown>;
  deleteKnowledgeArtifact?(artifactId: string): Promise<void>;
  deleteSkillArtifact?(artifactId: string): Promise<void>;
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
  undoCandidateReview(reviewedMemoryId: string): Promise<void>;
  deleteCandidateMemory(candidateMemoryId: string): Promise<void>;
  generateKnowledgeFromReviewedMemories(
    reviewedMemories: ReviewedMemory[],
  ): Promise<KnowledgeArtifact>;
  regenerateKnowledgeDraft?(
    existingDraft: KnowledgeArtifact,
    reviewedMemories: ReviewedMemory[],
  ): Promise<KnowledgeArtifact>;
  approveKnowledgeDraft?(draftId: string, draftSnapshot?: KnowledgeArtifact): Promise<{
    publishedArtifact: KnowledgeArtifact;
    assignedTopic: { topicKey: string; title: string };
  }>;
  generateSkillDraftFromReviewedMemories(
    reviewedMemories: ReviewedMemory[],
  ): Promise<SkillArtifact>;
}

interface StartMirrorBrainHttpServerInput {
  service: MirrorBrainHttpService;
  host?: string;
  port?: number;
  staticDir?: string;
  workspaceDir?: string;
}

interface PaginatedMemoryEvents {
  items: MemoryEvent[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
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
    primarySourceCount: { type: 'number' },
    supportingSourceCount: { type: 'number' },
    evidenceSummary: { type: 'string' },
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

const knowledgeArtifactSchema = knowledgeArtifactDtoSchema;

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

const knowledgeGraphNodeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['topic', 'knowledge-artifact'] },
    label: { type: 'string' },
    topicKey: { type: 'string' },
    properties: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['id', 'type', 'label', 'topicKey', 'properties'],
} as const;

const knowledgeGraphEdgeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['CONTAINS', 'REFERENCES', 'SIMILAR'] },
    source: { type: 'string' },
    target: { type: 'string' },
    label: { type: 'string' },
    properties: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['id', 'type', 'source', 'target', 'label', 'properties'],
} as const;

const knowledgeGraphStatsSchema = {
  type: 'object',
  properties: {
    topics: { type: 'number' },
    knowledgeArtifacts: { type: 'number' },
    wikilinkReferences: { type: 'number' },
    similarityRelations: { type: 'number' },
  },
  required: [
    'topics',
    'knowledgeArtifacts',
    'wikilinkReferences',
    'similarityRelations',
  ],
} as const;

const knowledgeGraphSnapshotSchema = {
  type: 'object',
  properties: {
    generatedAt: { type: 'string' },
    stats: knowledgeGraphStatsSchema,
    nodes: {
      type: 'array',
      items: knowledgeGraphNodeSchema,
    },
    edges: {
      type: 'array',
      items: knowledgeGraphEdgeSchema,
    },
  },
  required: ['generatedAt', 'stats', 'nodes', 'edges'],
} as const;

const skillArtifactSchema = skillArtifactDtoSchema;

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

const sourceLedgerCheckpointSchema = {
  type: 'object',
  properties: {
    ledgerPath: { type: 'string' },
    nextLineNumber: { type: 'number' },
    updatedAt: { type: 'string' },
  },
  required: ['ledgerPath', 'nextLineNumber', 'updatedAt'],
} as const;

const sourceLedgerImportResultSchema = {
  type: 'object',
  properties: {
    importedCount: { type: 'number' },
    skippedCount: { type: 'number' },
    scannedLedgerCount: { type: 'number' },
    changedLedgerCount: { type: 'number' },
    ledgerResults: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ledgerPath: { type: 'string' },
          importedCount: { type: 'number' },
          skippedCount: { type: 'number' },
          checkpoint: sourceLedgerCheckpointSchema,
        },
        required: ['ledgerPath', 'importedCount', 'skippedCount', 'checkpoint'],
      },
    },
  },
  required: [
    'importedCount',
    'skippedCount',
    'scannedLedgerCount',
    'changedLedgerCount',
    'ledgerResults',
  ],
} as const;

const sourceAuditEventSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    eventType: { type: 'string' },
    sourceKind: { type: 'string' },
    sourceInstanceId: { type: 'string' },
    ledgerPath: { type: 'string' },
    lineNumber: { type: 'number' },
    occurredAt: { type: 'string' },
    severity: { type: 'string', enum: ['info', 'warning', 'error'] },
    message: { type: 'string' },
    metadata: { type: 'object', additionalProperties: true },
  },
  required: [
    'id',
    'eventType',
    'ledgerPath',
    'lineNumber',
    'occurredAt',
    'severity',
    'message',
  ],
} as const;

const sourceInstanceSummarySchema = {
  type: 'object',
  properties: {
    sourceKind: { type: 'string' },
    sourceInstanceId: { type: 'string' },
    lifecycleStatus: { type: 'string' },
    recorderStatus: { type: 'string' },
    lastImporterScanAt: { type: 'string' },
    lastImportedAt: { type: 'string' },
    importedCount: { type: 'number' },
    skippedCount: { type: 'number' },
    latestWarning: { type: 'string' },
    checkpointSummary: { type: 'string' },
  },
  required: [
    'sourceKind',
    'sourceInstanceId',
    'lifecycleStatus',
    'recorderStatus',
    'importedCount',
    'skippedCount',
  ],
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

  app.get<{
    Querystring: {
      page?: number;
      pageSize?: number;
    };
  }>(
    '/memory',
    {
      schema: {
        summary: 'List imported memory events with pagination',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: memoryEventSchema,
              },
              pagination: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  page: { type: 'number' },
                  pageSize: { type: 'number' },
                  totalPages: { type: 'number' },
                },
                required: ['total', 'page', 'pageSize', 'totalPages'],
              },
            },
            required: ['items', 'pagination'],
          },
        },
      },
    },
    async (request) => {
      const page = request.query.page ?? 1;
      const pageSize = request.query.pageSize ?? 10;
      const result = await input.service.listMemoryEvents({ page, pageSize });
      if (Array.isArray(result)) {
        return {
          items: result,
          pagination: {
            total: result.length,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(result.length / pageSize)),
          },
        };
      }

      return result;
    },
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
    '/knowledge/graph',
    {
      schema: {
        summary: 'Get knowledge graph snapshot with wikilink references and similarity relations',
        response: {
          200: createArtifactResponseSchema('graph', knowledgeGraphSnapshotSchema),
        },
      },
    },
    async () => {
      const graph = input.service.getKnowledgeGraph
        ? await input.service.getKnowledgeGraph()
        : {
            generatedAt: new Date().toISOString(),
            stats: {
              topics: 0,
              knowledgeArtifacts: 0,
              wikilinkReferences: 0,
              similarityRelations: 0,
            },
            nodes: [],
            edges: [],
          };

      return { graph };
    },
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

  app.delete<{
    Params: {
      artifactId: string;
    };
  }>(
    '/knowledge/:artifactId',
    {
      schema: {
        summary: 'Delete a persisted knowledge artifact',
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request, reply) => {
      if (input.service.deleteKnowledgeArtifact === undefined) {
        reply.code(501);
        return {
          message: 'Knowledge deletion is not available.',
        };
      }

      await input.service.deleteKnowledgeArtifact(request.params.artifactId);
      reply.code(204);
      return null;
    },
  );

  app.delete<{
    Params: {
      artifactId: string;
    };
  }>(
    '/skills/:artifactId',
    {
      schema: {
        summary: 'Delete a persisted skill artifact',
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request, reply) => {
      if (input.service.deleteSkillArtifact === undefined) {
        reply.code(501);
        return {
          message: 'Skill deletion is not available.',
        };
      }

      await input.service.deleteSkillArtifact(request.params.artifactId);
      reply.code(204);
      return null;
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

  app.post(
    '/sources/import',
    {
      schema: {
        summary: 'Import changed Phase 4 source ledgers',
        response: {
          202: createArtifactResponseSchema('import', sourceLedgerImportResultSchema),
          501: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
        },
      },
    },
    async (_request, reply) => {
      if (input.service.importSourceLedgers === undefined) {
        reply.code(501);
        return {
          message: 'Source ledger import is not available.',
        };
      }

      reply.code(202);
      return {
        import: await input.service.importSourceLedgers(),
      };
    },
  );

  app.get<{
    Querystring: {
      sourceKind?: SourceLedgerKind;
      sourceInstanceId?: string;
    };
  }>(
    '/sources/audit',
    {
      schema: {
        summary: 'List Phase 4 source audit events',
        querystring: {
          type: 'object',
          properties: {
            sourceKind: { type: 'string' },
            sourceInstanceId: { type: 'string' },
          },
        },
        response: {
          200: createItemsResponseSchema(sourceAuditEventSchema),
          501: {
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
      if (input.service.listSourceAuditEvents === undefined) {
        reply.code(501);
        return {
          message: 'Source audit listing is not available.',
        };
      }

      return {
        items: await input.service.listSourceAuditEvents({
          sourceKind: request.query.sourceKind,
          sourceInstanceId: request.query.sourceInstanceId,
        }),
      };
    },
  );

  app.get(
    '/sources/status',
    {
      schema: {
        summary: 'List Phase 4 source instance status summaries',
        response: {
          200: createItemsResponseSchema(sourceInstanceSummarySchema),
          501: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
        },
      },
    },
    async (_request, reply) => {
      if (input.service.listSourceInstanceSummaries === undefined) {
        reply.code(501);
        return {
          message: 'Source status listing is not available.',
        };
      }

      return {
        items: await input.service.listSourceInstanceSummaries(),
      };
    },
  );

  app.get<{
    Querystring: {
      reviewDate?: string;
    };
  }>(
    '/candidate-memories',
    {
      schema: {
        summary: 'List candidate memories optionally filtered by review date',
        querystring: {
          type: 'object',
          properties: {
            reviewDate: { type: 'string' },
          },
        },
        response: {
          200: {
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
    async (request) => {
      if (request.query.reviewDate && input.service.listCandidateMemoriesByDate) {
        return {
          candidates: await input.service.listCandidateMemoriesByDate(
            request.query.reviewDate,
          ),
        };
      }

      // Fallback: return empty array if reviewDate is not provided or method not available
      return {
        candidates: [],
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

  app.delete<{ Params: { id: string } }>(
    '/candidate-memories/:id',
    {
      schema: {
        summary: 'Delete a candidate memory by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          204: { type: 'null', description: 'Candidate memory deleted successfully' },
          400: { type: 'object', properties: { message: { type: 'string' } } },
          500: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const candidateId = request.params.id

      try {
        await input.service.deleteCandidateMemory(candidateId)
        reply.code(204).send()
      } catch (error) {
        if (error instanceof ValidationError) {
          reply.code(400).send({ message: error.message })
        } else {
          console.error('Error deleting candidate memory:', error)
          reply.code(500).send({ message: 'Internal server error' })
        }
      }
    }
  )

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

  app.delete<{ Params: { id: string } }>(
    '/reviewed-memories/:id',
    {
      schema: {
        summary: 'Undo a candidate memory review by deleting the reviewed memory',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        response: {
          204: { type: 'null' },
          404: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
        }
      }
    },
    async (request, reply) => {
      try {
        await input.service.undoCandidateReview(request.params.id);
        reply.code(204);
      } catch (error) {
        if (error instanceof ValidationError) {
          // Validation error - bad request
          reply.code(400);
          return { message: error.message };
        }
        // Other errors - server error
        reply.code(500);
        return {
          message: `Failed to delete reviewed memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }
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

  app.post<{
    Body: {
      existingDraft: KnowledgeArtifact;
      reviewedMemories: ReviewedMemory[];
    };
  }>(
    '/knowledge/regenerate',
    {
      schema: {
        summary: 'Regenerate a knowledge draft with existing context',
        body: {
          type: 'object',
          properties: {
            existingDraft: knowledgeArtifactSchema,
            reviewedMemories: {
              type: 'array',
              items: reviewedMemorySchema,
            },
          },
          required: ['existingDraft', 'reviewedMemories'],
        },
        response: {
          201: createArtifactResponseSchema('artifact', knowledgeArtifactSchema),
        },
      },
    },
    async (request, reply) => {
      if (input.service.regenerateKnowledgeDraft === undefined) {
        reply.code(501);
        return {
          message: 'Knowledge regeneration is not available.',
        };
      }

      reply.code(201);
      return {
        artifact: await input.service.regenerateKnowledgeDraft(
          request.body.existingDraft,
          request.body.reviewedMemories,
        ),
      };
    },
  );

  app.post<{ Body: { draftId: string; draft?: KnowledgeArtifact } }>(
    '/knowledge/approve',
    {
      schema: {
        summary: 'Approve a knowledge draft and publish it',
        body: {
          type: 'object',
          properties: {
            draftId: { type: 'string' },
            draft: knowledgeArtifactSchema,
          },
          required: ['draftId'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              publishedArtifact: knowledgeArtifactSchema,
              assignedTopic: {
                type: 'object',
                properties: {
                  topicKey: { type: 'string' },
                  title: { type: 'string' },
                },
                required: ['topicKey', 'title'],
              },
            },
            required: ['publishedArtifact', 'assignedTopic'],
          },
        },
      },
    },
    async (request, reply) => {
      if (input.service.approveKnowledgeDraft === undefined) {
        reply.code(501);
        return {
          message: 'Knowledge approval is not available.',
        };
      }

      reply.code(201);
      const result = await input.service.approveKnowledgeDraft(
        request.body.draftId,
        request.body.draft,
      );
      return {
        publishedArtifact: result.publishedArtifact,
        assignedTopic: result.assignedTopic,
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
