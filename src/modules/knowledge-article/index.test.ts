import { describe, expect, it } from 'vitest';
import type { ReviewedWorkSession } from '../project-work-session/index.js';
import {
  createKnowledgeArticleDraft,
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
      id: 'knowledge-article:project-mirrorbrain:topic-project-mirrorbrain-source-ledger-architecture:v1',
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

  it('publishes an update as a new current-best version and marks the prior version superseded', () => {
    const priorArticle: KnowledgeArticle = {
      id: 'knowledge-article:project-mirrorbrain:topic-source-ledger:v1',
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
        articleId: priorArticle.id,
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
      id: 'knowledge-article:project-mirrorbrain:topic-source-ledger:v2',
      version: 2,
      isCurrentBest: true,
      supersedesArticleId: priorArticle.id,
    });
    expect(result.supersededArticle).toMatchObject({
      id: priorArticle.id,
      isCurrentBest: false,
    });
  });
});
