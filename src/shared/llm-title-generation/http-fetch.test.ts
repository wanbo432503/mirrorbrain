import { afterEach, describe, expect, it, vi } from 'vitest';

describe('llm http config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('loads the MirrorBrain LLM model configuration from environment variables before ov.conf', async () => {
    vi.stubEnv('MIRRORBRAIN_LLM_API_BASE', 'https://llm.example.com/v1');
    vi.stubEnv('MIRRORBRAIN_LLM_API_KEY', 'test-llm-key');
    vi.stubEnv('MIRRORBRAIN_LLM_MODEL', 'gpt-test-knowledge');

    const { loadLLMConfig } = await import('./http-fetch.js');

    await expect(loadLLMConfig()).resolves.toEqual({
      apiBase: 'https://llm.example.com/v1',
      apiKey: 'test-llm-key',
      model: 'gpt-test-knowledge',
    });
  });
});
