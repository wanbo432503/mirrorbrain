import type { BrowserPageContentArtifact } from '../../integrations/browser-page-content/index.js';
import { loadBrowserPageContentArtifactFromWorkspace } from '../../integrations/browser-page-content/index.js';
import { loadLLMConfig } from '../../shared/llm-title-generation/http-fetch.js';
import type {
  KnowledgeArtifact,
  MemoryEvent,
  ReviewedMemory,
} from '../../shared/types/index.js';

export type NoteType =
  | 'workflow'
  | 'tutorial'
  | 'insight-report'
  | 'development-record';

export interface ContentRetrievalResult {
  content: string;
  source: 'captured-page-text' | 'artifact' | 'live-fetch' | 'unavailable';
  url?: string;
  title?: string;
}

export interface KnowledgeGenerationDependencies {
  getMemoryEvent?: (eventId: string) => Promise<MemoryEvent | null>;
  loadBrowserPageContentArtifactFromWorkspace?: typeof loadBrowserPageContentArtifactFromWorkspace;
  fetchUrl?: (url: string) => Promise<string>;
  analyzeWithLLM?: (prompt: string) => Promise<string>;
  retrievePageContent?: (
    eventId: string,
    deps?: KnowledgeGenerationDependencies,
  ) => Promise<ContentRetrievalResult>;
  now?: () => string;
  workspaceDir?: string;
}

interface GenerateKnowledgeOptions extends KnowledgeGenerationDependencies {
  existingDraft?: KnowledgeArtifact;
}

interface BuildKnowledgeSynthesisPromptInput {
  noteType: NoteType;
  reviewedMemories: ReviewedMemory[];
  retrievedContent: ContentRetrievalResult[];
}

interface KnowledgeBodySynthesisResult {
  body: string;
  usedDegradedFallback: boolean;
}

const NOISY_LINE_PATTERNS = [
  /扫码登录/u,
  /账号登录/u,
  /密码登录/u,
  /注册新账号/u,
  /注册VIP/u,
  /服务条款/u,
  /隐私政策/u,
  /载入中/u,
  /浏览器不支持或禁止了网页脚本/u,
  /如何解除脚本限制/u,
  /登录iframe/u,
  /网易公司版权所有/u,
  /ICP备案/u,
  /公网安备/u,
  /增值电信业务许可证/u,
  /手机App下载/u,
  /电脑客户端下载/u,
  /VIP 会员/u,
  /靓号/u,
  /企业邮箱/u,
  /海外登录/u,
  /安全 帮助 反馈/u,
];

const LOGIN_PAGE_PATTERNS = [
  /mail\.163\.com/u,
  /扫码登录/u,
  /账号登录/u,
  /登录iframe/u,
  /浏览器不支持或禁止了网页脚本/u,
];

const SEARCH_UTILITY_SOURCE_PATTERNS = [
  /google\.com\/search/iu,
  /^Google Search$/iu,
  /Please click here if you are not redirected/iu,
];

function slugifyTopicKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function safeUrl(value: string | undefined): string | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}${parsed.hash}`;
  } catch {
    return value.split('?')[0]?.split('&sid=')[0];
  }
}

function toKnowledgeTitle(value: string): string {
  return value
    .split(/[\s_-]+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function containsChinese(value: string): boolean {
  return /[\p{Script=Han}]/u.test(value);
}

function normalizeTitleText(value: string): string {
  return value
    .replace(/^#+\s*/u, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function isCodeLikeTitle(value: string): boolean {
  const normalized = normalizeTitleText(value);
  if (normalized.length === 0) {
    return true;
  }

  const chunks = normalized
    .split(/[\/|,，、\s]+/u)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  if (chunks.length > 0 && chunks.every((chunk) => /^[a-f0-9]{4,}$/iu.test(chunk))) {
    return true;
  }

  return /^[a-f0-9-]{8,}$/iu.test(normalized);
}

function extractMarkdownH1(body: string): string | undefined {
  const heading = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^#\s+\S/u.test(line));

  if (heading === undefined) {
    return undefined;
  }

  const title = normalizeTitleText(heading);
  return title.length > 0 ? title : undefined;
}

function isUsableChineseTitle(value: string | undefined): boolean {
  return (
    value !== undefined &&
    containsChinese(value) &&
    !isCodeLikeTitle(value) &&
    normalizeTitleText(value).length >= 6
  );
}

function firstChineseClause(value: string | undefined): string | undefined {
  if (value === undefined || !containsChinese(value)) {
    return undefined;
  }

  const [clause] = value
    .split(/[。！？；\n]/u)
    .map((part) => normalizeTitleText(part))
    .filter((part) => part.length >= 6);

  if (clause === undefined) {
    return undefined;
  }

  return clause.length > 32 ? clause.slice(0, 32) : clause;
}

function resolveKnowledgeTitle(memory: ReviewedMemory | undefined): string {
  if (memory === undefined) {
    return '知识总结';
  }

  const candidateTitle: string = memory.candidateTitle;

  if (isUsableChineseTitle(candidateTitle)) {
    return normalizeTitleText(candidateTitle);
  }

  const summaryTitle = firstChineseClause(memory.candidateSummary);
  if (summaryTitle !== undefined) {
    return summaryTitle;
  }

  if (/^Work on\s+/iu.test(candidateTitle)) {
    const titleTopic = candidateTitle.replace(/^Work on\s+/iu, '');
    const topic = memory.candidateTheme?.trim() || titleTopic;
    return `关于 ${toKnowledgeTitle(topic)} 的知识总结`;
  }

  if (!isCodeLikeTitle(candidateTitle)) {
    return `关于 ${toKnowledgeTitle(candidateTitle)} 的知识总结`;
  }

  const theme = memory.candidateTheme?.trim();
  if (theme !== undefined && theme.length > 0 && !isCodeLikeTitle(theme)) {
    return `关于 ${toKnowledgeTitle(theme)} 的知识总结`;
  }

  return '工作知识总结';
}

function resolveArtifactTitle(input: {
  synthesizedBody: string;
  reviewedMemories: ReviewedMemory[];
}): string {
  const bodyTitle = extractMarkdownH1(input.synthesizedBody);
  if (bodyTitle !== undefined && isUsableChineseTitle(bodyTitle)) {
    return normalizeTitleText(bodyTitle);
  }

  return resolveKnowledgeTitle(input.reviewedMemories[0]);
}

function replaceMarkdownH1(body: string, title: string): string {
  if (/^#\s+\S/mu.test(body)) {
    return body.replace(/^#\s+.+$/mu, `# ${title}`);
  }

  return `# ${title}\n\n${body}`;
}

function getEventUrl(event: MemoryEvent | null): string | undefined {
  const url = event?.content.url;
  return typeof url === 'string' && url.trim().length > 0 ? url : undefined;
}

function getEventTitle(event: MemoryEvent | null): string | undefined {
  const title = event?.content.title;
  return typeof title === 'string' && title.trim().length > 0 ? title : undefined;
}

function getEventPageText(event: MemoryEvent | null): string | undefined {
  const pageText = event?.content.pageText;
  return typeof pageText === 'string' && pageText.trim().length > 0
    ? pageText
    : undefined;
}

