import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';

import {
  DEFAULT_STORED_RESOURCE_CONFIGURATION,
  type StoredResourceConfiguration,
} from '../../modules/resource-configuration/index.js';

export interface ResourceConfigurationStore {
  readResourceConfiguration(): Promise<StoredResourceConfiguration>;
  writeResourceConfiguration(config: StoredResourceConfiguration): Promise<void>;
}

interface CreateFileResourceConfigurationStoreInput {
  envPath?: string;
  workspaceDir?: string;
}

const RESOURCE_ENV_KEYS = {
  llm: {
    apiBase: 'MIRRORBRAIN_LLM_API_BASE',
    apiKey: 'MIRRORBRAIN_LLM_API_KEY',
    model: 'MIRRORBRAIN_LLM_MODEL',
  },
  embedding: {
    apiBase: 'MIRRORBRAIN_EMBEDDING_API_BASE',
    apiKey: 'MIRRORBRAIN_EMBEDDING_API_KEY',
    model: 'MIRRORBRAIN_EMBEDDING_MODEL',
  },
  tavily: {
    apiBase: 'MIRRORBRAIN_TAVILY_API_BASE',
    apiKey: 'MIRRORBRAIN_TAVILY_API_KEY',
    maxResults: 'MIRRORBRAIN_TAVILY_MAX_RESULTS',
  },
} as const;

function getEnvPath(input: CreateFileResourceConfigurationStoreInput): string {
  return input.envPath ?? join(process.cwd(), '.env');
}

function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const trimmedLine = rawLine.trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (key.length > 0) {
      env[key] = value;
    }
  }

  return env;
}

async function readDotEnv(envPath: string): Promise<string> {
  try {
    return await readFile(envPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

function parseMaxResults(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function applyEnvValue(input: {
  content: string;
  key: string;
  value: string;
}): string {
  const lines = input.content.length === 0 ? [] : input.content.split(/\r?\n/u);
  const keyPattern = new RegExp(`^\\s*${input.key}\\s*=`, 'u');
  const nextLine = `${input.key}=${input.value}`;
  let replaced = false;

  const nextLines = lines.map((line) => {
    if (keyPattern.test(line)) {
      replaced = true;
      return nextLine;
    }

    return line;
  });

  if (!replaced) {
    nextLines.push(nextLine);
  }

  return nextLines.join('\n');
}

function serializeResourceEnv(
  currentContent: string,
  config: StoredResourceConfiguration,
): string {
  const values: Record<string, string> = {
    [RESOURCE_ENV_KEYS.llm.apiBase]: config.llm.baseUrl,
    [RESOURCE_ENV_KEYS.llm.apiKey]: config.llm.apiKey ?? '',
    [RESOURCE_ENV_KEYS.llm.model]: config.llm.model,
    [RESOURCE_ENV_KEYS.embedding.apiBase]: config.embedding.baseUrl,
    [RESOURCE_ENV_KEYS.embedding.apiKey]: config.embedding.apiKey ?? '',
    [RESOURCE_ENV_KEYS.embedding.model]: config.embedding.model,
    [RESOURCE_ENV_KEYS.tavily.apiBase]: config.search.baseUrl,
    [RESOURCE_ENV_KEYS.tavily.apiKey]: config.search.apiKey ?? '',
    [RESOURCE_ENV_KEYS.tavily.maxResults]:
      config.search.maxResults === 0 ? '' : String(config.search.maxResults),
  };

  let nextContent = currentContent.trimEnd();

  for (const [key, value] of Object.entries(values)) {
    nextContent = applyEnvValue({
      content: nextContent,
      key,
      value,
    });
  }

  return `${nextContent.trimEnd()}\n`;
}

export function createFileResourceConfigurationStore(
  input: CreateFileResourceConfigurationStoreInput,
): ResourceConfigurationStore {
  const envPath = getEnvPath(input);

  return {
    async readResourceConfiguration() {
      const env = parseDotEnv(await readDotEnv(envPath));

      return {
        llm: {
          ...DEFAULT_STORED_RESOURCE_CONFIGURATION.llm,
          baseUrl: env[RESOURCE_ENV_KEYS.llm.apiBase] ?? '',
          apiKey: env[RESOURCE_ENV_KEYS.llm.apiKey] ?? undefined,
          model: env[RESOURCE_ENV_KEYS.llm.model] ?? '',
        },
        embedding: {
          ...DEFAULT_STORED_RESOURCE_CONFIGURATION.embedding,
          baseUrl: env[RESOURCE_ENV_KEYS.embedding.apiBase] ?? '',
          apiKey: env[RESOURCE_ENV_KEYS.embedding.apiKey] ?? undefined,
          model: env[RESOURCE_ENV_KEYS.embedding.model] ?? '',
        },
        search: {
          ...DEFAULT_STORED_RESOURCE_CONFIGURATION.search,
          baseUrl: env[RESOURCE_ENV_KEYS.tavily.apiBase] ?? '',
          apiKey: env[RESOURCE_ENV_KEYS.tavily.apiKey] ?? undefined,
          maxResults: parseMaxResults(env[RESOURCE_ENV_KEYS.tavily.maxResults]),
        },
      };
    },
    async writeResourceConfiguration(config) {
      await mkdir(dirname(envPath), { recursive: true });
      await writeFile(envPath, serializeResourceEnv(await readDotEnv(envPath), config));
    },
  };
}
