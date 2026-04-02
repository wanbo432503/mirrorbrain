import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  assertMirrorBrainDependenciesReachable,
  getMirrorBrainDevConfig,
  prepareMirrorBrainWebAssets,
  runMirrorBrainStartupCli,
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
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
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
      syncShellMemory: runtimeService.syncShellMemory,
      listMemoryEvents: vi.fn(async () => []),
      queryMemory: vi.fn(async () => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      createDailyCandidateMemories: vi.fn(async () => []),
      suggestCandidateReviews: vi.fn(async () => []),
      createCandidateMemory: vi.fn(async () => ({
        id: 'candidate:browser:aw-event-1',
        memoryEventIds: ['browser:aw-event-1'],
        title: 'Example Com / tasks',
        summary: '1 browser event about Example Com / tasks on 2026-03-20.',
        theme: 'example.com / tasks',
        reviewDate: '2026-03-20',
        timeRange: {
          startAt: '2026-03-20T08:00:00.000Z',
          endAt: '2026-03-20T08:00:00.000Z',
        },
        reviewState: 'pending' as const,
      })),
      reviewCandidateMemory: vi.fn(async () => ({
        id: 'reviewed:candidate:browser:aw-event-1',
        candidateMemoryId: 'candidate:browser:aw-event-1',
        candidateTitle: 'Example Com / tasks',
        candidateSummary: '1 browser event about Example Com / tasks on 2026-03-20.',
        candidateTheme: 'example.com / tasks',
        memoryEventIds: ['browser:aw-event-1'],
        reviewDate: '2026-03-20',
        decision: 'keep' as const,
        reviewedAt: '2026-03-20T10:00:00.000Z',
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

  it('passes the configured shell history path into the runtime service startup input', async () => {
    const config = getMirrorBrainDevConfig({
      MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
      MIRRORBRAIN_SHELL_HISTORY_PATH: '/tmp/.zsh_history',
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
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };

    const startMirrorBrainService = vi.fn(() => runtimeService);

    await startMirrorBrainDevRuntime(
      {
        env: {
          MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
          MIRRORBRAIN_SHELL_HISTORY_PATH: '/tmp/.zsh_history',
        },
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
          syncShellMemory: runtimeService.syncShellMemory,
          listMemoryEvents: vi.fn(async () => []),
          queryMemory: vi.fn(async () => ({ items: [] })),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
          createDailyCandidateMemories: vi.fn(async () => []),
          suggestCandidateReviews: vi.fn(async () => []),
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
      config: config.config,
      workspaceDir: '/tmp/mirrorbrain-workspace',
      shellHistoryPath: '/tmp/.zsh_history',
    });
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
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
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
          syncShellMemory: runtimeService.syncShellMemory,
          listMemoryEvents: vi.fn(async () => []),
          queryMemory: vi.fn(async () => ({ items: [] })),
          listKnowledge: vi.fn(async () => []),
          listSkillDrafts: vi.fn(async () => []),
          createDailyCandidateMemories: vi.fn(async () => []),
          suggestCandidateReviews: vi.fn(async () => []),
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

  it('reports grouped config and dependency issues before attempting startup', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-cli-fail-'));
    const startDetachedProcess = vi.fn();

    const result = await runMirrorBrainStartupCli(
      {
        env: {},
        projectDir,
      },
      {
        inspectDependencies: vi.fn(async () => [
          {
            component: 'OpenViking' as const,
            message: 'OpenViking is unreachable at http://127.0.0.1:1933.',
          },
          {
            component: 'ActivityWatch' as const,
            message:
              'No browser events were found in the last hour for ActivityWatch.',
          },
        ]),
        startDetachedProcess,
      },
    );

    expect(result).toEqual({
      status: 'failed',
      issuesByComponent: {
        'MirrorBrain config': [
          'Missing required env var MIRRORBRAIN_WORKSPACE_DIR. Example: /path_to_workspace/mirrorbrain-workspace',
          'Missing required env var MIRRORBRAIN_ACTIVITYWATCH_BASE_URL. Example: http://127.0.0.1:5600',
          'Missing required env var MIRRORBRAIN_OPENVIKING_BASE_URL. Example: http://127.0.0.1:1933',
        ],
        OpenViking: [
          'OpenViking is unreachable at http://127.0.0.1:1933.',
        ],
        ActivityWatch: [
          'No browser events were found in the last hour for ActivityWatch.',
        ],
      },
    });
    expect(startDetachedProcess).not.toHaveBeenCalled();
  });

  it('returns a complete startup summary after launching a detached process', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-cli-ok-'));
    const startDetachedProcess = vi.fn(async () => ({
      processId: 4242,
      logPath: '/tmp/mirrorbrain-dev.log',
    }));

    const result = await runMirrorBrainStartupCli(
      {
        env: {
          MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
          MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
          MIRRORBRAIN_OPENVIKING_BASE_URL: 'http://127.0.0.1:1933',
        },
        projectDir,
      },
      {
        inspectDependencies: vi.fn(async () => []),
        startDetachedProcess,
      },
    );

    expect(result).toEqual({
      status: 'started',
      summary: {
        serviceAddress: 'http://127.0.0.1:3007',
        processId: 4242,
        logPath: '/tmp/mirrorbrain-dev.log',
        dependencyStatus: {
          OpenViking: 'ready',
          ActivityWatch: 'ready',
        },
        nextSteps: [
          'Connect MirrorBrain to openclaw using the minimum memory retrieval plugin example.',
          'Run the minimum demo question: 我昨天做了什么？',
        ],
      },
    });
    expect(startDetachedProcess).toHaveBeenCalledWith({
      env: expect.objectContaining({
        MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
      }),
      origin: 'http://127.0.0.1:3007',
      projectDir,
    });
  });
});
