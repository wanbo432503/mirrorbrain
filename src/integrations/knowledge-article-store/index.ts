import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Project } from '../../modules/project-work-session/index.js';
import type {
  KnowledgeArticle as Phase4KnowledgeArticle,
  KnowledgeArticleDraft as Phase4KnowledgeArticleDraft,
  Topic,
} from '../../modules/knowledge-article/index.js';

export interface KnowledgeArticleStore {
  saveProject(project: Project): Promise<void>;
  saveTopic(topic: Topic): Promise<void>;
  saveDraft(draft: Phase4KnowledgeArticleDraft): Promise<void>;
  saveArticles(articles: Phase4KnowledgeArticle[]): Promise<void>;
  listDrafts(): Promise<Phase4KnowledgeArticleDraft[]>;
  listTopics(projectId?: string): Promise<Topic[]>;
  listKnowledgeArticleTree(): Promise<KnowledgeArticleTree>;
  listArticleHistory(filter: {
    projectId: string;
    topicId: string;
    articleId?: string;
  }): Promise<Phase4KnowledgeArticle[]>;
  getCurrentBestArticle(filter: {
    projectId: string;
    topicId: string;
    articleId?: string;
  }): Promise<Phase4KnowledgeArticle | null>;
}

export interface KnowledgeArticleTree {
  projects: KnowledgeArticleProjectNode[];
}

export interface KnowledgeArticleProjectNode {
  project: Project;
  topics: KnowledgeArticleTopicNode[];
}

export interface KnowledgeArticleTopicNode {
  topic: Topic;
  articles: KnowledgeArticleNode[];
}

export interface KnowledgeArticleNode {
  articleId: string;
  title: string;
  currentBestArticle: Phase4KnowledgeArticle | null;
  history: Phase4KnowledgeArticle[];
}

interface CreateFileKnowledgeArticleStoreInput {
  workspaceDir: string;
}

type StoredArtifact =
  | Project
  | Topic
  | Phase4KnowledgeArticleDraft
  | Phase4KnowledgeArticle;

function getBaseDir(workspaceDir: string): string {
  return join(workspaceDir, 'mirrorbrain');
}

function encodeId(id: string): string {
  return encodeURIComponent(id);
}

function getArtifactPath(input: {
  workspaceDir: string;
  directory: string;
  id: string;
}): string {
  return join(
    getBaseDir(input.workspaceDir),
    input.directory,
    `${encodeId(input.id)}.json`,
  );
}

