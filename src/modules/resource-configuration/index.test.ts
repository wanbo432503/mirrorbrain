import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STORED_RESOURCE_CONFIGURATION,
  mergeResourceConfigurationUpdate,
  redactResourceConfiguration,
} from './index.js';

describe('resource configuration', () => {
  it('redacts provider API keys from resource configuration views', () => {
    const view = redactResourceConfiguration({
      ...DEFAULT_STORED_RESOURCE_CONFIGURATION,
      llm: {
        ...DEFAULT_STORED_RESOURCE_CONFIGURATION.llm,
        apiKey: 'secret-llm-key',
      },
      search: {
        ...DEFAULT_STORED_RESOURCE_CONFIGURATION.search,
        apiKey: 'secret-search-key',
      },
    });

    expect(view.llm).toMatchObject({
      enabled: false,
      apiKeyConfigured: true,
      baseUrl: '',
    });
    expect(view.search).toMatchObject({
      apiKeyConfigured: true,
      providerName: 'tavily',
    });
    expect(JSON.stringify(view)).not.toContain('secret');
  });

  it('merges resource updates without clearing existing secrets when the key is omitted', () => {
    const updated = mergeResourceConfigurationUpdate(
      {
        ...DEFAULT_STORED_RESOURCE_CONFIGURATION,
        embedding: {
          ...DEFAULT_STORED_RESOURCE_CONFIGURATION.embedding,
          apiKey: 'existing-embedding-key',
        },
      },
      {
        embedding: {
          providerName: ' Local embeddings ',
          baseUrl: ' https://embeddings.example.com/v1 ',
          model: ' text-embedding-test ',
          updatedBy: ' mirrorbrain-web ',
        },
        search: {
          baseUrl: ' https://api.tavily.com ',
          maxResults: 8.9,
          updatedBy: 'mirrorbrain-web',
        },
      },
      '2026-05-14T10:00:00.000Z',
    );

    expect(updated.embedding).toEqual({
      providerName: 'Local embeddings',
      baseUrl: 'https://embeddings.example.com/v1',
      model: 'text-embedding-test',
      apiKey: 'existing-embedding-key',
      updatedAt: '2026-05-14T10:00:00.000Z',
      updatedBy: 'mirrorbrain-web',
    });
    expect(updated.search).toMatchObject({
      baseUrl: 'https://api.tavily.com',
      maxResults: 8,
    });
  });
});
