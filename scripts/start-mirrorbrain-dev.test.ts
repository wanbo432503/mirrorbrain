import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  assertMirrorBrainDependenciesReachable,
  getMirrorBrainDevConfig,
  prepareMirrorBrainWebAssets,
  startMirrorBrainDevRuntime,
} from './start-mirrorbrain-dev.js';

describe('start mirrorbrain dev runtime', () => {
  it('parses environment overrides and sensible defaults for the local MVP runtime', () => {
    expect(
      getMirrorBrainDevConfig({
        MIRRORBRAIN_HTTP_PORT: '4010',
        MIRRORBRAIN_HTTP_HOST: '0.0.0.0',
        MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
        MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
        MIRRORBRAIN_OPENVIKING_BASE_URL: 'http://127.0.0.1:8080',
        MIRRORBRAIN_SYNC_INTERVAL_MS: '900000',
        MIRRORBRAIN_INITIAL_BACKFILL_HOURS: '12',
      }),
    ).toEqual({
      workspaceDir: '/tmp/mirrorbrain-workspace',
      config: {
        service: {
          host: '0.0.0.0',
          port: 4010,
        },
        activityWatch: {
          baseUrl: 'http://127.0.0.1:5600',
        },
        openViking: {
          baseUrl: 'http://127.0.0.1:8080',
        },
        sync: {
          pollingIntervalMs: 900000,
          initialBackfillHours: 12,
        },
      },
    });
  });

  it('fails fast when ActivityWatch or OpenViking is unreachable', async () => {
    await expect(
      assertMirrorBrainDependenciesReachable(
        getMirrorBrainDevConfig({
          MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
          MIRRORBRAIN_OPENVIKING_BASE_URL: 'http://127.0.0.1:8080',
        }).config,
        async (input) => {
          if (String(input).includes('5600')) {
            return new Response('nope', { status: 503 });
          }

          return new Response('{}', { status: 200 });
        },
      ),
    ).rejects.toThrow('ActivityWatch is unreachable');
  });

  it('wraps network-level ActivityWatch failures with a clear startup message', async () => {
    await expect(
      assertMirrorBrainDependenciesReachable(
        getMirrorBrainDevConfig({
          MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
          MIRRORBRAIN_OPENVIKING_BASE_URL: 'http://127.0.0.1:8080',
        }).config,
        async (input) => {
          if (String(input).includes('5600')) {
            throw new TypeError('fetch failed');
          }

          return new Response('{}', { status: 200 });
        },
      ),
    ).rejects.toThrow(
      'ActivityWatch is unreachable for the local MVP runtime.',
    );
  });

  it('wraps network-level OpenViking failures with a clear startup message', async () => {
    await expect(
      assertMirrorBrainDependenciesReachable(
        getMirrorBrainDevConfig({
          MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
          MIRRORBRAIN_OPENVIKING_BASE_URL: 'http://127.0.0.1:8080',
        }).config,
        async (input) => {
          if (String(input).includes('8080')) {
            throw new TypeError('fetch failed');
          }

          return new Response('{}', { status: 200 });
        },
      ),
    ).rejects.toThrow(
      'OpenViking is unreachable for the local MVP runtime.',
    );
  });

  it('copies the standalone UI shell and transpiles the web entrypoint for local serving', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-project-'));
    const outputDir = join(projectDir, '.mirrorbrain-web');
    const webDir = join(projectDir, 'src', 'apps', 'mirrorbrain-web');

    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
        },
      }),
    );
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(webDir, { recursive: true }),
    );
    writeFileSync(
      join(webDir, 'index.html'),
      '<!doctype html><html><body><div id="app-root"></div></body></html>',
    );
    writeFileSync(join(webDir, 'styles.css'), 'body { color: black; }');
    writeFileSync(
      join(webDir, 'main.ts'),
      'export const marker: string = "mirrorbrain-web"; console.log(marker);',
    );

    const result = await prepareMirrorBrainWebAssets({
      projectDir,
      outputDir,
    });

    expect(result).toEqual({
      outputDir,
      indexHtmlPath: join(outputDir, 'index.html'),
      stylesPath: join(outputDir, 'styles.css'),
      scriptPath: join(outputDir, 'main.js'),
    });
    expect(readFileSync(result.indexHtmlPath, 'utf8')).toContain('app-root');
    expect(readFileSync(result.stylesPath, 'utf8')).toContain('color: black');
    expect(readFileSync(result.scriptPath, 'utf8')).toContain('mirrorbrain-web');
  });

  it('assembles the service, API contract, static assets, and HTTP server into one dev runtime', async () => {
    const config = getMirrorBrainDevConfig({
      MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
    });
    const runtimeService = {
      status: 'running' as const,
      config: config.config,
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const httpServer = {
      origin: 'http://127.0.0.1:3007',
      host: '127.0.0.1',
      port: 3007,
      stop: vi.fn(async () => undefined),
    };
    const startMirrorBrainService = vi.fn(() => runtimeService);
    const createMirrorBrainService = vi.fn(() => ({
      service: runtimeService,
      syncBrowserMemory: runtimeService.syncBrowserMemory,
      queryMemory: vi.fn(async () => []),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      createCandidateMemory: vi.fn(async () => ({
        id: 'candidate:browser:aw-event-1',
        memoryEventIds: ['browser:aw-event-1'],
        reviewState: 'pending' as const,
      })),
      reviewCandidateMemory: vi.fn(async () => ({
        id: 'reviewed:candidate:browser:aw-event-1',
        candidateMemoryId: 'candidate:browser:aw-event-1',
        decision: 'keep' as const,
      })),
      generateKnowledgeFromReviewedMemories: vi.fn(async () => ({
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft' as const,
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      })),
      generateSkillDraftFromReviewedMemories: vi.fn(async () => ({
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft' as const,
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      })),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    }));
    const prepareWebAssets = vi.fn(async () => ({
      outputDir: '/tmp/mirrorbrain-web',
      indexHtmlPath: '/tmp/mirrorbrain-web/index.html',
      stylesPath: '/tmp/mirrorbrain-web/styles.css',
      scriptPath: '/tmp/mirrorbrain-web/main.js',
    }));
    const startMirrorBrainHttpServer = vi.fn(async () => httpServer);

    const result = await startMirrorBrainDevRuntime(
      {
        env: {
          MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
        },
      },
      {
        assertDependenciesReachable: vi.fn(async () => undefined),
        prepareWebAssets,
        startMirrorBrainService,
        createMirrorBrainService,
        startMirrorBrainHttpServer,
      },
    );

    expect(startMirrorBrainService).toHaveBeenCalledWith({
      config: config.config,
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
    expect(createMirrorBrainService).toHaveBeenCalledWith({
      service: runtimeService,
      workspaceDir: '/tmp/mirrorbrain-workspace',
    });
    expect(startMirrorBrainHttpServer).toHaveBeenCalledWith({
      service: expect.any(Object),
      host: '127.0.0.1',
      port: 3007,
      staticDir: '/tmp/mirrorbrain-web',
    });
    expect(result.origin).toBe('http://127.0.0.1:3007');
  });

  it('loads local runtime overrides from the project .env file before startup', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-dev-env-'));
    const runtimeService = {
      status: 'running' as const,
      config: getMirrorBrainDevConfig().config,
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };

    writeFileSync(
      join(projectDir, '.env'),
      [
        'MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600',
        'MIRRORBRAIN_OPENVIKING_BASE_URL=http://127.0.0.1:1933',
      ].join('\n'),
    );

    const startMirrorBrainService = vi.fn(() => runtimeService);

    await startMirrorBrainDevRuntime(
      {
        env: {},
        projectDir,
      },
      {
        assertDependenciesReachable: vi.fn(async () => undefined),
        prepareWebAssets: vi.fn(async () => ({
          outputDir: '/tmp/mirrorbrain-web',
          indexHtmlPath: '/tmp/mirrorbrain-web/index.html',
          stylesPath: '/tmp/mirrorbrain-web/styles.css',
          scriptPath: '/tmp/mirrorbrain-web/main.js',
        })),
        startMirrorBrainService,
        createMirrorBrainService: vi.fn(() => ({
          service: runtimeService,
          syncBrowserMemory: runtimeService.syncBrowserMemory,
          queryMemory: vi.fn(async () => []),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
          createCandidateMemory: vi.fn(),
          reviewCandidateMemory: vi.fn(),
          generateKnowledgeFromReviewedMemories: vi.fn(),
          generateSkillDraftFromReviewedMemories: vi.fn(),
          publishKnowledge: vi.fn(),
          publishSkillDraft: vi.fn(),
        })),
        startMirrorBrainHttpServer: vi.fn(async () => ({
          origin: 'http://127.0.0.1:3007',
          host: '127.0.0.1',
          port: 3007,
          stop: vi.fn(async () => undefined),
        })),
      },
    );

    expect(startMirrorBrainService).toHaveBeenCalledWith({
      config: expect.objectContaining({
        activityWatch: {
          baseUrl: 'http://127.0.0.1:5600',
        },
        openViking: {
          baseUrl: 'http://127.0.0.1:1933',
        },
      }),
      workspaceDir: process.cwd(),
    });
  });
});
