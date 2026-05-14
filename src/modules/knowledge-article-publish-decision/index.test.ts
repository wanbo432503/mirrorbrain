import { describe, expect, it, vi } from 'vitest';

import { decideKnowledgeArticlePublishOperation } from './index.js';
import type { KnowledgeArticle, KnowledgeArticleDraft, Topic } from '../knowledge-article/index.js';

const draft: KnowledgeArticleDraft = {
  id: 'knowledge-article-draft:source-ledger',
  draftState: 'draft',
  projectId: 'project:mirrorbrain',
  title: 'Source ledger import architecture',
  summary: 'How source ledgers feed memory events.',
  body: '# Source ledger import architecture\n\nNew details about import checkpoints.',
  topicProposal: {
    kind: 'new-topic',
    name: 'Source ledger',
  },
  articleOperationProposal: {
    kind: 'create-new-article',
  },
  sourceReviewedWorkSessionIds: ['reviewed-work-session:new'],
  sourceMemoryEventIds: ['browser-new'],
  provenanceRefs: [{ kind: 'reviewed-work-session', id: 'reviewed-work-session:new' }],
  generatedAt: '2026-05-12T12:10:00.000Z',
};

const topic: Topic = {
  id: 'topic:project-mirrorbrain:source-ledger',
  projectId: 'project:mirrorbrain',
  name: 'Source ledger',
  status: 'active',
  createdAt: '2026-05-12T12:00:00.000Z',
  updatedAt: '2026-05-12T12:00:00.000Z',
};

const article: KnowledgeArticle = {
  id: 'knowledge-article:source-ledger:v1',
  articleId: 'article:project-mirrorbrain:topic-project-mirrorbrain-source-ledger:source-ledger-import-architecture',
  projectId: 'project:mirrorbrain',
  topicId: topic.id,
  title: 'Source ledger import architecture',
  summary: 'Prior source ledger import notes.',
  body: 'Prior body.',
  version: 1,
  isCurrentBest: true,
  supersedesArticleId: null,
  sourceReviewedWorkSessionIds: ['reviewed-work-session:old'],
  sourceMemoryEventIds: ['browser-old'],
  provenanceRefs: [{ kind: 'memory-event', id: 'browser-old' }],
  publishState: 'published',
  publishedAt: '2026-05-11T12:20:00.000Z',
  publishedBy: 'user',
};

describe('knowledge article publish decision', () => {
  it('uses LLM JSON to select an existing topic and article update', async () => {
    const analyzeWithLLM = vi.fn(async () =>
      `json ${JSON.stringify({
        topic: { kind: 'existing-topic', topicId: topic.id },
        articleOperation: {
          kind: 'update-existing-article',
          articleId: article.articleId,
        },
        rationale: 'The draft extends the same source-ledger article.',
      })}`,
    );

    await expect(
      decideKnowledgeArticlePublishOperation({
        draft,
        topics: [topic],
        articles: [article],
        analyzeWithLLM,
      }),
    ).resolves.toEqual({
      topicProposal: { kind: 'existing-topic', topicId: topic.id },
      topicAssignment: { kind: 'existing-topic', topicId: topic.id },
      articleOperationProposal: {
        kind: 'update-existing-article',
        articleId: article.articleId,
      },
      rationale: 'The draft extends the same source-ledger article.',
    });
  });

  it('falls back to deterministic matching when the LLM response is unusable', async () => {
    await expect(
      decideKnowledgeArticlePublishOperation({
        draft,
        topics: [topic],
        articles: [article],
        analyzeWithLLM: vi.fn(async () => 'not json'),
      }),
    ).resolves.toMatchObject({
      topicProposal: { kind: 'existing-topic', topicId: topic.id },
      topicAssignment: { kind: 'existing-topic', topicId: topic.id },
      articleOperationProposal: {
        kind: 'update-existing-article',
        articleId: article.articleId,
      },
    });
  });
});
