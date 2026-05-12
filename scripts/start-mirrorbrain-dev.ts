import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { open, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

import {
  createMirrorBrainService,
  startMirrorBrainService,
} from '../src/apps/mirrorbrain-service/index.js';
import { startMirrorBrainHttpServer } from '../src/apps/mirrorbrain-http-server/index.js';
import { getMirrorBrainConfig } from '../src/shared/config/index.js';
import type { MirrorBrainConfig } from '../src/shared/types/index.js';

interface MirrorBrainDevConfigResult {
  workspaceDir: string;
  config: MirrorBrainConfig;
}

interface PrepareMirrorBrainWebAssetsInput {
  projectDir?: string;
  outputDir?: string;
}

interface PreparedMirrorBrainWebAssets {
  outputDir: string;
  indexHtmlPath: string;
  stylesPath: string;
  scriptPath: string;
  stop(): void;
}

interface ReactWebBuildWatcher {
  stop(): void;
}

interface StartMirrorBrainDevRuntimeInput {
  env?: NodeJS.ProcessEnv;
  projectDir?: string;
}

type MirrorBrainStartupComponent =
  | 'MirrorBrain config'
  | 'OpenViking'
  | 'ActivityWatch'
  | 'MirrorBrain startup';

interface MirrorBrainStartupIssue {
  component: MirrorBrainStartupComponent;
  message: string;
}

interface RunMirrorBrainStartupCliInput {
  env?: NodeJS.ProcessEnv;
  projectDir?: string;
}

interface StartDetachedMirrorBrainProcessInput {
  env: NodeJS.ProcessEnv;
  origin: string;
  projectDir: string;
}

interface DetachedMirrorBrainProcess {
  processId: number;
  logPath: string;
}

interface RunMirrorBrainStartupCliDependencies {
  inspectDependencies?: typeof inspectMirrorBrainStartupDependencies;
  startDetachedProcess?: typeof startMirrorBrainDetachedProcess;
}

type MirrorBrainStartupCliResult =
  | {
      status: 'failed';
      issuesByComponent: Partial<Record<MirrorBrainStartupComponent, string[]>>;
    }
  | {
      status: 'started';
      summary: {
        serviceAddress: string;
        processId: number;
        logPath: string;
        dependencyStatus: Record<'OpenViking' | 'ActivityWatch', 'ready'>;
        nextSteps: string[];
      };
    };

interface StartMirrorBrainDevRuntimeDependencies {
  assertDependenciesReachable?: typeof assertMirrorBrainDependenciesReachable;
  prepareWebAssets?: typeof prepareMirrorBrainWebAssets;
  startMirrorBrainService?: typeof startMirrorBrainService;
  createMirrorBrainService?: typeof createMirrorBrainService;
  startMirrorBrainHttpServer?: typeof startMirrorBrainHttpServer;
}

interface MirrorBrainDevRuntime {
  origin: string;
  host: string;
  port: number;
  stop(): Promise<void>;
}

interface WaitForFileToExistInput {
  intervalMs?: number;
  timeoutMs?: number;
}

interface SpawnReactWebBuildWatcherInput {
  projectDir: string;
  outputDir?: string;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? fallback : parsed;
}

const REQUIRED_ENV_EXAMPLES: Record<string, string> = {
  MIRRORBRAIN_WORKSPACE_DIR: '/path_to_workspace/mirrorbrain-workspace',
  MIRRORBRAIN_ACTIVITYWATCH_BASE_URL: 'http://127.0.0.1:5600',
  MIRRORBRAIN_OPENVIKING_BASE_URL: 'http://127.0.0.1:1933',
};

function parseDotEnvFile(content: string): NodeJS.ProcessEnv {
  const parsedEnv: NodeJS.ProcessEnv = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key.length === 0) {
      continue;
    }

    parsedEnv[key] = value;
  }

  return parsedEnv;
}

async function loadMirrorBrainProjectEnv(
  projectDir: string,
): Promise<NodeJS.ProcessEnv> {
  const envPath = join(projectDir, '.env');

  if (!existsSync(envPath)) {
    return {};
  }

  const envFile = await readFile(envPath, 'utf8');

  return parseDotEnvFile(envFile);
}

