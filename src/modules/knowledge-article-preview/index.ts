import type { ReviewedMemory } from '../../shared/types/index.js';
import type { WorkSessionCandidate } from '../../workflows/work-session-analysis/index.js';
import {
  buildKnowledgeSynthesisPrompt,
  type ContentRetrievalResult,
} from '../knowledge-generation-llm/index.js';

export type KnowledgeArticlePreviewType =
  | 'systematic-knowledge'
  | 'workflow'
  | 'news';

export interface KnowledgeArticlePreview {
  candidateId: string;
  title: string;
  summary: string;
  body: string;
  knowledgeType: KnowledgeArticlePreviewType;
  sourceTypes: string[];
  memoryEventCount: number;
}

export interface GenerateKnowledgeArticlePreviewInput {
  candidate: WorkSessionCandidate;
  topicName?: string;
  generatedAt: string;
  analyzeWithLLM?: (prompt: string) => Promise<string>;
}

function deriveKnowledgeType(candidate: WorkSessionCandidate): KnowledgeArticlePreviewType {
  const text = [
    candidate.title,
    candidate.summary,
    candidate.projectHint,
    ...candidate.relationHints,
  ]
    .join(' ')
    .toLowerCase();

  if (
    /(\bworkflow\b|\bprocess\b|\bsteps?\b|\bhow to\b|\bdebug\b|\bfix\b|流程|步骤|排查|修复)/u.test(
      text,
    )
  ) {
    return 'workflow';
  }

  if (/(\bnews\b|\brelease\b|\bannounced\b|\bupdate\b|新闻|资讯|发布|更新)/u.test(text)) {
    return 'news';
  }

  return 'systematic-knowledge';
}

function noteTypeFromPreviewType(
  previewType: KnowledgeArticlePreviewType,
): 'workflow' | 'insight-report' {
  return previewType === 'workflow' ? 'workflow' : 'insight-report';
}

function extractMarkdownH1(body: string): string | undefined {
  const heading = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^#\s+\S/u.test(line));

  if (heading === undefined) {
    return undefined;
  }

  const title = heading.replace(/^#\s+/u, '').replace(/\s+/gu, ' ').trim();
  return title.length > 0 ? title : undefined;
}

function stripMarkdownFences(value: string): string {
  return value.replace(/^```(?:markdown)?\s*/u, '').replace(/\s*```$/u, '').trim();
}

function createReviewedMemory(
  candidate: WorkSessionCandidate,
  generatedAt: string,
  topicName?: string,
): ReviewedMemory {
  return {
    id: `preview-reviewed:${candidate.id}`,
    candidateMemoryId: candidate.id,
    candidateTitle: candidate.title,
    candidateSummary: candidate.summary,
    candidateTheme: topicName ?? candidate.relationHints[0] ?? candidate.title,
    memoryEventIds: candidate.memoryEventIds,
    candidateSourceRefs: (candidate.evidenceItems ?? []).map((item) => ({
      id: item.memoryEventId,
      sourceType: item.sourceType,
      timestamp: candidate.timeRange.startAt,
      title: item.title,
      url: item.url,
      contribution: 'primary',
    })),
    reviewDate: candidate.timeRange.endAt.slice(0, 10),
    decision: 'keep',
    reviewedAt: generatedAt,
  };
}

function createRetrievedContent(candidate: WorkSessionCandidate): ContentRetrievalResult[] {
  return (candidate.evidenceItems ?? []).map((item) => ({
    content: item.excerpt,
    source: 'captured-page-text',
    url: item.url,
    title: item.title,
  }));
}

function buildFallbackBody(candidate: WorkSessionCandidate): string {
  const evidence = (candidate.evidenceItems ?? [])
    .map((item, index) => {
      const url = item.url !== undefined ? ` (${item.url})` : '';
      return `- [S${index + 1}] ${item.title}${url}: ${item.excerpt}`;
    })
    .join('\n');

  return [
    `# ${candidate.title}`,
    '',
    '## Generation Status',
    'LLM synthesis was unavailable. This preview preserves evidence excerpts but should be regenerated after configuring a working LLM.',
    '',
    '## 核心结论',
    candidate.summary,
    '',
    '## 背景与证据',
    evidence.length > 0 ? evidence : 'No source excerpts were available.',
    '',
    '## 来源',
    evidence.length > 0 ? evidence : 'See memory event provenance.',
  ].join('\n');
}

export async function generateKnowledgeArticlePreview(
  input: GenerateKnowledgeArticlePreviewInput,
): Promise<KnowledgeArticlePreview> {
  const knowledgeType = deriveKnowledgeType(input.candidate);
  const reviewedMemory = createReviewedMemory(
    input.candidate,
    input.generatedAt,
    input.topicName,
  );
  const retrievedContent = createRetrievedContent(input.candidate);
  const prompt = buildKnowledgeSynthesisPrompt({
    noteType: noteTypeFromPreviewType(knowledgeType),
    reviewedMemories: [reviewedMemory],
    retrievedContent,
  });

  let body = buildFallbackBody(input.candidate);
  if (input.analyzeWithLLM !== undefined) {
    try {
      const synthesizedBody = stripMarkdownFences(await input.analyzeWithLLM(prompt));
      if (synthesizedBody.length > 0) {
        body = synthesizedBody;
      }
    } catch {
      body = buildFallbackBody(input.candidate);
    }
  }

  return {
    candidateId: input.candidate.id,
    title: extractMarkdownH1(body) ?? input.candidate.title,
    summary: input.candidate.summary,
    body,
    knowledgeType,
    sourceTypes: input.candidate.sourceTypes,
    memoryEventCount: input.candidate.memoryEventIds.length,
  };
}