async function saveArtifact(input: {
  workspaceDir: string;
  directory: string;
  artifact: StoredArtifact;
}): Promise<void> {
  const artifactPath = getArtifactPath({
    workspaceDir: input.workspaceDir,
    directory: input.directory,
    id: input.artifact.id,
  });

  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(input.artifact, null, 2)}\n`);
}

async function listArtifacts<TArtifact>(input: {
  workspaceDir: string;
  directory: string;
}): Promise<TArtifact[]> {
  const artifactsDir = join(getBaseDir(input.workspaceDir), input.directory);

  let files: string[];

  try {
    files = await readdir(artifactsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const artifacts = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const text = await readFile(join(artifactsDir, file), 'utf8');

        return JSON.parse(text) as TArtifact;
      }),
  );

  return artifacts;
}

function compareByNameOrTitle(left: string, right: string): number {
  return left.localeCompare(right);
}

function sortArticleHistory(
  articles: Phase4KnowledgeArticle[],
): Phase4KnowledgeArticle[] {
  return [...articles].sort((left, right) => {
    const publishedOrder = right.publishedAt.localeCompare(left.publishedAt);

    return publishedOrder !== 0 ? publishedOrder : right.version - left.version;
  });
}

function compareArticlesByHistoryOrder(
  left: Phase4KnowledgeArticle,
  right: Phase4KnowledgeArticle,
): number {
  const publishedOrder = right.publishedAt.localeCompare(left.publishedAt);

  return publishedOrder !== 0 ? publishedOrder : right.version - left.version;
}

export function createFileKnowledgeArticleStore(
  input: CreateFileKnowledgeArticleStoreInput,
): KnowledgeArticleStore {
  return {
    saveProject: (project) =>
      saveArtifact({
        workspaceDir: input.workspaceDir,
        directory: 'projects',
        artifact: project,
      }),
    saveTopic: (topic) =>
      saveArtifact({
        workspaceDir: input.workspaceDir,
        directory: 'topics',
        artifact: topic,
      }),
    saveDraft: (draft) =>
      saveArtifact({
        workspaceDir: input.workspaceDir,
        directory: 'knowledge-article-drafts',
        artifact: draft,
      }),
    saveArticles: async (articles) => {
      await Promise.all(
        articles.map((article) =>
          saveArtifact({
            workspaceDir: input.workspaceDir,
            directory: 'knowledge-articles',
            artifact: article,
          }),
        ),
      );
    },
    listDrafts: () =>
      listArtifacts<Phase4KnowledgeArticleDraft>({
        workspaceDir: input.workspaceDir,
        directory: 'knowledge-article-drafts',
      }),
    listTopics: async (projectId?: string) => {
      const topics = await listArtifacts<Topic>({
        workspaceDir: input.workspaceDir,
        directory: 'topics',
      });

      return topics
        .filter((topic) => projectId === undefined || topic.projectId === projectId)
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    listKnowledgeArticleTree: async () => {
      const [projects, topics, articles] = await Promise.all([
        listArtifacts<Project>({
          workspaceDir: input.workspaceDir,
          directory: 'projects',
        }),
        listArtifacts<Topic>({
          workspaceDir: input.workspaceDir,
          directory: 'topics',
        }),
        listArtifacts<Phase4KnowledgeArticle>({
          workspaceDir: input.workspaceDir,
          directory: 'knowledge-articles',
        }),
      ]);

      const topicsByProjectId = new Map<string, Topic[]>();
      for (const topic of topics) {
        const projectTopics = topicsByProjectId.get(topic.projectId) ?? [];
        projectTopics.push(topic);
        topicsByProjectId.set(topic.projectId, projectTopics);
      }

      const articlesByTopicId = new Map<string, Map<string, Phase4KnowledgeArticle[]>>();
      for (const article of articles) {
        const topicArticles =
          articlesByTopicId.get(article.topicId) ??
          new Map<string, Phase4KnowledgeArticle[]>();
        const lineage = topicArticles.get(article.articleId) ?? [];
        lineage.push(article);
        topicArticles.set(article.articleId, lineage);
        articlesByTopicId.set(article.topicId, topicArticles);
      }

      return {
        projects: projects
          .sort((left, right) => compareByNameOrTitle(left.name, right.name))
          .map((project) => {
            const topicsWithArticles = (topicsByProjectId.get(project.id) ?? [])
              .sort((left, right) => compareByNameOrTitle(left.name, right.name))
              .map((topic) => {
                const articleLineages = articlesByTopicId.get(topic.id) ?? new Map();
                const articleNodes = Array.from(articleLineages.entries()).map(
                  ([articleId, articleHistory]) => {
                    const history = sortArticleHistory(articleHistory);
                    const currentBestArticle =
                      history.find((article) => article.isCurrentBest) ?? null;

                    return {
                      articleId,
                      title: currentBestArticle?.title ?? history[0]?.title ?? articleId,
                      currentBestArticle,
                      history,
                    };
                  },
                );

                return {
                  topic,
                  articles: articleNodes.sort((left, right) =>
                    compareByNameOrTitle(left.title, right.title),
                  ),
                };
              })
              .filter((topicNode) => topicNode.articles.length > 0);

            return {
              project,
              topics: topicsWithArticles,
            };
          })
          .filter((projectNode) => projectNode.topics.length > 0),
      };
    },
    listArticleHistory: async (filter) => {
      const articles = await listArtifacts<Phase4KnowledgeArticle>({
        workspaceDir: input.workspaceDir,
        directory: 'knowledge-articles',
      });

      return articles
        .filter(
          (article) =>
            article.projectId === filter.projectId &&
            article.topicId === filter.topicId &&
            (filter.articleId === undefined || article.articleId === filter.articleId),
        )
        .sort(compareArticlesByHistoryOrder);
    },
    getCurrentBestArticle: async (filter) => {
      const history = await createFileKnowledgeArticleStore(input).listArticleHistory(
        filter,
      );

      return history.find((article) => article.isCurrentBest) ?? null;
    },
  };
}
