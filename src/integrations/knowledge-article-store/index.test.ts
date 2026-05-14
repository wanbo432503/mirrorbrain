import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
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
    await expect(
      access(
        join(
          workspaceDir,
          'mirrorbrain',
          'knowledge',
          'project',
          'preview_mirrorbrain',
          'source-ledger',
          'preview_knowledge-article-draft-source-ledger.json',
        ),
      ),
    ).resolves.toBeUndefined();
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
    await expect(
      readdir(join(workspaceDir, 'mirrorbrain', 'knowledge', 'project')),
    ).resolves.toEqual(['mirrorbrain']);
    await expect(
      readdir(
        join(
          workspaceDir,
          'mirrorbrain',
          'knowledge',
          'project',
          'mirrorbrain',
          'source-ledger',
        ),
      ),
    ).resolves.toEqual([
      '_topic.json',
      'knowledge-article-article-project-mirrorbrain-topic-source-ledger-recorder-supervision-v1.json',
      'knowledge-article-article-project-mirrorbrain-topic-source-ledger-source-ledger-architecture-v1.json',
      'knowledge-article-article-project-mirrorbrain-topic-source-ledger-source-ledger-architecture-v2.json',
      'preview_knowledge-article-draft-source-ledger.json',
    ]);
    await expect(
      access(join(workspaceDir, 'mirrorbrain', 'projects')),
    ).rejects.toThrow();
    await expect(
      access(join(workspaceDir, 'mirrorbrain', 'topics')),
    ).rejects.toThrow();
    await expect(
      access(join(workspaceDir, 'mirrorbrain', 'knowledge-article-drafts')),
    ).rejects.toThrow();
    await expect(
      access(join(workspaceDir, 'mirrorbrain', 'knowledge-articles')),
    ).rejects.toThrow();
  });

  it('deletes one published article lineage without removing sibling articles', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-article-delete-'));
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
    const versionOne: KnowledgeArticle = {
      id: 'knowledge-article:source-ledger:v1',
      articleId: 'article:project-mirrorbrain:topic-source-ledger:source-ledger',
      projectId: project.id,
      topicId: topic.id,
      title: 'Source ledger',
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
      id: 'knowledge-article:source-ledger:v2',
      version: 2,
      isCurrentBest: true,
      supersedesArticleId: versionOne.id,
      publishedAt: '2026-05-12T13:00:00.000Z',
    };
    const siblingArticle: KnowledgeArticle = {
      ...versionOne,
      id: 'knowledge-article:recorder:v1',
      articleId: 'article:project-mirrorbrain:topic-source-ledger:recorder',
      title: 'Recorder supervision',
      isCurrentBest: true,
    };

    await store.saveProject(project);
    await store.saveTopic(topic);
    await store.saveArticles([versionOne, versionTwo, siblingArticle]);

    await store.deleteArticleLineage(versionOne.articleId);

    await expect(
      access(
        join(
          workspaceDir,
          'mirrorbrain',
          'knowledge',
          'project',
          'mirrorbrain',
          'source-ledger',
          'knowledge-article-source-ledger-v1.json',
        ),
      ),
    ).rejects.toThrow();
    await expect(
      store.listArticleHistory({
        projectId: project.id,
        topicId: topic.id,
        articleId: versionOne.articleId,
      }),
    ).resolves.toEqual([]);
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
              ],
            },
          ],
        },
      ],
    });
  });

  it('removes preview knowledge files after a draft is published', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-article-preview-'));
    tempDirs.push(workspaceDir);
    const store = createFileKnowledgeArticleStore({ workspaceDir });
    const project: Project = {
      id: 'project:mirrorbrain',
      name: 'MirrorBrain',
      status: 'active',
      createdAt: '2026-05-12T12:00:00.000Z',
      updatedAt: '2026-05-12T12:00:00.000Z',
    };
    const draft: KnowledgeArticleDraft = {
      id: 'knowledge-article-draft:source-ledger',
      draftState: 'draft',
      projectId: project.id,
      title: 'Source ledger architecture',
      summary: 'Draft source ledger article.',
      body: 'Draft body.',
      topicProposal: {
        kind: 'new-topic',
        name: 'Source ledger',
      },
      articleOperationProposal: {
        kind: 'create-new-article',
      },
      sourceReviewedWorkSessionIds: ['reviewed-work-session:1'],
      sourceMemoryEventIds: ['memory-1'],
      provenanceRefs: [{ kind: 'memory-event', id: 'memory-1' }],
      generatedAt: '2026-05-12T12:00:00.000Z',
    };

    await store.saveProject(project);
    await store.saveDraft(draft);
    await store.deleteDraft(draft.id);

    await expect(store.listDrafts()).resolves.toEqual([]);
    await expect(
      access(
        join(
          workspaceDir,
          'mirrorbrain',
          'knowledge',
          'project',
          'preview_mirrorbrain',
          'source-ledger',
          'preview_knowledge-article-draft-source-ledger.json',
        ),
      ),
    ).rejects.toThrow();
  });

  it('uses non-ASCII project and topic names in the knowledge tree directories', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-article-i18n-'));
    tempDirs.push(workspaceDir);
    const store = createFileKnowledgeArticleStore({ workspaceDir });
    const project: Project = {
      id: 'project:聚类算法',
      name: '聚类算法',
      status: 'active',
      createdAt: '2026-05-12T12:00:00.000Z',
      updatedAt: '2026-05-12T12:00:00.000Z',
    };
    const topic: Topic = {
      id: 'topic:project-聚类算法:聚类算法',
      projectId: project.id,
      name: '聚类算法',
      status: 'active',
      createdAt: '2026-05-12T12:00:00.000Z',
      updatedAt: '2026-05-12T12:00:00.000Z',
    };
    const article: KnowledgeArticle = {
      id: 'knowledge-article:article-project-聚类算法-topic-project-聚类算法-聚类算法-聚类算法方法与应用:v1',
      articleId:
        'article:project-聚类算法:topic-project-聚类算法-聚类算法:聚类算法方法与应用',
      projectId: project.id,
      topicId: topic.id,
      title: '聚类算法方法与应用',
      summary: '聚类算法知识。',
      body: '聚类算法用于发现数据中的自然分组。',
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: ['reviewed-work-session:1'],
      sourceMemoryEventIds: ['memory-1'],
      provenanceRefs: [],
      publishState: 'published',
      publishedAt: '2026-05-12T12:00:00.000Z',
      publishedBy: 'user',
    };

    await store.saveProject(project);
    await store.saveTopic(topic);
    await store.saveArticles([article]);

    await expect(
      readdir(join(workspaceDir, 'mirrorbrain', 'knowledge', 'project')),
    ).resolves.toEqual(['聚类算法']);
    await expect(
      readdir(
        join(
          workspaceDir,
          'mirrorbrain',
          'knowledge',
          'project',
          '聚类算法',
        ),
      ),
    ).resolves.toContain('聚类算法');
  });
});
