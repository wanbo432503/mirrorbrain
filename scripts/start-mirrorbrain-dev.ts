import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';

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
}

interface StartMirrorBrainDevRuntimeInput {
  env?: NodeJS.ProcessEnv;
  projectDir?: string;
}

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

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? fallback : parsed;
}

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

export async function prepareMirrorBrainWebAssets(
  input: PrepareMirrorBrainWebAssetsInput = {},
): Promise<PreparedMirrorBrainWebAssets> {
  const projectDir = input.projectDir ?? process.cwd();
  const outputDir = input.outputDir ?? join(projectDir, '.mirrorbrain-web');
  const webDir = join(projectDir, 'src', 'apps', 'mirrorbrain-web');
  const indexHtmlPath = join(outputDir, 'index.html');
  const stylesPath = join(outputDir, 'styles.css');
  const scriptPath = join(outputDir, 'main.js');
  const sourceScript = await readFile(join(webDir, 'main.ts'), 'utf8');
  const transpiledScript = ts.transpileModule(sourceScript, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  });

  await mkdir(outputDir, { recursive: true });
  await cp(join(webDir, 'index.html'), indexHtmlPath);
  await cp(join(webDir, 'styles.css'), stylesPath);
  await writeFile(scriptPath, transpiledScript.outputText, 'utf8');

  return {
    outputDir,
    indexHtmlPath,
    stylesPath,
    scriptPath,
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
      runtimeService.stop();
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
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
}
