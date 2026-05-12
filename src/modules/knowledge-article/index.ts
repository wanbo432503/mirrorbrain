import type { ReviewedWorkSession } from '../project-work-session/index.js';

export interface Topic {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type TopicProposal =
  | {
      kind: 'existing-topic';
      topicId: string;
    }
  | {
      kind: 'new-topic';
      name: string;
      description?: string;
    };

export type ArticleOperationProposal =
  | {
      kind: 'create-new-article';
    }
  | {
      kind: 'update-existing-article';
      articleId: string;
    }
  | {
      kind: 'attach-as-supporting-evidence';
      articleId?: string;
    };

export interface KnowledgeArticleDraft {
  id: string;
  draftState: 'draft';
  projectId: string;
  title: string;
  summary: string;
  body: string;
  topicProposal: TopicProposal;
  articleOperationProposal: ArticleOperationProposal;
  sourceReviewedWorkSessionIds: string[];
  sourceMemoryEventIds: string[];
  provenanceRefs: Array<{
    kind: 'reviewed-work-session' | 'memory-event';
    id: string;
  }>;
  generatedAt: string;
}

export interface KnowledgeArticle {
  id: string;
  articleId: string;
  projectId: string;
  topicId: string;
  title: string;
  summary: string;
  body: string;
  version: number;
  isCurrentBest: boolean;
  supersedesArticleId: string | null;
  sourceReviewedWorkSessionIds: string[];
  sourceMemoryEventIds: string[];
  provenanceRefs: KnowledgeArticleDraft['provenanceRefs'];
  publishState: 'published';
  publishedAt: string;
  publishedBy: string;
}

export type TopicAssignment =
  | {
      kind: 'existing-topic';
      topicId: string;
    }
  | {
      kind: 'confirmed-new-topic';
      name: string;
      description?: string;
    };

export interface CreateKnowledgeArticleDraftInput {
  reviewedWorkSessions: ReviewedWorkSession[];
  generatedAt: string;
  title: string;
  summary: string;
  body: string;
  topicProposal: TopicProposal;
  articleOperationProposal: ArticleOperationProposal;
}

export interface PublishKnowledgeArticleDraftInput {
  draft: KnowledgeArticleDraft;
  publishedAt: string;
  publishedBy: string;
  topicAssignment: TopicAssignment;
  existingArticles: readonly KnowledgeArticle[];
}

export interface PublishKnowledgeArticleDraftResult {
  article: KnowledgeArticle;
  topic?: Topic;
  supersededArticle?: KnowledgeArticle;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');

