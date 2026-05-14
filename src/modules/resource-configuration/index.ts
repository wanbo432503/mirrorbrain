export type OpenAICompatibleResourceKind = 'llm' | 'embedding';

export interface OpenAICompatibleResourceConfig {
  enabled: boolean;
  providerName: string;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TavilySearchResourceConfig {
  enabled: boolean;
  providerName: 'tavily';
  baseUrl: string;
  apiKeyConfigured: boolean;
  maxResults: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ResourceConfiguration {
  llm: OpenAICompatibleResourceConfig;
  embedding: OpenAICompatibleResourceConfig;
  search: TavilySearchResourceConfig;
}

export interface StoredOpenAICompatibleResourceConfig
  extends Omit<OpenAICompatibleResourceConfig, 'apiKeyConfigured'> {
  apiKey?: string;
}

export interface StoredTavilySearchResourceConfig
  extends Omit<TavilySearchResourceConfig, 'apiKeyConfigured'> {
  apiKey?: string;
}

export interface StoredResourceConfiguration {
  llm: StoredOpenAICompatibleResourceConfig;
  embedding: StoredOpenAICompatibleResourceConfig;
  search: StoredTavilySearchResourceConfig;
}

export interface OpenAICompatibleResourceConfigUpdate {
  enabled: boolean;
  providerName: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  updatedBy: string;
}

export interface TavilySearchResourceConfigUpdate {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  maxResults: number;
  updatedBy: string;
}

export interface ResourceConfigurationUpdate {
  llm?: OpenAICompatibleResourceConfigUpdate;
  embedding?: OpenAICompatibleResourceConfigUpdate;
  search?: TavilySearchResourceConfigUpdate;
}

export const DEFAULT_STORED_RESOURCE_CONFIGURATION: StoredResourceConfiguration = {
  llm: {
    enabled: false,
    providerName: 'OpenAI-compatible chat',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
  },
  embedding: {
    enabled: false,
    providerName: 'OpenAI-compatible embeddings',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
  },
  search: {
    enabled: false,
    providerName: 'tavily',
    baseUrl: 'https://api.tavily.com',
    maxResults: 5,
  },
};

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeOptionalApiKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function hasApiKey(value: string | undefined): boolean {
  return normalizeOptionalApiKey(value) !== undefined;
}

function redactOpenAICompatibleConfig(
  config: StoredOpenAICompatibleResourceConfig,
): OpenAICompatibleResourceConfig {
  return {
    enabled: config.enabled,
    providerName: config.providerName,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKeyConfigured: hasApiKey(config.apiKey),
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  };
}

function redactSearchConfig(
  config: StoredTavilySearchResourceConfig,
): TavilySearchResourceConfig {
  return {
    enabled: config.enabled,
    providerName: 'tavily',
    baseUrl: config.baseUrl,
    apiKeyConfigured: hasApiKey(config.apiKey),
    maxResults: config.maxResults,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  };
}

export function redactResourceConfiguration(
  config: StoredResourceConfiguration,
): ResourceConfiguration {
  return {
    llm: redactOpenAICompatibleConfig(config.llm),
    embedding: redactOpenAICompatibleConfig(config.embedding),
    search: redactSearchConfig(config.search),
  };
}

export function mergeResourceConfigurationUpdate(
  current: StoredResourceConfiguration,
  update: ResourceConfigurationUpdate,
  updatedAt: string,
): StoredResourceConfiguration {
  return {
    llm: update.llm
      ? mergeOpenAICompatibleResourceConfig(current.llm, update.llm, updatedAt)
      : current.llm,
    embedding: update.embedding
      ? mergeOpenAICompatibleResourceConfig(current.embedding, update.embedding, updatedAt)
      : current.embedding,
    search: update.search
      ? mergeSearchResourceConfig(current.search, update.search, updatedAt)
      : current.search,
  };
}

function mergeOpenAICompatibleResourceConfig(
  current: StoredOpenAICompatibleResourceConfig,
  update: OpenAICompatibleResourceConfigUpdate,
  updatedAt: string,
): StoredOpenAICompatibleResourceConfig {
  return {
    enabled: update.enabled,
    providerName: normalizeText(update.providerName),
    baseUrl: normalizeText(update.baseUrl),
    model: normalizeText(update.model),
    apiKey: normalizeOptionalApiKey(update.apiKey) ?? current.apiKey,
    updatedAt,
    updatedBy: normalizeText(update.updatedBy),
  };
}

function mergeSearchResourceConfig(
  current: StoredTavilySearchResourceConfig,
  update: TavilySearchResourceConfigUpdate,
  updatedAt: string,
): StoredTavilySearchResourceConfig {
  return {
    enabled: update.enabled,
    providerName: 'tavily',
    baseUrl: normalizeText(update.baseUrl),
    apiKey: normalizeOptionalApiKey(update.apiKey) ?? current.apiKey,
    maxResults: Math.max(1, Math.trunc(update.maxResults)),
    updatedAt,
    updatedBy: normalizeText(update.updatedBy),
  };
}