export async function retrievePageContent(
  memoryEventId: string,
  deps: KnowledgeGenerationDependencies = {},
): Promise<ContentRetrievalResult> {
  const event = (await deps.getMemoryEvent?.(memoryEventId)) ?? null;
  const url = getEventUrl(event);
  const title = getEventTitle(event);
  const pageText = getEventPageText(event);

  if (pageText !== undefined) {
    return {
      content: pageText,
      source: 'captured-page-text',
      url,
      title,
    };
  }

  if (url !== undefined) {
    const loadArtifact =
      deps.loadBrowserPageContentArtifactFromWorkspace ??
      loadBrowserPageContentArtifactFromWorkspace;
    const workspaceDir = deps.workspaceDir ?? process.env.MIRRORBRAIN_WORKSPACE_DIR;

    if (workspaceDir === undefined || workspaceDir.length === 0) {
      throw new Error(
        'workspaceDir is required; refusing to use the source directory as a MirrorBrain workspace.',
      );
    }

    const artifact: BrowserPageContentArtifact | null = await loadArtifact({
      workspaceDir,
      url,
    });

    if (artifact?.text && artifact.text.trim().length > 0) {
      return {
        content: artifact.text,
        source: 'artifact',
        url,
        title: artifact.title || title,
      };
    }

    if (deps.fetchUrl !== undefined) {
      try {
        const liveContent = await deps.fetchUrl(url);
        if (liveContent.trim().length > 0) {
          return {
            content: liveContent,
            source: 'live-fetch',
            url,
            title,
          };
        }
      } catch {
        return {
          content: '',
          source: 'unavailable',
          url,
          title,
        };
      }
    }
  }

  return {
    content: '',
    source: 'unavailable',
    url,
    title,
  };
}

export async function classifyNoteType(
  content: string,
  deps: Pick<KnowledgeGenerationDependencies, 'analyzeWithLLM'> = {},
): Promise<NoteType> {
  if (deps.analyzeWithLLM !== undefined) {
    try {
      const response = await deps.analyzeWithLLM(
        [
          'Classify this reviewed work note as one of:',
          'workflow, tutorial, insight-report, development-record.',
          'Return only the category.',
          content,
        ].join('\n\n'),
      );
      const normalized = response.toLowerCase();
      const validTypes: NoteType[] = [
        'workflow',
        'tutorial',
        'insight-report',
        'development-record',
      ];
      return (
        validTypes.find((type) => normalized.includes(type)) ??
        'development-record'
      );
    } catch {
      // Fall back to local classification so knowledge generation still works offline.
    }
  }

  if (/\b(step\s*\d+|how to|guide|setup|install|configure)\b/iu.test(content)) {
    return 'tutorial';
  }
  if (/\b(workflow|routine|procedure|checklist|repeatable)\b/iu.test(content)) {
    return 'workflow';
  }
  if (/\b(finding|observation|pattern|insight|analysis|implication)\b/iu.test(content)) {
    return 'insight-report';
  }
  return 'development-record';
}

function isNoisyLine(line: string): boolean {
  const trimmed = line.trim();

  return (
    trimmed.length === 0 ||
    NOISY_LINE_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
    /^[\d.]+$/u.test(trimmed)
  );
}

function isSearchUtilitySource(input: {
  url?: string;
  title?: string;
  content?: string;
}): boolean {
  const haystack = `${input.url ?? ''}\n${input.title ?? ''}\n${input.content ?? ''}`;
  return SEARCH_UTILITY_SOURCE_PATTERNS.some((pattern) => pattern.test(haystack));
}

