import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
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
  deleteDraft(draftId: string): Promise<void>;
  saveArticles(articles: Phase4KnowledgeArticle[]): Promise<void>;
  deleteArticleLineage(articleId: string): Promise<void>;
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

function getKnowledgeRootDir(workspaceDir: string): string {
  return join(getBaseDir(workspaceDir), 'knowledge', 'project');
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/gu, '');

  return slug.length > 0 ? slug : 'untitled';
}

function getProjectDirectoryName(project: Pick<Project, 'id' | 'name'>): string {
  return slugify(project.name || project.id);
}

function getFallbackProjectDirectoryName(projectId: string): string {
  return slugify(projectId.replace(/^project:/u, ''));
}

function getTopicDirectoryName(topic: Pick<Topic, 'id' | 'name'>): string {
  return slugify(topic.name || topic.id);
}

function getFallbackTopicDirectoryName(topicId: string): string {
  return slugify(topicId.replace(/^topic:/u, ''));
}

function getKnowledgeFileName(id: string, state: 'preview' | 'published'): string {
  return `${state === 'preview' ? 'preview_' : ''}${slugify(id)}.json`;
}

function getProjectMetadataPath(projectDir: string): string {
  return join(projectDir, '_project.json');
}

function getTopicMetadataPath(topicDir: string): string {
  return join(topicDir, '_topic.json');
}

async function saveArtifact(input: {
  path: string;
  artifact: StoredArtifact;
}): Promise<void> {
  await mkdir(dirname(input.path), { recursive: true });
  await writeFile(input.path, `${JSON.stringify(input.artifact, null, 2)}\n`);
}

