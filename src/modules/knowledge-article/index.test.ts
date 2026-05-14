import { describe, expect, it } from 'vitest';
import type { ReviewedWorkSession } from '../project-work-session/index.js';
import {
  createKnowledgeArticleDraft,
  createKnowledgeArticleRevisionDraft,
  type KnowledgeArticle,
  publishKnowledgeArticleDraft,
} from './index.js';

const reviewedWorkSession: ReviewedWorkSession = {
  id: 'reviewed-work-session:source-ledger',
  candidateId: 'work-session-candidate:mirrorbrain',
  projectId: 'project:mirrorbrain',
  title: 'Source ledger integration',
  summary: 'Built source ledger import and source management review paths.',
  memoryEventIds: ['browser-1', 'shell-1'],
  sourceTypes: ['browser', 'shell'],
  timeRange: {
    startAt: '2026-05-12T10:00:00.000Z',
    endAt: '2026-05-12T11:00:00.000Z',
  },
  relationHints: ['Phase 4 design', 'Run source tests'],
  reviewState: 'reviewed',
  reviewedAt: '2026-05-12T12:05:00.000Z',
  reviewedBy: 'user',
};

describe('knowledge article model', () => {
  it('creates a Knowledge Article Draft from reviewed work-session provenance', () => {
    const draft = createKnowledgeArticleDraft({
      reviewedWorkSessions: [reviewedWorkSession],
      generatedAt: '2026-05-12T12:10:00.000Z',
      title: 'Source ledger import architecture',
      summary: 'How MirrorBrain imports source ledgers into memory events.',
      body: 'MirrorBrain uses source ledgers as the acquisition boundary before memory import.',
      topicProposal: {
        kind: 'new-topic',
        name: 'Source ledger architecture',
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
    });

    expect(draft).toMatchObject({
      id: 'knowledge-article-draft:reviewed-work-session-source-ledger',
      draftState: 'draft',
      projectId: 'project:mirrorbrain',
      title: 'Source ledger import architecture',
      sourceReviewedWorkSessionIds: ['reviewed-work-session:source-ledger'],
      sourceMemoryEventIds: ['browser-1', 'shell-1'],
      topicProposal: {
        kind: 'new-topic',
        name: 'Source ledger architecture',
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
      provenanceRefs: [
        {
          kind: 'reviewed-work-session',
          id: 'reviewed-work-session:source-ledger',
        },
        { kind: 'memory-event', id: 'browser-1' },
        { kind: 'memory-event', id: 'shell-1' },
      ],
    });
  });

  it('refuses to generate a Knowledge Article Draft from discarded work sessions', () => {
    expect(() =>
      createKnowledgeArticleDraft({
        reviewedWorkSessions: [
          {
            ...reviewedWorkSession,
            reviewState: 'discarded',
          },
        ],
        generatedAt: '2026-05-12T12:10:00.000Z',
        title: 'Invalid draft',
        summary: 'Discarded sessions should not become drafts.',
        body: 'Discarded sessions are not approved review inputs.',
        topicProposal: {
          kind: 'new-topic',
          name: 'Invalid',
        },
        articleOperationProposal: {
          kind: 'create-new-article',
        },
      }),
    ).toThrow('Knowledge Article Drafts require reviewed work sessions.');
  });

  it('publishes a draft as the current-best first version under a confirmed topic', () => {
    const draft = createKnowledgeArticleDraft({
      reviewedWorkSessions: [reviewedWorkSession],
      generatedAt: '2026-05-12T12:10:00.000Z',
      title: 'Source ledger import architecture',
      summary: 'How MirrorBrain imports source ledgers into memory events.',
      body: 'MirrorBrain uses source ledgers as the acquisition boundary before memory import.',
      topicProposal: {
        kind: 'new-topic',
        name: 'Source ledger architecture',
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
    });

    const result = publishKnowledgeArticleDraft({
      draft,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'user',
      topicAssignment: {
        kind: 'confirmed-new-topic',
        name: 'Source ledger architecture',
      },
      existingArticles: [],
    });

    expect(result.topic).toEqual({
      id: 'topic:project-mirrorbrain:source-ledger-architecture',
      projectId: 'project:mirrorbrain',
      name: 'Source ledger architecture',
      status: 'active',
      createdAt: '2026-05-12T12:20:00.000Z',
      updatedAt: '2026-05-12T12:20:00.000Z',
    });
    expect(result.article).toMatchObject({
      articleId:
        'article:project-mirrorbrain:topic-project-mirrorbrain-source-ledger-architecture:source-ledger-import-architecture',
      id: 'knowledge-article:article-project-mirrorbrain-topic-project-mirrorbrain-source-ledger-architecture-source-ledger-import-architecture:v1',
      projectId: 'project:mirrorbrain',
      topicId: 'topic:project-mirrorbrain:source-ledger-architecture',
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      publishState: 'published',
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'user',
    });
  });

  it('preserves non-ASCII project, topic, and article names in durable ids', () => {
    const draft = createKnowledgeArticleDraft({
      reviewedWorkSessions: [
        {
          ...reviewedWorkSession,
          projectId: 'project:聚类算法',
        },
      ],
      generatedAt: '2026-05-12T12:10:00.000Z',
      title: '聚类算法方法与应用',
      summary: '聚类算法知识。',
      body: '聚类算法用于发现数据中的自然分组。',
      topicProposal: {
        kind: 'new-topic',
        name: '聚类算法',
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
    });

    const result = publishKnowledgeArticleDraft({
      draft,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'user',
      topicAssignment: {
        kind: 'confirmed-new-topic',
        name: '聚类算法',
      },
      existingArticles: [],
    });

    expect(result.topic?.id).toBe('topic:project-聚类算法:聚类算法');
    expect(result.article.articleId).toBe(
      'article:project-聚类算法:topic-project-聚类算法-聚类算法:聚类算法方法与应用',
    );
    expect(result.article.id).toBe(
      'knowledge-article:article-project-聚类算法-topic-project-聚类算法-聚类算法-聚类算法方法与应用:v1',
    );
  });

  it('keeps separate article identities and version streams within the same topic', () => {
    const importDraft = createKnowledgeArticleDraft({
      reviewedWorkSessions: [reviewedWorkSession],
      generatedAt: '2026-05-12T12:10:00.000Z',
      title: 'Source ledger import architecture',
      summary: 'How MirrorBrain imports source ledgers into memory events.',
      body: 'Import body.',
      topicProposal: {
        kind: 'existing-topic',
        topicId: 'topic:source-ledger',
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
    });
    const recorderDraft = createKnowledgeArticleDraft({
      reviewedWorkSessions: [reviewedWorkSession],
      generatedAt: '2026-05-12T12:15:00.000Z',
      title: 'Source recorder supervision',
      summary: 'How MirrorBrain supervises built-in recorders.',
      body: 'Recorder body.',
      topicProposal: {
        kind: 'existing-topic',
        topicId: 'topic:source-ledger',
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
    });

    const importResult = publishKnowledgeArticleDraft({
      draft: importDraft,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'user',
      topicAssignment: {
        kind: 'existing-topic',
        topicId: 'topic:source-ledger',
      },
      existingArticles: [],
    });
    const recorderResult = publishKnowledgeArticleDraft({
      draft: recorderDraft,
      publishedAt: '2026-05-12T12:30:00.000Z',
      publishedBy: 'user',
      topicAssignment: {
        kind: 'existing-topic',
        topicId: 'topic:source-ledger',
      },
      existingArticles: [importResult.article],
    });

    expect(importResult.article.articleId).toBe(
      'article:project-mirrorbrain:topic-source-ledger:source-ledger-import-architecture',
    );
    expect(recorderResult.article.articleId).toBe(
      'article:project-mirrorbrain:topic-source-ledger:source-recorder-supervision',
    );
    expect(importResult.article).toMatchObject({
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
    });
    expect(recorderResult.article).toMatchObject({
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
    });
    expect(recorderResult.supersededArticle).toBeUndefined();
  });

  it('publishes an update as a new current-best version and marks the prior version superseded', () => {
    const priorArticle: KnowledgeArticle = {
      id: 'knowledge-article:article-project-mirrorbrain-topic-source-ledger-source-ledger-import-architecture:v1',
      articleId:
        'article:project-mirrorbrain:topic-source-ledger:source-ledger-import-architecture',
      projectId: 'project:mirrorbrain',
      topicId: 'topic:source-ledger',
      title: 'Source ledger import architecture',
      summary: 'Prior source ledger notes.',
      body: 'Prior body.',
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: ['reviewed-work-session:old'],
      sourceMemoryEventIds: ['old-memory'],
      provenanceRefs: [],
      publishState: 'published',
      publishedAt: '2026-05-11T12:20:00.000Z',
      publishedBy: 'user',
    };
    const draft = createKnowledgeArticleDraft({
      reviewedWorkSessions: [reviewedWorkSession],
      generatedAt: '2026-05-12T12:10:00.000Z',
      title: 'Source ledger import architecture',
      summary: 'Updated source ledger notes.',
      body: 'Updated body.',
      topicProposal: {
        kind: 'existing-topic',
        topicId: 'topic:source-ledger',
      },
      articleOperationProposal: {
        kind: 'update-existing-article',
        articleId: priorArticle.articleId,
      },
    });

    const result = publishKnowledgeArticleDraft({
      draft,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'user',
      topicAssignment: {
        kind: 'existing-topic',
        topicId: 'topic:source-ledger',
      },
      existingArticles: [priorArticle],
    });

    expect(result.article).toMatchObject({
      id: 'knowledge-article:article-project-mirrorbrain-topic-source-ledger-source-ledger-import-architecture:v2',
      articleId: priorArticle.articleId,
      version: 2,
      isCurrentBest: true,
      supersedesArticleId: priorArticle.id,
    });
    expect(result.supersededArticle).toMatchObject({
      id: priorArticle.id,
      isCurrentBest: false,
    });
  });

  it('attaches supporting evidence as a new version without replacing current-best content', () => {
    const priorArticle: KnowledgeArticle = {
      id: 'knowledge-article:article-project-mirrorbrain-topic-source-ledger-source-ledger-import-architecture:v1',
      articleId:
        'article:project-mirrorbrain:topic-source-ledger:source-ledger-import-architecture',
      projectId: 'project:mirrorbrain',
      topicId: 'topic:source-ledger',
      title: 'Source ledger import architecture',
      summary: 'Prior source ledger notes.',
      body: 'Prior body.',
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: ['reviewed-work-session:old'],
      sourceMemoryEventIds: ['old-memory'],
      provenanceRefs: [{ kind: 'memory-event', id: 'old-memory' }],
      publishState: 'published',
      publishedAt: '2026-05-11T12:20:00.000Z',
      publishedBy: 'user',
    };
    const draft = createKnowledgeArticleDraft({
      reviewedWorkSessions: [reviewedWorkSession],
      generatedAt: '2026-05-12T12:10:00.000Z',
      title: 'Source ledger side note',
      summary: 'Supporting source ledger evidence.',
      body: 'This body should not replace the durable article.',
      topicProposal: {
        kind: 'existing-topic',
        topicId: 'topic:source-ledger',
      },
      articleOperationProposal: {
        kind: 'attach-as-supporting-evidence',
        articleId: priorArticle.articleId,
      },
    });

    const result = publishKnowledgeArticleDraft({
      draft,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'user',
      topicAssignment: {
        kind: 'existing-topic',
        topicId: 'topic:source-ledger',
      },
      existingArticles: [priorArticle],
    });

    expect(result.article).toMatchObject({
      articleId: priorArticle.articleId,
      title: priorArticle.title,
      summary: priorArticle.summary,
      body: priorArticle.body,
      version: 2,
      supersedesArticleId: priorArticle.id,
      sourceReviewedWorkSessionIds: [
        'reviewed-work-session:old',
        'reviewed-work-session:source-ledger',
      ],
      sourceMemoryEventIds: ['old-memory', 'browser-1', 'shell-1'],
      provenanceRefs: [
        { kind: 'memory-event', id: 'old-memory' },
        { kind: 'reviewed-work-session', id: 'reviewed-work-session:source-ledger' },
        { kind: 'memory-event', id: 'browser-1' },
        { kind: 'memory-event', id: 'shell-1' },
      ],
    });
  });

  it('creates a revision draft from an existing published article lineage', () => {
    const priorArticle: KnowledgeArticle = {
      id: 'knowledge-article:article-project-mirrorbrain-topic-source-ledger-source-ledger-import-architecture:v1',
      articleId:
        'article:project-mirrorbrain:topic-source-ledger:source-ledger-import-architecture',
      projectId: 'project:mirrorbrain',
      topicId: 'topic:source-ledger',
      title: 'Source ledger import architecture',
      summary: 'Prior source ledger notes.',
      body: 'Prior body.',
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: ['reviewed-work-session:old'],
      sourceMemoryEventIds: ['old-memory'],
      provenanceRefs: [{ kind: 'memory-event', id: 'old-memory' }],
      publishState: 'published',
      publishedAt: '2026-05-11T12:20:00.000Z',
      publishedBy: 'user',
    };

    const draft = createKnowledgeArticleRevisionDraft({
      article: priorArticle,
      generatedAt: '2026-05-12T12:10:00.000Z',
      title: 'Source ledger import architecture revised',
      summary: 'Updated notes with clearer risks.',
      body: 'Revised body.',
    });

    expect(draft).toMatchObject({
      draftState: 'draft',
      projectId: priorArticle.projectId,
      title: 'Source ledger import architecture revised',
      topicProposal: {
        kind: 'existing-topic',
        topicId: priorArticle.topicId,
      },
      articleOperationProposal: {
        kind: 'update-existing-article',
        articleId: priorArticle.articleId,
      },
      sourceReviewedWorkSessionIds: priorArticle.sourceReviewedWorkSessionIds,
      sourceMemoryEventIds: priorArticle.sourceMemoryEventIds,
      provenanceRefs: priorArticle.provenanceRefs,
    });
  });
});
