import type {
  ArticleOperationProposal,
  KnowledgeArticle,
  KnowledgeArticleDraft,
  Topic,
  TopicAssignment,
  TopicProposal,
} from '../knowledge-article/index.js';

export interface KnowledgeArticlePublishDecisionInput {
  draft: KnowledgeArticleDraft;
  topics: Topic[];
  articles: KnowledgeArticle[];
  analyzeWithLLM?: (prompt: string) => Promise<string>;
}

export interface KnowledgeArticlePublishDecision {
  topicProposal: TopicProposal;
  topicAssignment: TopicAssignment;
  articleOperationProposal: ArticleOperationProposal;
  rationale: string;
}

interface RawDecision {
  topic?: {
    kind?: string;
    topicId?: string;
    name?: string;
    description?: string;
  };
  articleOperation?: {
    kind?: string;
    articleId?: string;
  };
  rationale?: string;
}

function normalize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length > 1);
}

function similarity(left: string, right: string): number {
  const leftTokens = new Set(normalize(left));
  const rightTokens = new Set(normalize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);

  if (fenced !== null) {
    return fenced[1].trim();
  }

  if (/^json\s*[{[]/iu.test(trimmed)) {
    return trimmed.replace(/^json\s*/iu, '').trim();
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');

  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1).trim();
  }

  return trimmed;
}

function getDraftTopicName(draft: KnowledgeArticleDraft): string {
  return draft.topicProposal.kind === 'new-topic'
    ? draft.topicProposal.name
    : draft.title;
}

function buildPrompt(input: KnowledgeArticlePublishDecisionInput): string {
  const currentArticles = input.articles
    .filter((article) => article.isCurrentBest)
    .map((article) => ({
      articleId: article.articleId,
      topicId: article.topicId,
      title: article.title,
      summary: article.summary,
    }));

  return [
    'You are deciding how to publish a MirrorBrain Knowledge Article Draft.',
    'Choose whether the draft belongs to an existing topic or a new topic, and whether it should create a new article, update an existing article, or attach only as supporting evidence.',
    'Prefer update-existing-article when the draft revises or materially extends the same durable article.',
    'Prefer attach-as-supporting-evidence when the draft is relevant evidence but should not rewrite the current-best article body.',
    'Prefer create-new-article when the draft is a distinct atomic article.',
    'Return only valid JSON with this shape: {"topic":{"kind":"existing-topic","topicId":"..."} | {"kind":"new-topic","name":"...","description":"..."}, "articleOperation":{"kind":"create-new-article" | "update-existing-article" | "attach-as-supporting-evidence", "articleId":"..."}, "rationale":"..."}.',
    '',
    `Draft: ${JSON.stringify({
      title: input.draft.title,
      summary: input.draft.summary,
      topicName: getDraftTopicName(input.draft),
      bodyPreview: input.draft.body.slice(0, 2000),
    })}`,
    '',
    `Existing topics: ${JSON.stringify(input.topics.map((topic) => ({
      topicId: topic.id,
      name: topic.name,
      description: topic.description,
    })))}`,
    '',
    `Current articles: ${JSON.stringify(currentArticles)}`,
  ].join('\n');
}

function fallbackDecision(input: KnowledgeArticlePublishDecisionInput): KnowledgeArticlePublishDecision {
  const topicName = getDraftTopicName(input.draft);
  const topicText = `${topicName} ${input.draft.title} ${input.draft.summary}`;
  const bestTopic = input.topics
    .map((topic) => ({
      topic,
      score: Math.max(
        similarity(topic.name, topicText),
        topicText.toLowerCase().includes(topic.name.toLowerCase()) ? 0.85 : 0,
      ),
    }))
    .sort((left, right) => right.score - left.score)[0];
  const useExistingTopic = bestTopic !== undefined && bestTopic.score >= 0.45;
  const topicProposal: TopicProposal = useExistingTopic
    ? { kind: 'existing-topic', topicId: bestTopic.topic.id }
    : input.draft.topicProposal.kind === 'new-topic'
      ? input.draft.topicProposal
      : { kind: 'new-topic', name: input.draft.title };
  const topicAssignment: TopicAssignment =
    topicProposal.kind === 'existing-topic'
      ? { kind: 'existing-topic', topicId: topicProposal.topicId }
      : {
          kind: 'confirmed-new-topic',
          name: topicProposal.name,
          description: topicProposal.description,
        };
  const topicId = topicProposal.kind === 'existing-topic' ? topicProposal.topicId : null;
  const bestArticle = input.articles
    .filter((article) => article.isCurrentBest)
    .filter((article) => topicId === null || article.topicId === topicId)
    .map((article) => ({
      article,
      score: Math.max(
        similarity(article.title, input.draft.title),
        similarity(`${article.title} ${article.summary}`, `${input.draft.title} ${input.draft.summary}`),
      ),
    }))
    .sort((left, right) => right.score - left.score)[0];
  const articleOperationProposal: ArticleOperationProposal =
    bestArticle !== undefined && bestArticle.score >= 0.55
      ? { kind: 'update-existing-article', articleId: bestArticle.article.articleId }
      : bestArticle !== undefined && bestArticle.score >= 0.35
        ? { kind: 'attach-as-supporting-evidence', articleId: bestArticle.article.articleId }
        : { kind: 'create-new-article' };

  return {
    topicProposal,
    topicAssignment,
    articleOperationProposal,
    rationale: 'Selected by deterministic title and summary similarity fallback.',
  };
}

function validateRawDecision(
  input: KnowledgeArticlePublishDecisionInput,
  raw: RawDecision,
): KnowledgeArticlePublishDecision | null {
  const topic = raw.topic;
  const operation = raw.articleOperation;

  if (topic === undefined || operation === undefined) {
    return null;
  }

  const topicProposal: TopicProposal | null =
    topic.kind === 'existing-topic' && typeof topic.topicId === 'string'
      ? input.topics.some((item) => item.id === topic.topicId)
        ? { kind: 'existing-topic', topicId: topic.topicId }
        : null
      : topic.kind === 'new-topic' && typeof topic.name === 'string' && topic.name.trim().length > 0
        ? {
            kind: 'new-topic',
            name: topic.name.trim(),
            description: typeof topic.description === 'string' ? topic.description.trim() : undefined,
          }
        : null;

  if (topicProposal === null) {
    return null;
  }

  const allowedTopicId = topicProposal.kind === 'existing-topic' ? topicProposal.topicId : null;
  const knownArticleIds = new Set(
    input.articles
      .filter((article) => allowedTopicId === null || article.topicId === allowedTopicId)
      .map((article) => article.articleId),
  );
  const articleOperationProposal: ArticleOperationProposal | null =
    operation.kind === 'create-new-article'
      ? { kind: 'create-new-article' }
      : (operation.kind === 'update-existing-article' ||
            operation.kind === 'attach-as-supporting-evidence') &&
          typeof operation.articleId === 'string' &&
          knownArticleIds.has(operation.articleId)
        ? {
            kind: operation.kind,
            articleId: operation.articleId,
          }
        : null;

  if (articleOperationProposal === null) {
    return null;
  }

  return {
    topicProposal,
    topicAssignment:
      topicProposal.kind === 'existing-topic'
        ? { kind: 'existing-topic', topicId: topicProposal.topicId }
        : {
            kind: 'confirmed-new-topic',
            name: topicProposal.name,
            description: topicProposal.description,
          },
    articleOperationProposal,
    rationale: typeof raw.rationale === 'string' ? raw.rationale : 'Selected by LLM publish decision.',
  };
}

export async function decideKnowledgeArticlePublishOperation(
  input: KnowledgeArticlePublishDecisionInput,
): Promise<KnowledgeArticlePublishDecision> {
  if (input.analyzeWithLLM !== undefined && (input.topics.length > 0 || input.articles.length > 0)) {
    try {
      const response = await input.analyzeWithLLM(buildPrompt(input));
      const parsed = JSON.parse(stripJsonFence(response)) as RawDecision;
      const decision = validateRawDecision(input, parsed);

      if (decision !== null) {
        return decision;
      }
    } catch {
    }
  }

  return fallbackDecision(input);
}