function cleanSourceExcerpt(content: string): string {
  const seen = new Set<string>();
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !isNoisyLine(line))
    .filter((line) => {
      const normalized = line.replace(/\s+/gu, ' ');
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .slice(0, 18);

  return lines.join('\n').slice(0, 1800);
}

function looksLikeLoginPage(item: ContentRetrievalResult): boolean {
  const haystack = `${item.url ?? ''}\n${item.title ?? ''}\n${item.content}`;
  return LOGIN_PAGE_PATTERNS.some((pattern) => pattern.test(haystack));
}

function formatPromptSources(
  retrievedContent: ContentRetrievalResult[],
): string {
  if (retrievedContent.length === 0) {
    return '- No source excerpts were available.';
  }

  return retrievedContent
    .filter((item) => !isSearchUtilitySource(item))
    .map((item, index) => {
      const excerpt = cleanSourceExcerpt(item.content);
      const evidenceWarning = looksLikeLoginPage(item)
        ? '\nEvidence warning: Evidence from login pages or mailbox shells is weak. Do not treat login UI boilerplate as email content.'
        : '';

      return [
        `### S${index + 1}: ${item.title ?? safeUrl(item.url) ?? 'Untitled source'}`,
        `URL: ${safeUrl(item.url) ?? 'unknown'}`,
        `Source kind: ${item.source}`,
        evidenceWarning.trim(),
        'Clean excerpt:',
        excerpt.length > 0 ? excerpt : '(No usable excerpt after boilerplate removal.)',
      ]
        .filter((line) => line.length > 0)
        .join('\n');
    })
    .join('\n\n');
}

function formatReviewedMemoryContext(reviewedMemories: ReviewedMemory[]): string {
  return reviewedMemories
    .map((memory, index) =>
      [
        `### M${index + 1}: ${memory.candidateTitle}`,
        `Summary: ${memory.candidateSummary}`,
        `Theme: ${memory.candidateTheme ?? 'unknown'}`,
        `Review date: ${memory.reviewDate}`,
        `Reviewed memory id: ${memory.id}`,
      ].join('\n'),
    )
    .join('\n\n');
}

export function buildKnowledgeSynthesisPrompt(
  input: BuildKnowledgeSynthesisPromptInput,
): string {
  return [
    'You are the MirrorBrain knowledge draft writer.',
    '',
    'Task: transform reviewed work memories into a durable, topic-oriented wiki page. Do not write an activity recap. Do not paste raw page text. Do not create a browsing transcript. Do not copy navigation chrome, login forms, legal text, repeated boilerplate, iframes, counters, or account/session tokens.',
    '',
    'Evidence policy:',
    '- Use reviewed memory title and summary as the primary intent signal.',
    '- Use source excerpts only when they contain substantive task evidence.',
    '- Evidence from login pages, mailbox shells, or pages that only show authentication UI is weak; say what remains unverified instead of pretending to know the email body.',
    '- Preserve provenance using source labels like [S1], [S2].',
    '- Never include secrets, session ids, raw query tokens, or login URLs with sensitive parameters.',
    '',
    'Output format: markdown only, primarily Chinese. The first line must be a complete Chinese H1 title that describes the topic. Do not use ids, hashes, URL fragments, random short codes, or broken English as the title. Use these sections:',
    '# <完整中文知识标题>',
    '## 核心结论',
    '## 背景与证据',
    '## 可复用知识',
    '## 后续行动 / 待确认',
    '## 来源',
    '',
    `Note type: ${input.noteType}`,
    '',
    'Reviewed memories:',
    formatReviewedMemoryContext(input.reviewedMemories),
    '',
    'Source excerpts:',
    formatPromptSources(input.retrievedContent),
  ].join('\n');
}

function extractUrlKeywords(urls: string[]): string[] {
  return urls.flatMap((url) => {
    try {
      const parsed = new URL(url);
      const hostParts = parsed.hostname
        .replace(/^www\./u, '')
        .split('.')
        .filter((part) => !['com', 'dev', 'org', 'io', 'net', 'docs', 'github'].includes(part));
      const pathParts = parsed.pathname
        .split('/')
        .filter((part) => part.length > 2)
        .flatMap((part) => part.split(/[-_]/u));
      return [...hostParts, ...pathParts].map((part) => part.toLowerCase());
    } catch {
      return [];
    }
  });
}

export async function extractThemeFromUrls(
  urls: string[],
  deps: Pick<KnowledgeGenerationDependencies, 'analyzeWithLLM'> = {},
): Promise<string> {
  if (deps.analyzeWithLLM !== undefined) {
    try {
      const response = await deps.analyzeWithLLM(
        `Extract a concise 1-3 word topic from these URLs:\n${urls.join('\n')}`,
      );
      const theme = slugifyTopicKey(response.trim());
      return theme.length > 0 ? theme : 'general-work';
    } catch {
      // Fall back to URL keywords so transient LLM fetch errors do not block drafts.
    }
  }

  const counts = new Map<string, number>();
  for (const keyword of extractUrlKeywords(urls)) {
    counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
  }

  const [theme] =
    Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ??
    [];

  return theme ?? 'general-work';
}

function resolveTheme(reviewedMemories: ReviewedMemory[], urls: string[]): string {
  const explicitThemes = reviewedMemories
    .map((memory) => memory.candidateTheme?.trim())
    .filter((theme): theme is string => theme !== undefined && theme.length > 0);

  if (explicitThemes.length > 0) {
    const commonTokens = explicitThemes
      .flatMap((theme) => theme.toLowerCase().split(/[^a-z0-9]+/u))
      .filter((token) => token.length > 2);
    const usefulToken = commonTokens.find((token) =>
      ['testing', 'debugging', 'implementation', 'workflow', 'review'].includes(token),
    );

    return usefulToken ?? explicitThemes[0] ?? 'general-work';
  }

  return urls.length > 0 ? '' : 'general-work';
}

function formatSources(
  reviewedMemories: ReviewedMemory[],
  retrievedContent: ContentRetrievalResult[],
): string {
  const sourceLines = reviewedMemories.flatMap((memory) =>
    (memory.candidateSourceRefs ?? [])
      .filter((source) => !isSearchUtilitySource(source))
      .map((source) => {
        const title = source.title ?? source.id;
        const url = source.url ? ` (${safeUrl(source.url)})` : '';
        return `- ${title}${url}`;
      }),
  );
  const retrievedLines = retrievedContent
    .filter((item) => item.url !== undefined)
    .filter((item) => !isSearchUtilitySource(item))
    .map((item) => `- ${item.title ?? item.url} (${safeUrl(item.url)})`);

  return Array.from(new Set([...sourceLines, ...retrievedLines])).join('\n');
}

function buildKnowledgeBody(input: {
  noteType: NoteType;
  reviewedMemories: ReviewedMemory[];
  retrievedContent: ContentRetrievalResult[];
  title: string;
}): string {
  const memorySummary = input.reviewedMemories
    .map((memory) => `- ${memory.candidateTitle}: ${memory.candidateSummary}`)
    .join('\n');
  const sources = formatSources(input.reviewedMemories, input.retrievedContent);

  return [
    `# ${input.title}`,
    '',
    `Note type: ${input.noteType}`,
    '',
    '## Generation Status',
    'LLM synthesis was unavailable. This is a degraded review scaffold, not a compiled knowledge page. Regenerate after configuring a working LLM before publishing.',
    '',
    '## Review Context',
    memorySummary,
    '',
    '## Next Step',
    'Configure a working MirrorBrain LLM model and regenerate this draft so the source material can be synthesized instead of copied.',
    '',
    '## Provenance',
    sources.length > 0 ? sources : 'See reviewed memory references.',
  ].join('\n');
}

export async function analyzeKnowledgeWithConfiguredLLM(prompt: string): Promise<string> {
  const config = await loadLLMConfig();
  const response = await fetch(`${config.apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    throw new Error(`Knowledge synthesis LLM API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('Knowledge synthesis LLM returned empty content.');
  }

  return content.replace(/^```(?:markdown)?\s*/u, '').replace(/\s*```$/u, '').trim();
}

async function synthesizeKnowledgeBody(input: {
  noteType: NoteType;
  reviewedMemories: ReviewedMemory[];
  retrievedContent: ContentRetrievalResult[];
  analyzeWithLLM?: (prompt: string) => Promise<string>;
  fallbackTitle: string;
}): Promise<KnowledgeBodySynthesisResult> {
  const prompt = buildKnowledgeSynthesisPrompt(input);

  if (input.analyzeWithLLM !== undefined) {
    try {
      const body = (await input.analyzeWithLLM(prompt)).trim();
      if (body.length > 0) {
        return {
          body,
          usedDegradedFallback: false,
        };
      }
    } catch {
      // Fall back to a conservative structured note when synthesis fails.
    }
  }

  return {
    body: buildKnowledgeBody({
      ...input,
      title: input.fallbackTitle,
    }),
    usedDegradedFallback: true,
  };
}

export async function generateKnowledgeFromReviewedMemories(
  reviewedMemories: ReviewedMemory[],
  options: GenerateKnowledgeOptions = {},
): Promise<KnowledgeArtifact> {
  if (reviewedMemories.length === 0) {
    throw new Error('No reviewed memories provided for knowledge generation.');
  }

  const retrieve = options.retrievePageContent ?? retrievePageContent;
  const retrievedContent: ContentRetrievalResult[] = [];

  for (const memory of reviewedMemories) {
    for (const eventId of memory.memoryEventIds) {
      retrievedContent.push(await retrieve(eventId, options));
    }
  }

  const urls = Array.from(
    new Set(
      [
        ...retrievedContent.map((item) => item.url),
        ...reviewedMemories.flatMap((memory) =>
          (memory.candidateSourceRefs ?? []).map((source) => source.url),
        ),
      ].filter((url): url is string => url !== undefined && url.length > 0),
    ),
  );
  const combinedContent = retrievedContent
    .map((item) => item.content)
    .filter((content) => content.trim().length > 0)
    .join('\n\n');
  const noteType = await classifyNoteType(combinedContent, options);
  const resolvedTheme = resolveTheme(reviewedMemories, urls);
  const topicKey = slugifyTopicKey(
    resolvedTheme.length > 0
      ? resolvedTheme
      : await extractThemeFromUrls(urls, options),
  );
  const firstMemory = reviewedMemories[0]!;
  const now = options.now?.() ?? new Date().toISOString();
  const fallbackTitle = resolveKnowledgeTitle(firstMemory);
  const synthesizedBody = await synthesizeKnowledgeBody({
    noteType,
    reviewedMemories,
    retrievedContent,
    analyzeWithLLM: options.analyzeWithLLM,
    fallbackTitle,
  });
  const title = resolveArtifactTitle({
    synthesizedBody: synthesizedBody.body,
    reviewedMemories,
  });

  return {
    artifactType: 'daily-review-draft',
    id: options.existingDraft
      ? `knowledge-draft:${firstMemory.id}:revision-${now}`
      : `knowledge-draft:${firstMemory.id}`,
    draftState: 'draft',
    topicKey: topicKey.length > 0 ? topicKey : null,
    title,
    summary: `${reviewedMemories.length} reviewed ${
      reviewedMemories.length === 1 ? 'memory' : 'memories'
    } synthesized into ${noteType} knowledge.`,
    body: replaceMarkdownH1(synthesizedBody.body, title),
    sourceReviewedMemoryIds: reviewedMemories.map((memory) => memory.id),
    derivedFromKnowledgeIds: options.existingDraft ? [options.existingDraft.id] : [],
    version: (options.existingDraft?.version ?? 0) + 1,
    isCurrentBest: false,
    supersedesKnowledgeId: null,
    updatedAt: now,
    reviewedAt: firstMemory.reviewedAt,
    recencyLabel: firstMemory.reviewDate,
    provenanceRefs: reviewedMemories.map((memory) => ({
      kind: 'reviewed-memory',
      id: memory.id,
    })),
    compilationMetadata: synthesizedBody.usedDegradedFallback
      ? {
          discoveryInsights: [
            'LLM synthesis unavailable; generated degraded scaffold without source excerpt synthesis.',
          ],
          generationMethod: 'legacy',
          executeStageCompletedAt: now,
        }
      : undefined,
  };
}
