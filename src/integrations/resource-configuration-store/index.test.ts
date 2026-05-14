import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFileResourceConfigurationStore } from './index.js';

describe('resource configuration store', () => {
  it('returns defaults when no resource configuration has been saved', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-resources-'));
    const store = createFileResourceConfigurationStore({ workspaceDir });

    await expect(store.readResourceConfiguration()).resolves.toMatchObject({
      llm: {
        enabled: false,
        baseUrl: 'https://api.openai.com/v1',
      },
      embedding: {
        enabled: false,
        baseUrl: 'https://api.openai.com/v1',
      },
      search: {
        enabled: false,
        providerName: 'tavily',
        baseUrl: 'https://api.tavily.com',
      },
    });
  });

  it('persists provider resource configuration under MirrorBrain workspace state', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-resources-'));
    const store = createFileResourceConfigurationStore({ workspaceDir });

    await store.writeResourceConfiguration({
      llm: {
        enabled: true,
        providerName: 'OpenAI-compatible chat',
        baseUrl: 'https://llm.example.com/v1',
        model: 'gpt-example',
        apiKey: 'llm-key',
      },
      embedding: {
        enabled: true,
        providerName: 'OpenAI-compatible embeddings',
        baseUrl: 'https://embedding.example.com/v1',
        model: 'text-embedding-example',
        apiKey: 'embedding-key',
      },
      search: {
        enabled: true,
        providerName: 'tavily',
        baseUrl: 'https://api.tavily.com',
        maxResults: 7,
        apiKey: 'tavily-key',
      },
    });

    await expect(store.readResourceConfiguration()).resolves.toMatchObject({
      llm: {
        enabled: true,
        apiKey: 'llm-key',
      },
      embedding: {
        model: 'text-embedding-example',
      },
      search: {
        maxResults: 7,
      },
    });
  });
});