export function getMirrorBrainDevConfig(
  env: NodeJS.ProcessEnv = process.env,
): MirrorBrainDevConfigResult {
  const defaultConfig = getMirrorBrainConfig();

  return {
    workspaceDir: env.MIRRORBRAIN_WORKSPACE_DIR ?? process.cwd(),
    config: {
      service: {
        host: env.MIRRORBRAIN_HTTP_HOST ?? defaultConfig.service.host,
        port: parseInteger(
          env.MIRRORBRAIN_HTTP_PORT,
          defaultConfig.service.port,
        ),
      },
      activityWatch: {
        baseUrl:
          env.MIRRORBRAIN_ACTIVITYWATCH_BASE_URL ??
          defaultConfig.activityWatch.baseUrl,
      },
      openViking: {
        baseUrl:
          env.MIRRORBRAIN_OPENVIKING_BASE_URL ??
          defaultConfig.openViking.baseUrl,
      },
      sync: {
        pollingIntervalMs: parseInteger(
          env.MIRRORBRAIN_SYNC_INTERVAL_MS,
          defaultConfig.sync.pollingIntervalMs,
        ),
        initialBackfillHours: parseInteger(
          env.MIRRORBRAIN_INITIAL_BACKFILL_HOURS,
          defaultConfig.sync.initialBackfillHours,
        ),
      },
    },
  };
}

export async function assertMirrorBrainDependenciesReachable(
  config: MirrorBrainConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let activityWatchResponse: Response;

  try {
    activityWatchResponse = await fetchImpl(
      `${config.activityWatch.baseUrl}/api/0/buckets`,
    );
  } catch {
    throw new Error(
      `ActivityWatch is unreachable for the local MVP runtime. URL: ${config.activityWatch.baseUrl}`,
    );
  }

  if (!activityWatchResponse.ok) {
    throw new Error(
      `ActivityWatch is unreachable for the local MVP runtime. URL: ${config.activityWatch.baseUrl}`,
    );
  }

  let openVikingResponse: Response;

  try {
    openVikingResponse = await fetchImpl(
      `${config.openViking.baseUrl}/api/v1/fs/ls?uri=${encodeURIComponent(
        'viking://resources/',
      )}&output=original`,
    );
  } catch {
    throw new Error(
      `OpenViking is unreachable for the local MVP runtime. URL: ${config.openViking.baseUrl}`,
    );
  }

  if (!openVikingResponse.ok) {
    throw new Error(
      `OpenViking is unreachable for the local MVP runtime. URL: ${config.openViking.baseUrl}`,
    );
  }
}

function collectMissingRequiredEnvIssues(
  env: NodeJS.ProcessEnv,
): MirrorBrainStartupIssue[] {
  const issues: MirrorBrainStartupIssue[] = [];

  for (const [key, example] of Object.entries(REQUIRED_ENV_EXAMPLES)) {
    const value = env[key];

    if (value === undefined || value.trim().length === 0) {
      issues.push({
        component: 'MirrorBrain config',
        message: `Missing required env var ${key}. Example: ${example}`,
      });
    }
  }

  return issues;
}

