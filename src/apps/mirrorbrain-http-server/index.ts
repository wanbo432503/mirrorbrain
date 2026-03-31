import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';

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

function sendJson(
  response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  },
  statusCode: number,
  body: unknown,
) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(body));
}

function sendText(
  response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  },
  statusCode: number,
  contentType: string,
  body: string,
) {
  response.statusCode = statusCode;
  response.setHeader('content-type', contentType);
  response.end(body);
}

async function readJsonBody<T>(request: {
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  on(event: 'end', listener: () => void): void;
}): Promise<T> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    request.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on('end', () => {
      try {
        const rawBody = Buffer.concat(chunks).toString('utf8');

        resolve((rawBody.length > 0 ? JSON.parse(rawBody) : {}) as T);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function startMirrorBrainHttpServer(
  input: StartMirrorBrainHttpServerInput,
): Promise<MirrorBrainHttpServer> {
  const config = input.service.service.config ?? getMirrorBrainConfig();
  const host = input.host ?? config.service.host;
  const port = input.port ?? config.service.port;
  const server = createServer(async (request, response) => {
    const requestMethod = request.method ?? 'GET';
    const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);

    try {
      if (input.staticDir !== undefined) {
        const staticAssetMap: Record<string, { fileName: string; contentType: string }> =
          {
            '/': {
              fileName: 'index.html',
              contentType: 'text/html; charset=utf-8',
            },
            '/styles.css': {
              fileName: 'styles.css',
              contentType: 'text/css; charset=utf-8',
            },
            '/main.js': {
              fileName: 'main.js',
              contentType: 'application/javascript; charset=utf-8',
            },
          };
        const staticAsset = staticAssetMap[requestUrl.pathname];

        if (staticAsset !== undefined) {
          sendText(
            response,
            200,
            staticAsset.contentType,
            await readFile(join(input.staticDir, staticAsset.fileName), 'utf8'),
          );

          return;
        }
      }

      if (requestMethod === 'GET' && requestUrl.pathname === '/health') {
        sendJson(response, 200, {
          status: input.service.service.status,
          config,
        });

        return;
      }

      if (requestMethod === 'GET' && requestUrl.pathname === '/memory') {
        sendJson(response, 200, {
          items: await input.service.queryMemory(),
        });

        return;
      }

      if (requestMethod === 'GET' && requestUrl.pathname === '/knowledge') {
        sendJson(response, 200, {
          items: await input.service.listKnowledge(),
        });

        return;
      }

      if (requestMethod === 'GET' && requestUrl.pathname === '/skills') {
        sendJson(response, 200, {
          items: await input.service.listSkillDrafts(),
        });

        return;
      }

      if (requestMethod === 'POST' && requestUrl.pathname === '/sync/browser') {
        sendJson(response, 202, {
          sync: await input.service.syncBrowserMemory(),
        });

        return;
      }

      if (
        requestMethod === 'POST' &&
        requestUrl.pathname === '/candidate-memories'
      ) {
        const body = await readJsonBody<{ memoryEvents: MemoryEvent[] }>(request);

        sendJson(response, 201, {
          candidate: await input.service.createCandidateMemory(body.memoryEvents),
        });

        return;
      }

      if (
        requestMethod === 'POST' &&
        requestUrl.pathname === '/reviewed-memories'
      ) {
        const body = await readJsonBody<{
          candidate: CandidateMemory;
          review: { decision: ReviewedMemory['decision'] };
        }>(request);

        sendJson(response, 201, {
          reviewedMemory: await input.service.reviewCandidateMemory(
            body.candidate,
            body.review,
          ),
        });

        return;
      }

      if (
        requestMethod === 'POST' &&
        requestUrl.pathname === '/knowledge/generate'
      ) {
        const body = await readJsonBody<{ reviewedMemories: ReviewedMemory[] }>(
          request,
        );

        sendJson(response, 201, {
          artifact: await input.service.generateKnowledgeFromReviewedMemories(
            body.reviewedMemories,
          ),
        });

        return;
      }

      if (
        requestMethod === 'POST' &&
        requestUrl.pathname === '/skills/generate'
      ) {
        const body = await readJsonBody<{ reviewedMemories: ReviewedMemory[] }>(
          request,
        );

        sendJson(response, 201, {
          artifact: await input.service.generateSkillDraftFromReviewedMemories(
            body.reviewedMemories,
          ),
        });

        return;
      }

      sendJson(response, 404, {
        error: 'not_found',
      });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('MirrorBrain HTTP server failed to bind to a TCP address.');
  }

  return {
    origin: `http://${host}:${address.port}`,
    host,
    port: address.port,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}
