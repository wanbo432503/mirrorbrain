import type { KnowledgeArticle } from '../knowledge-article/index.js';

export interface KnowledgeArticleRevisionInput {
  article: KnowledgeArticle;
  instruction: string;
  analyzeWithLLM: (prompt: string) => Promise<string>;
}

export interface RevisedKnowledgeArticleContent {
  title: string;
  summary: string;
  body: string;
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
}

function parseRevisionResponse(value: string): RevisedKnowledgeArticleContent {
  const parsed = JSON.parse(stripJsonFence(value)) as Partial<RevisedKnowledgeArticleContent>;

  if (
    typeof parsed.title !== 'string' ||
    typeof parsed.summary !== 'string' ||
    typeof parsed.body !== 'string' ||
    parsed.title.trim().length === 0 ||
    parsed.summary.trim().length === 0 ||
    parsed.body.trim().length === 0
  ) {
    throw new Error('Knowledge Article revision returned an invalid response.');
  }

  return {
    title: parsed.title.trim(),
    summary: parsed.summary.trim(),
    body: parsed.body.trim(),
  };
}

export function buildKnowledgeArticleRevisionPrompt(input: {
  article: KnowledgeArticle;
  instruction: string;
}): string {
  return [
    'You are revising a published MirrorBrain Knowledge Article.',
    'Follow the user revision instruction while preserving factual provenance and the article purpose.',
    'Return only valid JSON with string fields: title, summary, body.',
    'The body must be a complete Markdown article, not a patch or commentary.',
    '',
    `User revision instruction:\n${input.instruction}`,
    '',
    `Current title:\n${input.article.title}`,
    '',
    `Current summary:\n${input.article.summary}`,
    '',
    `Current body:\n${input.article.body}`,
  ].join('\n');
}

export async function reviseKnowledgeArticleContent(
  input: KnowledgeArticleRevisionInput,
): Promise<RevisedKnowledgeArticleContent> {
  const instruction = input.instruction.trim();

  if (instruction.length === 0) {
    throw new Error('Knowledge Article revision requires a non-empty instruction.');
  }

  const response = await input.analyzeWithLLM(
    buildKnowledgeArticleRevisionPrompt({
      article: input.article,
      instruction,
    }),
  );

  return parseRevisionResponse(response);
}