  return slug.length > 0 ? slug : 'untitled';
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getReviewedProjectId(reviewedWorkSessions: ReviewedWorkSession[]): string {
  if (
    reviewedWorkSessions.length === 0 ||
    reviewedWorkSessions.some((session) => session.reviewState !== 'reviewed')
  ) {
    throw new Error('Knowledge Article Drafts require reviewed work sessions.');
  }

  const projectIds = uniqueValues(
    reviewedWorkSessions
      .map((session) => session.projectId)
      .filter((projectId): projectId is string => typeof projectId === 'string'),
  );

  if (projectIds.length !== 1) {
    throw new Error('Knowledge Article Drafts require one reviewed project.');
  }

  return projectIds[0];
}

function createProvenanceRefs(input: {
  sourceReviewedWorkSessionIds: string[];
  sourceMemoryEventIds: string[];
}): KnowledgeArticleDraft['provenanceRefs'] {
  return [
    ...input.sourceReviewedWorkSessionIds.map((id) => ({
      kind: 'reviewed-work-session' as const,
      id,
    })),
    ...input.sourceMemoryEventIds.map((id) => ({
      kind: 'memory-event' as const,
      id,
    })),
  ];
}

export function createKnowledgeArticleDraft(
  input: CreateKnowledgeArticleDraftInput,
): KnowledgeArticleDraft {
  const projectId = getReviewedProjectId(input.reviewedWorkSessions);
  const sourceReviewedWorkSessionIds = input.reviewedWorkSessions.map(
    (session) => session.id,
  );
  const sourceMemoryEventIds = uniqueValues(
    input.reviewedWorkSessions.flatMap((session) => session.memoryEventIds),
  );

  return {
    id: `knowledge-article-draft:${slugify(sourceReviewedWorkSessionIds.join('-'))}`,
    draftState: 'draft',
    projectId,
    title: input.title,
    summary: input.summary,
    body: input.body,
    topicProposal: input.topicProposal,
    articleOperationProposal: input.articleOperationProposal,
    sourceReviewedWorkSessionIds,
    sourceMemoryEventIds,
    provenanceRefs: createProvenanceRefs({
      sourceReviewedWorkSessionIds,
      sourceMemoryEventIds,
    }),
    generatedAt: input.generatedAt,
  };
}

function createConfirmedTopic(input: {
  projectId: string;
  assignment: Extract<TopicAssignment, { kind: 'confirmed-new-topic' }>;
  publishedAt: string;
}): Topic {
  return {
    id: `topic:${slugify(input.projectId)}:${slugify(input.assignment.name)}`,
    projectId: input.projectId,
    name: input.assignment.name,
    description: input.assignment.description,
    status: 'active',
    createdAt: input.publishedAt,
    updatedAt: input.publishedAt,
  };
}

function resolveTopic(input: {
  projectId: string;
  topicAssignment: TopicAssignment;
  publishedAt: string;
}): { topicId: string; topic?: Topic } {
  if (input.topicAssignment.kind === 'existing-topic') {
    return { topicId: input.topicAssignment.topicId };
  }

  const topic = createConfirmedTopic({
    projectId: input.projectId,
    assignment: input.topicAssignment,
    publishedAt: input.publishedAt,
  });

  return {
    topic,
    topicId: topic.id,
  };
}

function createArticleId(input: {
  projectId: string;
  topicId: string;
  title: string;
}): string {
  return `article:${slugify(input.projectId)}:${slugify(input.topicId)}:${slugify(input.title)}`;
}

function resolveArticleId(input: {
  draft: KnowledgeArticleDraft;
  topicId: string;
}): string {
  if (input.draft.articleOperationProposal.kind === 'update-existing-article') {
    return input.draft.articleOperationProposal.articleId;
  }

  if (input.draft.articleOperationProposal.kind === 'attach-as-supporting-evidence') {
    return (
      input.draft.articleOperationProposal.articleId ??
      createArticleId({
        projectId: input.draft.projectId,
        topicId: input.topicId,
        title: input.draft.title,
      })
    );
  }

  return createArticleId({
    projectId: input.draft.projectId,
    topicId: input.topicId,
    title: input.draft.title,
  });
}

export function publishKnowledgeArticleDraft(
  input: PublishKnowledgeArticleDraftInput,
): PublishKnowledgeArticleDraftResult {
  const { topicId, topic } = resolveTopic({
    projectId: input.draft.projectId,
    topicAssignment: input.topicAssignment,
    publishedAt: input.publishedAt,
  });
  const articleId = resolveArticleId({
    draft: input.draft,
    topicId,
  });
  const existingArticleVersions = input.existingArticles.filter(
    (article) =>
      article.projectId === input.draft.projectId &&
      article.topicId === topicId &&
      article.articleId === articleId,
  );
  const currentBest = existingArticleVersions
    .filter((article) => article.isCurrentBest)
    .sort((left, right) => right.version - left.version)[0];
  const nextVersion =
    existingArticleVersions.reduce(
      (maxVersion, article) => Math.max(maxVersion, article.version),
      0,
    ) + 1;
  const article: KnowledgeArticle = {
    id: `knowledge-article:${slugify(articleId)}:v${nextVersion}`,
    articleId,
    projectId: input.draft.projectId,
    topicId,
    title: input.draft.title,
    summary: input.draft.summary,
    body: input.draft.body,
    version: nextVersion,
    isCurrentBest: true,
    supersedesArticleId: currentBest?.id ?? null,
    sourceReviewedWorkSessionIds: [...input.draft.sourceReviewedWorkSessionIds],
    sourceMemoryEventIds: [...input.draft.sourceMemoryEventIds],
    provenanceRefs: [...input.draft.provenanceRefs],
    publishState: 'published',
    publishedAt: input.publishedAt,
    publishedBy: input.publishedBy,
  };

  return {
    article,
    topic,
    supersededArticle: currentBest
      ? {
          ...currentBest,
          isCurrentBest: false,
        }
      : undefined,
  };
}