async function readJsonFile<TArtifact>(path: string): Promise<TArtifact | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as TArtifact;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function listDirectories(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(directory, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function listJsonFiles(directory: string): Promise<string[]> {
  let files: string[];

  try {
    files = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  return files
    .filter((file) => file.endsWith('.json'))
    .map((file) => join(directory, file))
    .sort();
}

async function copyDirectoryContents(sourceDir: string, targetDir: string): Promise<void> {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  await mkdir(targetDir, { recursive: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(targetDir, entry.name);

      if (entry.isDirectory()) {
        await copyDirectoryContents(sourcePath, targetPath);
        return;
      }

      if (entry.isFile()) {
        await mkdir(dirname(targetPath), { recursive: true });
        await copyFile(sourcePath, targetPath);
      }
    }),
  );
}

async function findProjectDir(input: {
  workspaceDir: string;
  projectId: string;
  preferPublished?: boolean;
}): Promise<{ dir: string; project: Project; isPreview: boolean } | null> {
  const projectDirs = await listDirectories(getKnowledgeRootDir(input.workspaceDir));
  const matches: Array<{ dir: string; project: Project; isPreview: boolean }> = [];

  for (const dir of projectDirs) {
    const project = await readJsonFile<Project>(getProjectMetadataPath(dir));

    if (project?.id === input.projectId) {
      matches.push({
        dir,
        project,
        isPreview: dir.split('/').at(-1)?.startsWith('preview_') ?? false,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  const publishedMatch = matches.find((match) => !match.isPreview);
  const previewMatch = matches.find((match) => match.isPreview);

  return input.preferPublished
    ? publishedMatch ?? previewMatch ?? matches[0]
    : previewMatch ?? publishedMatch ?? matches[0];
}

async function getProjectDirForProject(input: {
  workspaceDir: string;
  project: Project;
  state: 'preview' | 'published';
}): Promise<string> {
  const existing = await findProjectDir({
    workspaceDir: input.workspaceDir,
    projectId: input.project.id,
    preferPublished: input.state === 'published',
  });

  if (input.state === 'preview' && existing !== null && !existing.isPreview) {
    return existing.dir;
  }

  if (input.state === 'published') {
    return join(
      getKnowledgeRootDir(input.workspaceDir),
      getProjectDirectoryName(input.project),
    );
  }

  return join(
    getKnowledgeRootDir(input.workspaceDir),
    `preview_${getProjectDirectoryName(input.project)}`,
  );
}

async function getProjectDirForProjectId(input: {
  workspaceDir: string;
  projectId: string;
  state: 'preview' | 'published';
}): Promise<{ dir: string; project: Project | null }> {
  const existing = await findProjectDir({
    workspaceDir: input.workspaceDir,
    projectId: input.projectId,
    preferPublished: input.state === 'published',
  });

  if (existing !== null) {
    return {
      dir: existing.dir,
      project: existing.project,
    };
  }

  return {
    dir: join(
      getKnowledgeRootDir(input.workspaceDir),
      `${input.state === 'preview' ? 'preview_' : ''}${getFallbackProjectDirectoryName(
        input.projectId,
      )}`,
    ),
    project: null,
  };
}

async function getTopicDirForTopic(input: {
  projectDir: string;
  topic: Topic;
}): Promise<string> {
  const topicDirs = await listDirectories(input.projectDir);

  for (const dir of topicDirs) {
    const topic = await readJsonFile<Topic>(getTopicMetadataPath(dir));

    if (topic?.id === input.topic.id) {
      return dir;
    }
  }

  return join(input.projectDir, getTopicDirectoryName(input.topic));
}

async function getTopicDirForTopicId(input: {
  projectDir: string;
  topicId: string;
  fallbackName: string;
}): Promise<string> {
  const topicDirs = await listDirectories(input.projectDir);

  for (const dir of topicDirs) {
    const topic = await readJsonFile<Topic>(getTopicMetadataPath(dir));

    if (topic?.id === input.topicId) {
      return dir;
    }
  }

  return join(input.projectDir, input.fallbackName);
}

async function promoteProjectDirectory(input: {
  workspaceDir: string;
  article: Phase4KnowledgeArticle;
}): Promise<{ dir: string; project: Project | null }> {
  const existing = await findProjectDir({
    workspaceDir: input.workspaceDir,
    projectId: input.article.projectId,
    preferPublished: true,
  });

  if (existing === null) {
    return {
      dir: join(
        getKnowledgeRootDir(input.workspaceDir),
        getFallbackProjectDirectoryName(input.article.projectId),
      ),
      project: null,
    };
  }

  const publishedDir = join(
    getKnowledgeRootDir(input.workspaceDir),
    getProjectDirectoryName(existing.project),
  );

  if (existing.isPreview && existing.dir !== publishedDir) {
    await copyDirectoryContents(existing.dir, publishedDir);
    await rm(existing.dir, { recursive: true, force: true });
  }

  return {
    dir: publishedDir,
    project: existing.project,
  };
}

async function listProjectRecords(
  workspaceDir: string,
): Promise<Array<{ dir: string; project: Project; isPreview: boolean }>> {
  const projectDirs = await listDirectories(getKnowledgeRootDir(workspaceDir));
  const records: Array<{ dir: string; project: Project; isPreview: boolean }> = [];

  for (const dir of projectDirs) {
    const project = await readJsonFile<Project>(getProjectMetadataPath(dir));

    if (project !== null) {
      records.push({
        dir,
        project,
        isPreview: dir.split('/').at(-1)?.startsWith('preview_') ?? false,
      });
    }
  }

  return records;
}

async function listTopicRecords(
  projectDir: string,
): Promise<Array<{ dir: string; topic: Topic }>> {
  const topicDirs = await listDirectories(projectDir);
  const topics: Array<{ dir: string; topic: Topic }> = [];

  for (const dir of topicDirs) {
    const topic = await readJsonFile<Topic>(getTopicMetadataPath(dir));

    if (topic !== null) {
      topics.push({ dir, topic });
    }
  }

  return topics;
}

async function listDraftRecords(input: {
  workspaceDir: string;
}): Promise<Array<{ path: string; draft: Phase4KnowledgeArticleDraft }>> {
  const drafts: Array<{ path: string; draft: Phase4KnowledgeArticleDraft }> = [];

  for (const projectDir of await listDirectories(getKnowledgeRootDir(input.workspaceDir))) {
    for (const topicDir of await listDirectories(projectDir)) {
      for (const file of await listJsonFiles(topicDir)) {
        const fileName = file.split('/').at(-1) ?? '';

        if (!fileName.startsWith('preview_')) {
          continue;
        }

        const draft = await readJsonFile<Phase4KnowledgeArticleDraft>(file);

        if (draft !== null) {
          drafts.push({ path: file, draft });
        }
      }
    }
  }

  return drafts;
}

async function listPublishedArticleRecords(input: {
  workspaceDir: string;
}): Promise<Array<{ path: string; article: Phase4KnowledgeArticle }>> {
  const articles: Array<{ path: string; article: Phase4KnowledgeArticle }> = [];

  for (const projectDir of await listDirectories(getKnowledgeRootDir(input.workspaceDir))) {
    for (const topicDir of await listDirectories(projectDir)) {
      for (const file of await listJsonFiles(topicDir)) {
        const fileName = file.split('/').at(-1) ?? '';

        if (fileName.startsWith('preview_') || fileName.startsWith('_')) {
          continue;
        }

        const article = await readJsonFile<Phase4KnowledgeArticle>(file);

        if (article !== null) {
          articles.push({ path: file, article });
        }
      }
    }
  }

  return articles;
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
    saveProject: async (project) => {
      const projectDir = await getProjectDirForProject({
        workspaceDir: input.workspaceDir,
        project,
        state: 'preview',
      });

      await saveArtifact({
        path: getProjectMetadataPath(projectDir),
        artifact: project,
      });
    },
    saveTopic: async (topic) => {
      const { dir: projectDir } = await getProjectDirForProjectId({
        workspaceDir: input.workspaceDir,
        projectId: topic.projectId,
        state: 'published',
      });
      const topicDir = await getTopicDirForTopic({ projectDir, topic });

      await saveArtifact({
        path: getTopicMetadataPath(topicDir),
        artifact: topic,
      });
    },
    saveDraft: async (draft) => {
      const { dir: projectDir } = await getProjectDirForProjectId({
        workspaceDir: input.workspaceDir,
        projectId: draft.projectId,
        state: 'preview',
      });
      const topicDir =
        draft.topicProposal.kind === 'existing-topic'
          ? await getTopicDirForTopicId({
              projectDir,
              topicId: draft.topicProposal.topicId,
              fallbackName: getFallbackTopicDirectoryName(draft.topicProposal.topicId),
            })
          : join(projectDir, slugify(draft.topicProposal.name));

      await saveArtifact({
        path: join(topicDir, getKnowledgeFileName(draft.id, 'preview')),
        artifact: draft,
      });
    },
    deleteDraft: async (draftId) => {
      const drafts = await listDraftRecords({ workspaceDir: input.workspaceDir });

      await Promise.all(
        drafts
          .filter((record) => record.draft.id === draftId)
          .map((record) => rm(record.path, { force: true })),
      );
    },
    saveArticles: async (articles) => {
      await Promise.all(
        articles.map(async (article) => {
          const { dir: projectDir, project } = await promoteProjectDirectory({
            workspaceDir: input.workspaceDir,
            article,
          });

          if (project !== null) {
            await saveArtifact({
              path: getProjectMetadataPath(projectDir),
              artifact: project,
            });
          }

          const topicDir = await getTopicDirForTopicId({
            projectDir,
            topicId: article.topicId,
            fallbackName: getFallbackTopicDirectoryName(article.topicId),
          });

          await saveArtifact({
            path: join(topicDir, getKnowledgeFileName(article.id, 'published')),
            artifact: article,
          });
        }),
      );
    },
    deleteArticleLineage: async (articleId) => {
      const articles = await listPublishedArticleRecords({
        workspaceDir: input.workspaceDir,
      });
      const matchingArticles = articles.filter(
        (record) => record.article.articleId === articleId,
      );

      await Promise.all(
        matchingArticles.map((record) =>
          rm(record.path, { force: true }),
        ),
      );
    },
    listDrafts: async () =>
      (await listDraftRecords({ workspaceDir: input.workspaceDir })).map(
        (record) => record.draft,
      ),
    listTopics: async (projectId?: string) => {
      const projectRecords = await listProjectRecords(input.workspaceDir);
      const topicRecords = (
        await Promise.all(
          projectRecords.map(async (projectRecord) =>
            listTopicRecords(projectRecord.dir),
          ),
        )
      ).flat();
      const topics = topicRecords.map((record) => record.topic);

      return topics
        .filter((topic) => projectId === undefined || topic.projectId === projectId)
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    listKnowledgeArticleTree: async () => {
      const projectRecords = await listProjectRecords(input.workspaceDir);
      const publishedProjectRecords = projectRecords.filter(
        (projectRecord) => !projectRecord.isPreview,
      );
      const topicRecords = (
        await Promise.all(
          publishedProjectRecords.map(async (projectRecord) =>
            (await listTopicRecords(projectRecord.dir)).map((topicRecord) => ({
              ...topicRecord,
              projectId: projectRecord.project.id,
            })),
          ),
        )
      ).flat();
      const articles = (await listPublishedArticleRecords({
        workspaceDir: input.workspaceDir,
      })).map((record) => record.article);
      const projects = publishedProjectRecords.map((record) => record.project);
      const topics = topicRecords.map((record) => record.topic);

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
      const articles = (await listPublishedArticleRecords({
        workspaceDir: input.workspaceDir,
      })).map((record) => record.article);

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
