import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  KnowledgeArticle,
  KnowledgeArticleDraft,
  Topic,
} from '../../modules/knowledge-article/index.js';
import type { Project } from '../../modules/project-work-session/index.js';
import { createFileKnowledgeArticleStore } from './index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('file knowledge article store', () => {
  it('persists drafts, topics, current-best articles, and article history', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-article-store-'));
    tempDirs.push(workspaceDir);
    const store = createFileKnowledgeArticleStore({ workspaceDir });
    const project: Project = {
      id: 'project:mirrorbrain',
      name: 'MirrorBrain',
      status: 'active',
      createdAt: '2026-05-12T12:00:00.000Z',
      updatedAt: '2026-05-12T12:00:00.000Z',
    };
    const topic: Topic = {
      id: 'topic:project-mirrorbrain:source-ledger',
      projectId: 'project:mirrorbrain',
      name: 'Source ledger',
      status: 'active',
      createdAt: '2026-05-12T12:00:00.000Z',
      updatedAt: '2026-05-12T12:00:00.000Z',
    };
    const draft: KnowledgeArticleDraft = {
      id: 'knowledge-article-draft:source-ledger',
      draftState: 'draft',
      projectId: 'project:mirrorbrain',
      title: 'Source ledger architecture',
      summary: 'Draft source ledger article.',
      body: 'Draft body.',
      topicProposal: {
        kind: 'existing-topic',
        topicId: topic.id,
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
      sourceReviewedWorkSessionIds: ['reviewed-work-session:1'],
      sourceMemoryEventIds: ['memory-1'],
      provenanceRefs: [{ kind: 'memory-event', id: 'memory-1' }],
      generatedAt: '2026-05-12T12:00:00.000Z',
    };
    const versionOne: KnowledgeArticle = {
      id: 'knowledge-article:article-project-mirrorbrain-topic-source-ledger-source-ledger-architecture:v1',
      articleId:
        'article:project-mirrorbrain:topic-source-ledger:source-ledger-architecture',
      projectId: 'project:mirrorbrain',
      topicId: topic.id,
      title: 'Source ledger architecture',
      summary: 'Version one.',
      body: 'Version one body.',
      version: 1,
      isCurrentBest: false,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: ['reviewed-work-session:1'],
      sourceMemoryEventIds: ['memory-1'],
      provenanceRefs: [],
      publishState: 'published',
      publishedAt: '2026-05-12T12:00:00.000Z',
      publishedBy: 'user',
    };
    const versionTwo: KnowledgeArticle = {
      ...versionOne,
      id: 'knowledge-article:article-project-mirrorbrain-topic-source-ledger-source-ledger-architecture:v2',
      summary: 'Version two.',
      version: 2,
      isCurrentBest: true,
      supersedesArticleId: versionOne.id,
      publishedAt: '2026-05-12T13:00:00.000Z',
    };
    const siblingArticle: KnowledgeArticle = {
      ...versionOne,
      id: 'knowledge-article:article-project-mirrorbrain-topic-source-ledger-recorder-supervision:v1',
      articleId:
        'article:project-mirrorbrain:topic-source-ledger:recorder-supervision',
      title: 'Recorder supervision',
      summary: 'Sibling article.',
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      publishedAt: '2026-05-12T13:30:00.000Z',
    };

    await store.saveProject(project);
    await store.saveTopic(topic);
    await store.saveDraft(draft);
    await store.saveArticles([versionOne, versionTwo, siblingArticle]);

    await expect(store.listDrafts()).resolves.toEqual([draft]);
    await expect(store.listTopics('project:mirrorbrain')).resolves.toEqual([topic]);
    await expect(
      store.getCurrentBestArticle({
        projectId: 'project:mirrorbrain',
        topicId: topic.id,
        articleId: versionTwo.articleId,
      }),
    ).resolves.toEqual(versionTwo);
    await expect(
      store.listArticleHistory({
        projectId: 'project:mirrorbrain',
        topicId: topic.id,
        articleId: versionTwo.articleId,
      }),
    ).resolves.toEqual([versionTwo, versionOne]);
    await expect(
      store.listArticleHistory({
        projectId: 'project:mirrorbrain',
        topicId: topic.id,
      }),
    ).resolves.toEqual([siblingArticle, versionTwo, versionOne]);
    await expect(store.listKnowledgeArticleTree()).resolves.toEqual({
      projects: [
        {
          project,
          topics: [
            {
              topic,
              articles: [
                {
                  articleId: siblingArticle.articleId,
                  title: siblingArticle.title,
                  currentBestArticle: siblingArticle,
                  history: [siblingArticle],
                },
                {
                  articleId: versionTwo.articleId,
                  title: versionTwo.title,
                  currentBestArticle: versionTwo,
                  history: [versionTwo, versionOne],
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