export async function inspectMirrorBrainStartupDependencies(
  config: MirrorBrainConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<MirrorBrainStartupIssue[]> {
  const issues: MirrorBrainStartupIssue[] = [];

  try {
    const openVikingResponse = await fetchImpl(
      `${config.openViking.baseUrl}/api/v1/fs/ls?uri=${encodeURIComponent(
        'viking://resources/',
      )}&output=original`,
    );

    if (!openVikingResponse.ok) {
      issues.push({
        component: 'OpenViking',
        message: `OpenViking is unreachable at ${config.openViking.baseUrl}.`,
      });
    }
  } catch {
    issues.push({
      component: 'OpenViking',
      message: `OpenViking is unreachable at ${config.openViking.baseUrl}.`,
    });
  }

  try {
    const bucketsResponse = await fetchImpl(
      `${config.activityWatch.baseUrl}/api/0/buckets`,
    );

    if (!bucketsResponse.ok) {
      issues.push({
        component: 'ActivityWatch',
        message: `ActivityWatch is unreachable at ${config.activityWatch.baseUrl}.`,
      });

      return issues;
    }

    const buckets = (await bucketsResponse.json()) as Record<string, unknown>;
    const browserBucketKeys = Object.keys(buckets).filter((bucketKey) =>
      bucketKey.includes('aw-watcher-web'),
    );

    if (browserBucketKeys.length === 0) {
      issues.push({
        component: 'ActivityWatch',
        message:
          'No browser watcher source was found in ActivityWatch. Install and enable aw-watcher-web first.',
      });

      return issues;
    }

    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    let hasRecentBrowserEvents = false;

    for (const bucketKey of browserBucketKeys) {
      const eventsResponse = await fetchImpl(
        `${config.activityWatch.baseUrl}/api/0/buckets/${encodeURIComponent(
          bucketKey,
        )}/events?start=${encodeURIComponent(
          start.toISOString(),
        )}&end=${encodeURIComponent(now.toISOString())}`,
      );

      if (!eventsResponse.ok) {
        continue;
      }

      const events = (await eventsResponse.json()) as unknown[];

      if (events.length > 0) {
        hasRecentBrowserEvents = true;
        break;
      }
    }

    if (!hasRecentBrowserEvents) {
      issues.push({
        component: 'ActivityWatch',
        message:
          'No browser events were found in the last hour for ActivityWatch.',
      });
    }
  } catch {
    issues.push({
      component: 'ActivityWatch',
      message: `ActivityWatch is unreachable at ${config.activityWatch.baseUrl}.`,
    });
  }

  return issues;
}

function groupStartupIssuesByComponent(
  issues: MirrorBrainStartupIssue[],
): Partial<Record<MirrorBrainStartupComponent, string[]>> {
  const grouped: Partial<Record<MirrorBrainStartupComponent, string[]>> = {};

  for (const issue of issues) {
    const current = grouped[issue.component] ?? [];
    current.push(issue.message);
    grouped[issue.component] = current;
  }

  return grouped;
}

export async function startMirrorBrainDetachedProcess(
  input: StartDetachedMirrorBrainProcessInput,
): Promise<DetachedMirrorBrainProcess> {
  const logDir = join(input.projectDir, '.mirrorbrain');
  const logPath = join(logDir, 'mirrorbrain-dev.log');
  const scriptPath = join(input.projectDir, 'scripts', 'start-mirrorbrain-dev.ts');
  const tsxCliPath = join(input.projectDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');

  await mkdir(logDir, { recursive: true });

  const stdoutHandle = await open(logPath, 'a');
  const child = spawn(process.execPath, [tsxCliPath, scriptPath], {
    cwd: input.projectDir,
    detached: true,
    env: {
      ...input.env,
      MIRRORBRAIN_DEV_CHILD_PROCESS: '1',
    },
    stdio: ['ignore', stdoutHandle.fd, stdoutHandle.fd],
  });

  child.unref();
  await stdoutHandle.close();

  if (child.pid === undefined) {
    throw new Error('MirrorBrain startup process did not return a pid.');
  }

  return {
    processId: child.pid,
    logPath,
  };
}

export async function runMirrorBrainStartupCli(
  input: RunMirrorBrainStartupCliInput = {},
  dependencies: RunMirrorBrainStartupCliDependencies = {},
): Promise<MirrorBrainStartupCliResult> {
  const projectDir = input.projectDir ?? process.cwd();
  const projectEnv = await loadMirrorBrainProjectEnv(projectDir);
  const mergedEnv = {
    ...process.env,
    ...projectEnv,
    ...input.env,
  };
  const { config } = getMirrorBrainDevConfig(mergedEnv);
  const inspectDependencies =
    dependencies.inspectDependencies ?? inspectMirrorBrainStartupDependencies;
  const startDetachedProcess =
    dependencies.startDetachedProcess ?? startMirrorBrainDetachedProcess;
  const issues = [
    ...collectMissingRequiredEnvIssues(mergedEnv),
    ...(await inspectDependencies(config)),
  ];

  if (issues.length > 0) {
    return {
      status: 'failed',
      issuesByComponent: groupStartupIssuesByComponent(issues),
    };
  }

  const origin = `http://${config.service.host}:${config.service.port}`;
  const detachedProcess = await startDetachedProcess({
    env: mergedEnv,
    origin,
    projectDir,
  });

  return {
    status: 'started',
    summary: {
      serviceAddress: origin,
      processId: detachedProcess.processId,
      logPath: detachedProcess.logPath,
      dependencyStatus: {
        OpenViking: 'ready',
        ActivityWatch: 'ready',
      },
      nextSteps: [
        'Connect MirrorBrain to openclaw using the minimum memory retrieval plugin example.',
        'Run the minimum demo question: 我昨天做了什么？',
      ],
    },
  };
}

export async function prepareMirrorBrainWebAssets(
  input: (PrepareMirrorBrainWebAssetsInput & {
    spawnWebBuildWatcher?: typeof spawnReactWebBuildWatcher;
    waitForFile?: typeof waitForFileToExist;
  }) = {},
): Promise<PreparedMirrorBrainWebAssets> {
  const projectDir = input.projectDir ?? process.cwd();
  const reactAppDir = join(projectDir, 'src', 'apps', 'mirrorbrain-web-react');
  const outputDir = input.outputDir ?? join(reactAppDir, 'dist');
  const indexHtmlPath = join(outputDir, 'index.html');
  const spawnWebBuildWatcher =
    input.spawnWebBuildWatcher ?? spawnReactWebBuildWatcher;
  const waitForFile = input.waitForFile ?? waitForFileToExist;
  const watcher = await spawnWebBuildWatcher({ projectDir, outputDir });

  if (!existsSync(indexHtmlPath)) {
    await waitForFile(indexHtmlPath);
  }

  return {
    outputDir,
    indexHtmlPath,
    stylesPath: '', // Not used with @fastify/static
    scriptPath: '', // Not used with @fastify/static
    stop: () => watcher.stop(),
  };
}

export async function startMirrorBrainDevRuntime(
  input: StartMirrorBrainDevRuntimeInput = {},
  dependencies: StartMirrorBrainDevRuntimeDependencies = {},
): Promise<MirrorBrainDevRuntime> {
  const projectDir = input.projectDir ?? process.cwd();
  const projectEnv = await loadMirrorBrainProjectEnv(projectDir);
  const mergedEnv = {
    ...projectEnv,
    ...input.env,
  };
  const { workspaceDir, config } = getMirrorBrainDevConfig(mergedEnv);
  const assertDependenciesReachable =
    dependencies.assertDependenciesReachable ??
    assertMirrorBrainDependenciesReachable;
  const prepareWebAssets =
    dependencies.prepareWebAssets ?? prepareMirrorBrainWebAssets;
  const startRuntimeService =
    dependencies.startMirrorBrainService ?? startMirrorBrainService;
  const createRuntimeApi =
    dependencies.createMirrorBrainService ?? createMirrorBrainService;
  const startHttpServer =
    dependencies.startMirrorBrainHttpServer ?? startMirrorBrainHttpServer;

  await assertDependenciesReachable(config);

  const webAssets = await prepareWebAssets({
    projectDir,
  });
  const runtimeService = startRuntimeService({
    config,
    workspaceDir,
    shellHistoryPath: mergedEnv.MIRRORBRAIN_SHELL_HISTORY_PATH,
  });
  const api = createRuntimeApi({
    service: runtimeService,
    workspaceDir,
  });
  const httpServer = await startHttpServer({
    service: api,
    host: config.service.host,
    port: config.service.port,
    staticDir: webAssets.outputDir,
  });

  return {
    origin: httpServer.origin,
    host: httpServer.host,
    port: httpServer.port,
    stop: async () => {
      await httpServer.stop();
      webAssets.stop();
      runtimeService.stop();
    },
  };
}

export async function waitForFileToExist(
  path: string,
  input: WaitForFileToExistInput = {},
): Promise<void> {
  const timeoutMs = input.timeoutMs ?? 30000;
  const intervalMs = input.intervalMs ?? 100;
  const startedAt = Date.now();

  while (!existsSync(path)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for frontend build output at ${path}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function spawnReactWebBuildWatcher(
  input: SpawnReactWebBuildWatcherInput,
): Promise<ReactWebBuildWatcher> {
  const reactAppDir = join(input.projectDir, 'src', 'apps', 'mirrorbrain-web-react');
  const vitePath = join(reactAppDir, 'node_modules', '.bin', 'vite');
  const args = ['build', '--watch'];

  if (input.outputDir !== undefined) {
    args.push('--outDir', input.outputDir, '--emptyOutDir');
  }

  const child = spawn(vitePath, args, {
    cwd: reactAppDir,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
    stdio: 'inherit',
  });

  const ensureAlive = () => {
    if (child.exitCode !== null) {
      throw new Error(`React web build watcher exited early with code ${child.exitCode}`);
    }
  };

  await new Promise((resolve) => setTimeout(resolve, 50));
  ensureAlive();

  return {
    stop: () => {
      if (!child.killed) {
        child.kill();
      }
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.MIRRORBRAIN_DEV_CHILD_PROCESS === '1') {
    startMirrorBrainDevRuntime()
      .then((runtime) => {
        console.log(`MirrorBrain MVP running at ${runtime.origin}`);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown startup error.';

        console.error(message);
        process.exitCode = 1;
      });
  } else {
    runMirrorBrainStartupCli()
      .then((result) => {
        if (result.status === 'failed') {
          for (const [component, issues] of Object.entries(
            result.issuesByComponent,
          )) {
            console.error(`${component}:`);

            for (const issue of issues ?? []) {
              console.error(`- ${issue}`);
            }
          }

          process.exitCode = 1;

          return;
        }

        console.log(`MirrorBrain service: ${result.summary.serviceAddress}`);
        console.log(`MirrorBrain pid: ${result.summary.processId}`);
        console.log(`MirrorBrain logs: ${result.summary.logPath}`);
        console.log('OpenViking: ready');
        console.log('ActivityWatch: ready');

        for (const nextStep of result.summary.nextSteps) {
          console.log(`Next: ${nextStep}`);
        }
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown startup error.';

        console.error(message);
        process.exitCode = 1;
      });
  }
}
