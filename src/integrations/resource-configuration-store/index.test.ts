import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFileResourceConfigurationStore } from './index.js';

describe('resource configuration store', () => {
  it('returns defaults when no resource configuration has been saved', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-resources-'));
    const store = createFileResourceConfigurationStore({
      envPath: join(workspaceDir, '.env'),
    });

    await expect(store.readResourceConfiguration()).resolves.toMatchObject({
      llm: {
        baseUrl: '',
      },
      embedding: {
        baseUrl: '',
      },
      search: {
        providerName: 'tavily',
        baseUrl: '',
        maxResults: 0,
      },
    });
  });

  it('persists provider resource configuration to .env while preserving unrelated entries', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-resources-'));
    const envPath = join(workspaceDir, '.env');
    await writeFile(
      envPath,
      [
        'MIRRORBRAIN_WORKSPACE_DIR=/tmp/mirrorbrain-workspace',
        'MIRRORBRAIN_LLM_API_BASE=http://old.example/v1',
      ].join('\n'),
    );
    const store = createFileResourceConfigurationStore({ envPath });

    await store.writeResourceConfiguration({
      llm: {
        providerName: 'OpenAI-compatible chat',
        baseUrl: 'https://llm.example.com/v1',
        model: 'gpt-example',
        apiKey: 'llm-key',
      },
      embedding: {
        providerName: 'OpenAI-compatible embeddings',
        baseUrl: 'https://embedding.example.com/v1',
        model: 'text-embedding-example',
        apiKey: 'embedding-key',
      },
      search: {
        providerName: 'tavily',
        baseUrl: 'https://api.tavily.com',
        maxResults: 7,
        apiKey: 'tavily-key',
      },
    });
    const envContent = await readFile(envPath, 'utf8');

    await expect(store.readResourceConfiguration()).resolves.toMatchObject({
      llm: {
        apiKey: 'llm-key',
      },
      embedding: {
        model: 'text-embedding-example',
      },
      search: {
        maxResults: 7,
      },
    });
    expect(envContent).toContain('MIRRORBRAIN_WORKSPACE_DIR=/tmp/mirrorbrain-workspace');
    expect(envContent).toContain('MIRRORBRAIN_LLM_API_BASE=https://llm.example.com/v1');
    expect(envContent).toContain('MIRRORBRAIN_EMBEDDING_MODEL=text-embedding-example');
    expect(envContent).toContain('MIRRORBRAIN_TAVILY_MAX_RESULTS=7');
  });
});
