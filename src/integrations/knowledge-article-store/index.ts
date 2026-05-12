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
  listArticleHistory(filter: {
    projectId: string;
    topicId: string;
  }): Promise<Phase4KnowledgeArticle[]>;
  getCurrentBestArticle(filter: {
    projectId: string;
    topicId: string;
  }): Promise<Phase4KnowledgeArticle | null>;
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
    listArticleHistory: async (filter) => {
      const articles = await listArtifacts<Phase4KnowledgeArticle>({
        workspaceDir: input.workspaceDir,
        directory: 'knowledge-articles',
      });

      return articles
        .filter(
          (article) =>
            article.projectId === filter.projectId &&
            article.topicId === filter.topicId,
        )
        .sort((left, right) => right.version - left.version);
    },
    getCurrentBestArticle: async (filter) => {
      const history = await createFileKnowledgeArticleStore(input).listArticleHistory(
        filter,
      );

      return history.find((article) => article.isCurrentBest) ?? null;
    },
  };
}
