import { describe, expect, it, vi } from 'vitest';

import { createMirrorBrainBrowserApi, createMirrorBrainWebApp, renderMirrorBrainWebApp } from './main.js';

describe('mirrorbrain web topic knowledge UI', () => {
  it('loads topic knowledge summaries from the HTTP API', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/knowledge/topics')) {
        return new Response(JSON.stringify({
          items: [
            {
              topicKey: 'vitest-config',
              title: 'Vitest Config',
              summary: 'Current best summary.',
              currentBestKnowledgeId: 'topic-knowledge:vitest-config:v2',
              updatedAt: '2026-04-03T09:00:00.000Z',
              recencyLabel: 'updated on 2026-04-03',
            },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', fetchMock);
    try {
      const api = createMirrorBrainBrowserApi('http://127.0.0.1:3007');
      await expect(api.listKnowledgeTopics()).resolves.toEqual([
        {
          topicKey: 'vitest-config',
          title: 'Vitest Config',
          summary: 'Current best summary.',
          currentBestKnowledgeId: 'topic-knowledge:vitest-config:v2',
          updatedAt: '2026-04-03T09:00:00.000Z',
          recencyLabel: 'updated on 2026-04-03',
        },
      ]);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  });

  it('renders topic knowledge summaries in the artifacts area', () => {
    const app = createMirrorBrainWebApp({
      api: {
        getHealth: vi.fn(),
        listMemory: vi.fn(),
        listKnowledge: vi.fn(),
        listKnowledgeTopics: vi.fn(),
        listSkills: vi.fn(),
        syncBrowser: vi.fn(),
        syncShell: vi.fn(),
        createDailyCandidates: vi.fn(),
        suggestCandidateReviews: vi.fn(),
        reviewCandidateMemory: vi.fn(),
        generateKnowledge: vi.fn(),
        generateSkill: vi.fn(),
      },
    });

    app.state.activeTab = 'artifacts';
    app.state.knowledgeTopics = [
      {
        topicKey: 'vitest-config',
        title: 'Vitest Config',
        summary: 'Current best summary.',
        currentBestKnowledgeId: 'topic-knowledge:vitest-config:v2',
        updatedAt: '2026-04-03T09:00:00.000Z',
        recencyLabel: 'updated on 2026-04-03',
      },
    ];

    const html = renderMirrorBrainWebApp(app.state);

    expect(html).toContain('Topic Knowledge');
    expect(html).toContain('Vitest Config');
    expect(html).toContain('Current best summary.');
    expect(html).toContain('updated on 2026-04-03');
  });
});
