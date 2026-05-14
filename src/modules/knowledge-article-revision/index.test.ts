import { describe, expect, it, vi } from 'vitest';

import {
  buildKnowledgeArticleRevisionPrompt,
  reviseKnowledgeArticleContent,
} from './index.js';
import type { KnowledgeArticle } from '../knowledge-article/index.js';

const article: KnowledgeArticle = {
  id: 'knowledge-article:source-ledger:v1',
  articleId: 'article:source-ledger',
  projectId: 'project:mirrorbrain',
  topicId: 'topic:source-ledger',
  title: 'Source ledger architecture',
  summary: 'How source ledgers feed memory.',
  body: '# Source ledger architecture\n\nSource ledgers are the acquisition boundary.',
  version: 1,
  isCurrentBest: true,
  supersedesArticleId: null,
  sourceReviewedWorkSessionIds: ['reviewed-work-session:source-ledger'],
  sourceMemoryEventIds: ['browser-1'],
  provenanceRefs: [
    { kind: 'reviewed-work-session', id: 'reviewed-work-session:source-ledger' },
  ],
  publishState: 'published',
  publishedAt: '2026-05-12T12:20:00.000Z',
  publishedBy: 'mirrorbrain-web',
};

describe('knowledge-article-revision', () => {
  it('builds a prompt that asks for a complete JSON revision', () => {
    const prompt = buildKnowledgeArticleRevisionPrompt({
      article,
      instruction: 'Make the risks clearer.',
    });

    expect(prompt).toContain('Return only valid JSON');
    expect(prompt).toContain('Make the risks clearer.');
    expect(prompt).toContain('Source ledger architecture');
    expect(prompt).toContain('complete Markdown article');
  });

  it('parses fenced LLM JSON into revised article content', async () => {
    const analyzeWithLLM = vi.fn(async () =>
      [
        '```json',
        JSON.stringify({
          title: 'Source ledger architecture risks',
          summary: 'Clarifies the operational risks in source ledger handling.',
          body: '# Source ledger architecture risks\n\nThe revision explains risks.',
        }),
        '```',
      ].join('\n'),
    );

    await expect(
      reviseKnowledgeArticleContent({
        article,
        instruction: 'Make the risks clearer.',
        analyzeWithLLM,
      }),
    ).resolves.toEqual({
      title: 'Source ledger architecture risks',
      summary: 'Clarifies the operational risks in source ledger handling.',
      body: '# Source ledger architecture risks\n\nThe revision explains risks.',
    });
    expect(analyzeWithLLM).toHaveBeenCalledWith(expect.stringContaining('Make the risks clearer.'));
  });

  it('rejects empty revision instructions before calling the LLM', async () => {
    const analyzeWithLLM = vi.fn();

    await expect(
      reviseKnowledgeArticleContent({
        article,
        instruction: '   ',
        analyzeWithLLM,
      }),
    ).rejects.toThrow('non-empty instruction');
    expect(analyzeWithLLM).not.toHaveBeenCalled();
  });
});
