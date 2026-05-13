import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  assertMirrorBrainDependenciesReachable,
  getMirrorBrainDevConfig,
  prepareMirrorBrainWebAssets,
  waitForFileToExist,
  runMirrorBrainStartupCli,
  startMirrorBrainDevRuntime,
} from './start-mirrorbrain-dev.js';

describe('start mirrorbrain dev runtime', () => {
  it('documents model configuration in the example environment file', () => {
    const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8');

    expect(envExample).toContain('MIRRORBRAIN_LLM_API_BASE=');
    expect(envExample).toContain('MIRRORBRAIN_LLM_API_KEY=');
    expect(envExample).toContain('MIRRORBRAIN_LLM_MODEL=');
    expect(envExample).toContain('MIRRORBRAIN_BROWSER_BUCKET_ID=');
    expect(envExample).not.toContain('MIRRORBRAIN_OPENVIKING_BASE_URL=');
  });

  it('parses environment overrides and sensible defaults for the local MVP runtime', () => {
    expect(
      getMirrorBrainDevConfig({
        MIRRORBRAIN_HTTP_PORT: '4010',
        MIRRORBRAIN_HTTP_HOST: '0.0.0.0',
        MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
        MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
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
        sync: {
          pollingIntervalMs: 900000,
          initialBackfillHours: 12,
        },
      },
    });
  });

  it('rejects runtime config without an explicit workspace directory', () => {
    expect(() =>
      getMirrorBrainDevConfig({
        MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
      }),
    ).toThrow('MIRRORBRAIN_WORKSPACE_DIR is required');
  });

  it('fails fast when ActivityWatch is unreachable', async () => {
    await expect(
      assertMirrorBrainDependenciesReachable(
        getMirrorBrainDevConfig({
          MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
          MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
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
          MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
          MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
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

  it('validates ActivityWatch without requiring a separate storage service health check', async () => {
    const requestedUrls: string[] = [];

    await assertMirrorBrainDependenciesReachable(
      getMirrorBrainDevConfig({
        MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
        MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
      }).config,
      async (input) => {
        requestedUrls.push(String(input));
        return new Response('{}', { status: 200 });
      },
    );

    expect(requestedUrls).toEqual(['http://127.0.0.1:5600/api/0/buckets']);
  });

  it('waits for the React dist index to appear after the build watcher starts', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-project-'));
    const outputDir = join(projectDir, 'src', 'apps', 'mirrorbrain-web-react', 'dist');
    const indexHtmlPath = join(outputDir, 'index.html');

    setTimeout(async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(outputDir, { recursive: true });
      writeFileSync(indexHtmlPath, '<!doctype html><html><body>ok</body></html>');
    }, 20);

    await expect(
      waitForFileToExist(indexHtmlPath, { timeoutMs: 1000, intervalMs: 10 }),
    ).resolves.toBeUndefined();
  });

  it('starts a React build watcher instead of requiring a prebuilt dist directory', async () => {
    const spawnWebBuildWatcher = vi.fn(async () => ({
      stop: vi.fn(),
    }));

    const result = await prepareMirrorBrainWebAssets({
      projectDir: '/tmp/mirrorbrain-project',
      waitForFile: vi.fn(async () => undefined),
      spawnWebBuildWatcher,
    });

    expect(spawnWebBuildWatcher).toHaveBeenCalledWith({
      projectDir: '/tmp/mirrorbrain-project',
      outputDir: '/tmp/mirrorbrain-project/src/apps/mirrorbrain-web-react/dist',
    });
    expect(result.outputDir).toBe(
      '/tmp/mirrorbrain-project/src/apps/mirrorbrain-web-react/dist',
    );
    expect(typeof result.stop).toBe('function');
  });

  it('honors a custom React asset output directory for isolated fixtures', async () => {
    const spawnWebBuildWatcher = vi.fn(async () => ({
      stop: vi.fn(),
    }));
    const waitForFile = vi.fn(async () => undefined);

    const result = await prepareMirrorBrainWebAssets({
      projectDir: '/tmp/mirrorbrain-project',
      outputDir: '/tmp/mirrorbrain-static-fixture',
      waitForFile,
      spawnWebBuildWatcher,
    });

    expect(spawnWebBuildWatcher).toHaveBeenCalledWith({
      projectDir: '/tmp/mirrorbrain-project',
      outputDir: '/tmp/mirrorbrain-static-fixture',
    });
    expect(waitForFile).toHaveBeenCalledWith(
      '/tmp/mirrorbrain-static-fixture/index.html',
    );
    expect(result.outputDir).toBe('/tmp/mirrorbrain-static-fixture');
    expect(result.indexHtmlPath).toBe(
      '/tmp/mirrorbrain-static-fixture/index.html',
    );
  });

  it('passes the parent PATH into the detached dev child process environment', async () => {
    const recorded: Array<{ env: NodeJS.ProcessEnv }> = [];

    await runMirrorBrainStartupCli(
      {
        projectDir: '/tmp/mirrorbrain-project',
        env: {
          MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
          MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
        },
      },
      {
        inspectDependencies: async () => [],
        startDetachedProcess: async (input) => {
          recorded.push({ env: input.env });
          return {
            processId: 12345,
            logPath: '/tmp/mirrorbrain.log',
          };
        },
      },
    );

    expect(recorded[0]?.env.PATH).toBe(process.env.PATH);
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
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      listMemoryNarratives: vi.fn(async () => []),
      queryMemory: vi.fn(async () => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
          listKnowledgeTopics: vi.fn(async () => []),
          getKnowledgeTopic: vi.fn(async () => ({
            id: 'knowledge-draft:example',
            artifactType: 'daily-review-draft' as const,
            draftState: 'draft' as const,
            topicKey: null,
            title: 'Daily Review Draft',
            summary: '',
            body: '',
            sourceReviewedMemoryIds: [],
            derivedFromKnowledgeIds: [],
            version: 1,
            isCurrentBest: false,
            supersedesKnowledgeId: null,
            reviewedAt: null,
            recencyLabel: '',
            provenanceRefs: [],
          })),
          listKnowledgeHistory: vi.fn(async () => []),
      getKnowledgeGraph: vi.fn(async () => ({
        generatedAt: '2026-03-20T10:00:00.000Z',
        stats: {
          topics: 0,
          knowledgeArtifacts: 0,
          wikilinkReferences: 0,
          similarityRelations: 0,
        },
        nodes: [],
        edges: [],
      })),
      buildTopicKnowledgeCandidates: vi.fn(async () => []),
      mergeTopicKnowledgeCandidate: vi.fn(),
      mergeDailyReviewIntoTopicKnowledge: vi.fn(),
      listSkillDrafts: vi.fn(async () => []),
      regenerateKnowledgeDraft: vi.fn(),
      approveKnowledgeDraft: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      listCandidateMemoriesByDate: vi.fn(async () => []),
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
        artifactType: 'daily-review-draft' as const,
        draftState: 'draft' as const,
        topicKey: 'reviewed-candidate-browser-aw-event-1',
        title: 'Reviewed candidate browser aw event 1',
        summary: '1 reviewed memory about Reviewed candidate browser aw event 1 from 2026-03-20.',
        body: '- Reviewed candidate browser aw event 1: 1 reviewed memory item included.',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
        derivedFromKnowledgeIds: [],
        version: 1,
        isCurrentBest: false,
        supersedesKnowledgeId: null,
        updatedAt: '2026-03-20T10:00:00.000Z',
        reviewedAt: '2026-03-20T10:00:00.000Z',
        recencyLabel: '2026-03-20',
        provenanceRefs: [
          {
            kind: 'reviewed-memory' as const,
            id: 'reviewed:candidate:browser:aw-event-1',
          },
        ],
      })),
      importSourceLedgers: vi.fn(async () => ({
        importedCount: 0,
        skippedCount: 0,
        scannedLedgerCount: 0,
        changedLedgerCount: 0,
        ledgerResults: [],
      })),
      listSourceAuditEvents: vi.fn(async () => []),
      listSourceInstanceSummaries: vi.fn(async () => []),
      updateSourceInstanceConfig: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(async () => ({
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft' as const,
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      })),
      deleteKnowledgeArtifact: vi.fn(),
      deleteSkillArtifact: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
      analyzeWorkSessions: vi.fn(async () => ({
        analysisWindow: {
          preset: 'last-6-hours' as const,
          startAt: '2026-05-12T06:00:00.000Z',
          endAt: '2026-05-12T12:00:00.000Z',
        },
        generatedAt: '2026-05-12T12:00:00.000Z',
        candidates: [],
        excludedMemoryEventIds: [],
      })),
      reviewWorkSessionCandidate: vi.fn(async () => ({
        reviewedWorkSession: {
          id: 'reviewed-work-session:example',
          candidateId: 'work-session-candidate:example',
          projectId: null,
          title: 'Example',
          summary: '',
          memoryEventIds: [],
          sourceTypes: [],
          timeRange: {
            startAt: '2026-05-12T12:00:00.000Z',
            endAt: '2026-05-12T12:00:00.000Z',
          },
          relationHints: [],
          reviewState: 'discarded' as const,
          reviewedAt: '2026-05-12T12:00:00.000Z',
          reviewedBy: 'user',
        },
      })),
      generateKnowledgeArticleDraft: vi.fn(async () => ({
        id: 'knowledge-article-draft:example',
        draftState: 'draft' as const,
        projectId: 'project:example',
        title: 'Example',
        summary: '',
        body: '',
        topicProposal: { kind: 'new-topic' as const, name: 'Example' },
        articleOperationProposal: { kind: 'create-new-article' as const },
        sourceReviewedWorkSessionIds: [],
        sourceMemoryEventIds: [],
        provenanceRefs: [],
        generatedAt: '2026-05-12T12:00:00.000Z',
      })),
      publishKnowledgeArticleDraft: vi.fn(async () => ({
        article: {
          id: 'knowledge-article:article-project-example-topic-example-example:v1',
          articleId: 'article:project-example:topic-example:example',
          projectId: 'project:example',
          topicId: 'topic:example',
          title: 'Example',
          summary: '',
          body: '',
          version: 1,
          isCurrentBest: true,
          supersedesArticleId: null,
          sourceReviewedWorkSessionIds: [],
          sourceMemoryEventIds: [],
          provenanceRefs: [],
          publishState: 'published' as const,
          publishedAt: '2026-05-12T12:00:00.000Z',
          publishedBy: 'user',
        },
      })),
      listKnowledgeArticleHistory: vi.fn(async () => []),
      listKnowledgeArticleTree: vi.fn(async () => ({ projects: [] })),
    }));
    const prepareWebAssets = vi.fn(async () => ({
      outputDir: '/tmp/mirrorbrain-web',
      indexHtmlPath: '/tmp/mirrorbrain-web/index.html',
      stylesPath: '/tmp/mirrorbrain-web/styles.css',
      scriptPath: '/tmp/mirrorbrain-web/main.js',
      stop: vi.fn(),
    }));
    const startMirrorBrainHttpServer = vi.fn(async () => httpServer);

    const result = await startMirrorBrainDevRuntime(
      {
        env: {
          MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
          MIRRORBRAIN_BROWSER_BUCKET_ID: '',
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
          MIRRORBRAIN_BROWSER_BUCKET_ID: '',
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
          stop: vi.fn(),
        })),
        startMirrorBrainService,
        createMirrorBrainService: vi.fn(() => ({
          service: runtimeService,
          syncBrowserMemory: runtimeService.syncBrowserMemory,
          syncShellMemory: runtimeService.syncShellMemory,
          listMemoryEvents: vi.fn(async () => ({
            items: [],
            pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          })),
          listMemoryNarratives: vi.fn(async () => []),
          queryMemory: vi.fn(async () => ({ items: [] })),
          listKnowledge: vi.fn(async () => []),
          listKnowledgeTopics: vi.fn(async () => []),
          getKnowledgeTopic: vi.fn(async () => ({
            id: 'knowledge-draft:example',
            artifactType: 'daily-review-draft' as const,
            draftState: 'draft' as const,
            topicKey: null,
            title: 'Daily Review Draft',
            summary: '',
            body: '',
            sourceReviewedMemoryIds: [],
            derivedFromKnowledgeIds: [],
            version: 1,
            isCurrentBest: false,
            supersedesKnowledgeId: null,
            reviewedAt: null,
            recencyLabel: '',
            provenanceRefs: [],
          })),
          listKnowledgeHistory: vi.fn(async () => []),
          getKnowledgeGraph: vi.fn(async () => ({
            generatedAt: '2026-03-20T10:00:00.000Z',
            stats: {
              topics: 0,
              knowledgeArtifacts: 0,
              wikilinkReferences: 0,
              similarityRelations: 0,
            },
            nodes: [],
            edges: [],
          })),
          buildTopicKnowledgeCandidates: vi.fn(async () => []),
          mergeTopicKnowledgeCandidate: vi.fn(),
          mergeDailyReviewIntoTopicKnowledge: vi.fn(),
          listSkillDrafts: vi.fn(async () => []),
          regenerateKnowledgeDraft: vi.fn(),
          approveKnowledgeDraft: vi.fn(),
          undoCandidateReview: vi.fn(),
          deleteCandidateMemory: vi.fn(),
          deleteKnowledgeArtifact: vi.fn(),
          deleteSkillArtifact: vi.fn(),
          listCandidateMemoriesByDate: vi.fn(async () => []),
          createDailyCandidateMemories: vi.fn(async () => []),
          suggestCandidateReviews: vi.fn(async () => []),
          createCandidateMemory: vi.fn(),
          reviewCandidateMemory: vi.fn(),
          generateKnowledgeFromReviewedMemories: vi.fn(),
          importSourceLedgers: vi.fn(async () => ({
            importedCount: 0,
            skippedCount: 0,
            scannedLedgerCount: 0,
            changedLedgerCount: 0,
            ledgerResults: [],
          })),
          listSourceAuditEvents: vi.fn(async () => []),
          listSourceInstanceSummaries: vi.fn(async () => []),
          updateSourceInstanceConfig: vi.fn(),
          generateSkillDraftFromReviewedMemories: vi.fn(),
          publishKnowledge: vi.fn(),
          publishSkillDraft: vi.fn(),
          analyzeWorkSessions: vi.fn(async () => ({
            analysisWindow: {
              preset: 'last-6-hours' as const,
              startAt: '2026-05-12T06:00:00.000Z',
              endAt: '2026-05-12T12:00:00.000Z',
            },
            generatedAt: '2026-05-12T12:00:00.000Z',
            candidates: [],
            excludedMemoryEventIds: [],
          })),
          reviewWorkSessionCandidate: vi.fn(async () => ({
            reviewedWorkSession: {
              id: 'reviewed-work-session:example',
              candidateId: 'work-session-candidate:example',
              projectId: null,
              title: 'Example',
              summary: '',
              memoryEventIds: [],
              sourceTypes: [],
              timeRange: {
                startAt: '2026-05-12T12:00:00.000Z',
                endAt: '2026-05-12T12:00:00.000Z',
              },
              relationHints: [],
              reviewState: 'discarded' as const,
              reviewedAt: '2026-05-12T12:00:00.000Z',
              reviewedBy: 'user',
            },
          })),
          generateKnowledgeArticleDraft: vi.fn(async () => ({
            id: 'knowledge-article-draft:example',
            draftState: 'draft' as const,
            projectId: 'project:example',
            title: 'Example',
            summary: '',
            body: '',
            topicProposal: { kind: 'new-topic' as const, name: 'Example' },
            articleOperationProposal: { kind: 'create-new-article' as const },
            sourceReviewedWorkSessionIds: [],
            sourceMemoryEventIds: [],
            provenanceRefs: [],
            generatedAt: '2026-05-12T12:00:00.000Z',
          })),
          publishKnowledgeArticleDraft: vi.fn(async () => ({
            article: {
              id: 'knowledge-article:article-project-example-topic-example-example:v1',
          articleId: 'article:project-example:topic-example:example',
          projectId: 'project:example',
              topicId: 'topic:example',
              title: 'Example',
              summary: '',
              body: '',
              version: 1,
              isCurrentBest: true,
              supersedesArticleId: null,
              sourceReviewedWorkSessionIds: [],
              sourceMemoryEventIds: [],
              provenanceRefs: [],
              publishState: 'published' as const,
              publishedAt: '2026-05-12T12:00:00.000Z',
              publishedBy: 'user',
            },
          })),
          listKnowledgeArticleHistory: vi.fn(async () => []),
          listKnowledgeArticleTree: vi.fn(async () => ({ projects: [] })),
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

  it('passes the configured ActivityWatch browser bucket id into service startup and API facade', async () => {
    const config = getMirrorBrainDevConfig({
      MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
      MIRRORBRAIN_BROWSER_BUCKET_ID: 'aw-watcher-web-chrome_laptop',
    });
    const runtimeService = {
      status: 'running' as const,
      config: config.config,
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome_laptop',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-05-12T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-05-12T10:00:00.000Z',
      })),
      stop: vi.fn(),
    };
    const startMirrorBrainService = vi.fn(() => runtimeService);
    const createMirrorBrainService = vi.fn(() => ({
      service: runtimeService,
      syncBrowserMemory: runtimeService.syncBrowserMemory,
      syncShellMemory: runtimeService.syncShellMemory,
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
      })),
      listMemoryNarratives: vi.fn(async () => []),
      queryMemory: vi.fn(async () => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      importSourceLedgers: vi.fn(async () => ({
        importedCount: 0,
        skippedCount: 0,
        scannedLedgerCount: 0,
        changedLedgerCount: 0,
        ledgerResults: [],
      })),
      createDailyCandidateMemories: vi.fn(async () => []),
      suggestCandidateReviews: vi.fn(async () => []),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    }));

    await startMirrorBrainDevRuntime(
      {
        env: {
          MIRRORBRAIN_WORKSPACE_DIR: '/tmp/mirrorbrain-workspace',
          MIRRORBRAIN_BROWSER_BUCKET_ID: 'aw-watcher-web-chrome_laptop',
        },
      },
      {
        assertDependenciesReachable: vi.fn(async () => undefined),
        prepareWebAssets: vi.fn(async () => ({
          outputDir: '/tmp/mirrorbrain-web',
          indexHtmlPath: '/tmp/mirrorbrain-web/index.html',
          stylesPath: '/tmp/mirrorbrain-web/styles.css',
          scriptPath: '/tmp/mirrorbrain-web/main.js',
          stop: vi.fn(),
        })),
        startMirrorBrainService,
        createMirrorBrainService:
          createMirrorBrainService as unknown as NonNullable<
            Parameters<typeof startMirrorBrainDevRuntime>[1]
          >['createMirrorBrainService'],
        startMirrorBrainHttpServer: vi.fn(async () => ({
          origin: 'http://127.0.0.1:3007',
          host: '127.0.0.1',
          port: 3007,
          stop: vi.fn(async () => undefined),
        })),
      },
    );

    expect(config.browserBucketId).toBe('aw-watcher-web-chrome_laptop');
    expect(startMirrorBrainService).toHaveBeenCalledWith({
      config: config.config,
      workspaceDir: '/tmp/mirrorbrain-workspace',
      browserBucketId: 'aw-watcher-web-chrome_laptop',
    });
    expect(createMirrorBrainService).toHaveBeenCalledWith({
      service: runtimeService,
      workspaceDir: '/tmp/mirrorbrain-workspace',
      browserBucketId: 'aw-watcher-web-chrome_laptop',
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
        'MIRRORBRAIN_WORKSPACE_DIR=/tmp/mirrorbrain-workspace',
        'MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600',
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
          stop: vi.fn(),
        })),
        startMirrorBrainService,
        createMirrorBrainService: vi.fn(() => ({
          service: runtimeService,
          syncBrowserMemory: runtimeService.syncBrowserMemory,
          syncShellMemory: runtimeService.syncShellMemory,
          listMemoryEvents: vi.fn(async () => ({
            items: [],
            pagination: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          })),
          listMemoryNarratives: vi.fn(async () => []),
          queryMemory: vi.fn(async () => ({ items: [] })),
          listKnowledge: vi.fn(async () => []),
          listKnowledgeTopics: vi.fn(async () => []),
          getKnowledgeTopic: vi.fn(async () => ({
            id: 'knowledge-draft:example',
            artifactType: 'daily-review-draft' as const,
            draftState: 'draft' as const,
            topicKey: null,
            title: 'Daily Review Draft',
            summary: '',
            body: '',
            sourceReviewedMemoryIds: [],
            derivedFromKnowledgeIds: [],
            version: 1,
            isCurrentBest: false,
            supersedesKnowledgeId: null,
            reviewedAt: null,
            recencyLabel: '',
            provenanceRefs: [],
          })),
          listKnowledgeHistory: vi.fn(async () => []),
          getKnowledgeGraph: vi.fn(async () => ({
            generatedAt: '2026-03-20T10:00:00.000Z',
            stats: {
              topics: 0,
              knowledgeArtifacts: 0,
              wikilinkReferences: 0,
              similarityRelations: 0,
            },
            nodes: [],
            edges: [],
          })),
          buildTopicKnowledgeCandidates: vi.fn(async () => []),
          mergeTopicKnowledgeCandidate: vi.fn(),
          mergeDailyReviewIntoTopicKnowledge: vi.fn(),
          listSkillDrafts: vi.fn(async () => []),
          regenerateKnowledgeDraft: vi.fn(),
          approveKnowledgeDraft: vi.fn(),
          undoCandidateReview: vi.fn(),
          deleteCandidateMemory: vi.fn(),
          deleteKnowledgeArtifact: vi.fn(),
          deleteSkillArtifact: vi.fn(),
          listCandidateMemoriesByDate: vi.fn(async () => []),
          createDailyCandidateMemories: vi.fn(async () => []),
          suggestCandidateReviews: vi.fn(async () => []),
          createCandidateMemory: vi.fn(),
          reviewCandidateMemory: vi.fn(),
          generateKnowledgeFromReviewedMemories: vi.fn(),
          importSourceLedgers: vi.fn(async () => ({
            importedCount: 0,
            skippedCount: 0,
            scannedLedgerCount: 0,
            changedLedgerCount: 0,
            ledgerResults: [],
          })),
          listSourceAuditEvents: vi.fn(async () => []),
          listSourceInstanceSummaries: vi.fn(async () => []),
          updateSourceInstanceConfig: vi.fn(),
          generateSkillDraftFromReviewedMemories: vi.fn(),
          publishKnowledge: vi.fn(),
          publishSkillDraft: vi.fn(),
          analyzeWorkSessions: vi.fn(async () => ({
            analysisWindow: {
              preset: 'last-6-hours' as const,
              startAt: '2026-05-12T06:00:00.000Z',
              endAt: '2026-05-12T12:00:00.000Z',
            },
            generatedAt: '2026-05-12T12:00:00.000Z',
            candidates: [],
            excludedMemoryEventIds: [],
          })),
          reviewWorkSessionCandidate: vi.fn(async () => ({
            reviewedWorkSession: {
              id: 'reviewed-work-session:example',
              candidateId: 'work-session-candidate:example',
              projectId: null,
              title: 'Example',
              summary: '',
              memoryEventIds: [],
              sourceTypes: [],
              timeRange: {
                startAt: '2026-05-12T12:00:00.000Z',
                endAt: '2026-05-12T12:00:00.000Z',
              },
              relationHints: [],
              reviewState: 'discarded' as const,
              reviewedAt: '2026-05-12T12:00:00.000Z',
              reviewedBy: 'user',
            },
          })),
          generateKnowledgeArticleDraft: vi.fn(async () => ({
            id: 'knowledge-article-draft:example',
            draftState: 'draft' as const,
            projectId: 'project:example',
            title: 'Example',
            summary: '',
            body: '',
            topicProposal: { kind: 'new-topic' as const, name: 'Example' },
            articleOperationProposal: { kind: 'create-new-article' as const },
            sourceReviewedWorkSessionIds: [],
            sourceMemoryEventIds: [],
            provenanceRefs: [],
            generatedAt: '2026-05-12T12:00:00.000Z',
          })),
          publishKnowledgeArticleDraft: vi.fn(async () => ({
            article: {
              id: 'knowledge-article:article-project-example-topic-example-example:v1',
          articleId: 'article:project-example:topic-example:example',
          projectId: 'project:example',
              topicId: 'topic:example',
              title: 'Example',
              summary: '',
              body: '',
              version: 1,
              isCurrentBest: true,
              supersedesArticleId: null,
              sourceReviewedWorkSessionIds: [],
              sourceMemoryEventIds: [],
              provenanceRefs: [],
              publishState: 'published' as const,
              publishedAt: '2026-05-12T12:00:00.000Z',
              publishedBy: 'user',
            },
          })),
          listKnowledgeArticleHistory: vi.fn(async () => []),
          listKnowledgeArticleTree: vi.fn(async () => ({ projects: [] })),
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
      }),
      workspaceDir: '/tmp/mirrorbrain-workspace',
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
            component: 'QMD Workspace' as const,
            message: 'QMD index directory is not writable.',
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
          'Missing required env var MIRRORBRAIN_ACTIVITYWATCH_BASE_URL. Example: http://127.0.0.1:5600',
        ],
        'QMD Workspace': [
          'QMD index directory is not writable.',
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
          'QMD Workspace': 'ready',
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
