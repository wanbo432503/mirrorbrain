/**
 * Memory event evaluation and filtering module.
 *
 * Inspired by OpenWiki's first-stage assessment:
 * - Importance scoring (text richness, source type, user signals, preference match)
 * - Semantic deduplication (N-gram Jaccard similarity)
 * - Top-N selection with category balancing
 *
 * This module operates BEFORE clustering to ensure only worthy events enter the pipeline.
 */

import type { MemoryEvent } from '../../shared/types/index.js';

/**
 * Minimum text length for meaningful content.
 */
const MIN_TEXT_LENGTH = 20;

/**
 * Minimum page text length for valuable browser content (after HTML extraction).
 */
const MIN_PAGE_TEXT_LENGTH = 100;

/**
 * Maximum number of events to ingest per day.
 */
const MAX_DAILY_INGESTION = 50;

/**
 * N-gram size for semantic similarity comparison.
 */
const NGRAM_SIZE = 3;

/**
 * Similarity threshold for near-duplicate detection (0.0–1.0).
 * Events with similarity above this are considered duplicates.
 */
const SIMILARITY_THRESHOLD = 0.6;

/**
 * Scored memory event ready for ranking.
 */
export interface ScoredMemoryEvent {
  event: MemoryEvent;
  importance: number;
  reasons: string[];
}

/**
 * Smart pre-filtering pipeline for memory event ingestion.
 *
 * Steps:
 * 1. Basic junk filtering (short text, noise patterns)
 * 2. Importance scoring (source type, text richness, content signals)
 * 3. Semantic deduplication (N-gram Jaccard similarity)
 * 4. Top-N selection with source balancing
 *
 * Returns (scored_events, filter_stats).
 */
export function evaluateMemoryEventsForIngestion(
  events: MemoryEvent[],
): {
  scoredEvents: ScoredMemoryEvent[];
  stats: {
    total: number;
    basicFiltered: number;
    dedupRemoved: number;
    finalKept: number;
  };
} {
  // Step 1: Basic junk filtering
  const { cleanEvents, filteredCount } = basicFilter(events);

  if (cleanEvents.length === 0) {
    return {
      scoredEvents: [],
      stats: {
        total: events.length,
        basicFiltered: filteredCount,
        dedupRemoved: 0,
        finalKept: 0,
      },
    };
  }

  // Step 2: Score each event by importance
  const scored = cleanEvents
    .map((event) => ({
      event,
      importance: computeImportance(event),
      reasons: getImportanceReasons(event),
    }))
    .sort((a, b) => b.importance - a.importance);

  // Step 3: Filter out very low quality events (penalty score made them unqualified)
  const qualified = scored.filter((s) => !isVeryLowQuality(s));
  const qualityFiltered = scored.length - qualified.length;

  // Step 4: Semantic deduplication
  const deduped = deduplicateBySemanticSimilarity(qualified);
  const dedupRemoved = qualified.length - deduped.length;

  // Step 5: Top-N with source balancing
  const finalEvents = balanceAndCapBySourceType(deduped, MAX_DAILY_INGESTION);

  return {
    scoredEvents: finalEvents,
    stats: {
      total: events.length,
      basicFiltered: filteredCount + qualityFiltered,
      dedupRemoved,
      finalKept: finalEvents.length,
    },
  };
}

/**
 * Basic junk/noise filtering.
 * Returns (kept_events, filtered_count).
 */
function basicFilter(events: MemoryEvent[]): {
  cleanEvents: MemoryEvent[];
  filteredCount: number;
} {
  const kept: MemoryEvent[] = [];
  let filtered = 0;

  for (const event of events) {
    // Always keep browser events with URL (they will be evaluated for page content quality later)
    if (event.sourceType === 'activitywatch-browser') {
      const url = typeof event.content.url === 'string' ? event.content.url : null;

      // Skip browser events without URL
      if (!url) {
        filtered++;
        continue;
      }

      // Skip localhost/debug URLs (they are important but handled differently)
      if (isSkippableBrowserPageUrl(url)) {
        filtered++;
        continue;
      }

      kept.push(event);
      continue;
    }

    // For shell events, apply filtering rules
    const text = getEventText(event);
    if (!text) {
      filtered++;
      continue;
    }

    const trimmed = text.trim();

    // Rule 1: Filter out text that is too short (< 20 chars)
    if (trimmed.length < MIN_TEXT_LENGTH) {
      filtered++;
      continue;
    }

    // Rule 2: Filter out code, file paths, and shell commands
    if (looksLikeCodeOrPath(trimmed)) {
      filtered++;
      continue;
    }

    kept.push(event);
  }

  return { cleanEvents: kept, filteredCount: filtered };
}

/**
 * Compute importance score for a memory event (0.0–1.0 scale).
 */
function computeImportance(event: MemoryEvent): number {
  let score = 0.0;

  // --- Factor 1: Source type weight (0–0.25) ---
  // Browser events have URL + title + possibly page content, most valuable
  // Shell events are command history, moderate value
  const typeWeight = event.sourceType === 'activitywatch-browser' ? 0.25 : 0.15;
  score += typeWeight;

  // --- Factor 2: Text richness (0–0.30) ---
  const text = getEventText(event);
  const charCount = text?.length ?? 0;

  const richness =
    charCount === 0
      ? 0.0
      : charCount < 50
        ? 0.05
        : charCount < 150
          ? 0.10
          : charCount < 400
            ? 0.15
            : charCount < 1000
              ? 0.20
              : 0.30;
  score += richness;

  // --- Factor 3: Page content quality for browser events (0–0.35) ---
  // This is the key factor: evaluate the actual page content
  if (event.sourceType === 'activitywatch-browser') {
    const pageQualityScore = evaluatePageContentQuality(event);
    score += pageQualityScore;
  }

  // --- Factor 4: URL with title bonus (0 or 0.10) ---
  // Browser event with both URL and title indicates meaningful navigation
  if (
    event.sourceType === 'activitywatch-browser' &&
    typeof event.content.url === 'string' &&
    event.content.url.length > 0 &&
    typeof event.content.title === 'string' &&
    event.content.title.length > 10
  ) {
    score += 0.10;
  }

  // --- Factor 5: Page role importance (0–0.15) ---
  // Issue/PR/docs/debug pages are more important than search/chat
  const role = inferPageRole(event);
  const roleWeight =
    role === 'issue' || role === 'pull-request' || role === 'debug'
      ? 0.15
      : role === 'docs' || role === 'reference'
        ? 0.12
        : role === 'repository'
          ? 0.08
          : 0.0;
  score += roleWeight;

  // --- Factor 6: Multiple access bonus (0–0.10) ---
  // Repeated access suggests sustained interest
  const accessTimes = event.content.accessTimes;
  if (Array.isArray(accessTimes) && accessTimes.length > 1) {
    const bonus = Math.min(accessTimes.length * 0.03, 0.10);
    score += bonus;
  }

  return Math.min(score, 1.0);
}

/**
 * Check if a memory event should be completely filtered out due to very low quality.
 * This is a secondary check after importance scoring.
 */
function isVeryLowQuality(scored: ScoredMemoryEvent): boolean {
  // Browser events with junk page content get penalty scores
  // If total score < 0.25, it means the page is junk even after all bonuses
  if (scored.event.sourceType === 'activitywatch-browser' && scored.importance < 0.25) {
    return true;
  }

  return false;
}

/**
 * Get human-readable reasons for the importance score.
 */
function getImportanceReasons(event: MemoryEvent): string[] {
  const reasons: string[] = [];

  const role = inferPageRole(event);
  if (role === 'issue' || role === 'pull-request' || role === 'debug') {
    reasons.push(`Primary development activity (${role})`);
  } else if (role === 'docs' || role === 'reference') {
    reasons.push('Knowledge gathering activity');
  }

  const text = getEventText(event);
  if (text && text.length > 400) {
    reasons.push('Rich content (400+ chars)');
  }

  // Page content quality reasons
  if (event.sourceType === 'activitywatch-browser') {
    const pageText = getPageTextContent(event);
    if (pageText) {
      if (pageText.length > 500) {
        reasons.push('Substantial page content (500+ chars)');
      }

      // Check for valuable content patterns
      if (hasValuableContentPatterns(pageText)) {
        reasons.push('Contains technical/informational content');
      }
    }
  }

  const accessTimes = event.content.accessTimes;
  if (Array.isArray(accessTimes) && accessTimes.length > 2) {
    reasons.push(`Repeated access (${accessTimes.length} times)`);
  }

  if (reasons.length === 0) {
    reasons.push('General browsing activity');
  }

  return reasons;
}

/**
 * Evaluate page content quality for browser events (0–0.35 or -0.20).
 * This is critical for filtering out low-value pages.
 * Returns negative score for junk pages to penalize them heavily.
 */
function evaluatePageContentQuality(event: MemoryEvent): number {
  const pageText = getPageTextContent(event);

  // No page text available - rely on URL/title only
  if (!pageText || pageText.trim().length === 0) {
    return 0.0;
  }

  const trimmedText = pageText.trim();
  const charCount = trimmedText.length;

  // --- Filter 1: Minimum page text length ---
  // Pages with < 100 chars of content are likely navigation/error/placeholder pages
  if (charCount < MIN_PAGE_TEXT_LENGTH) {
    // Heavy penalty for too-short page content
    return -0.20;
  }

  // --- Filter 2: Junk page patterns ---
  if (isJunkPageContent(trimmedText)) {
    // Heavy penalty for junk page patterns
    return -0.20;
  }

  // --- Quality scoring ---
  // Base quality score based on content length
  let qualityScore =
    charCount < 200
      ? 0.05
      : charCount < 500
        ? 0.10
        : charCount < 1000
          ? 0.18
          : charCount < 2000
            ? 0.25
            : 0.30;

  // Bonus for valuable content patterns (technical, informational)
  if (hasValuableContentPatterns(trimmedText)) {
    qualityScore += 0.05;
  }

  return Math.min(qualityScore, 0.35);
}

/**
 * Get page text content from a browser memory event.
 */
function getPageTextContent(event: MemoryEvent): string | null {
  // Try multiple sources for page text content
  const candidates: string[] = [];

  // 1. Direct text field (from page content fetcher)
  if (typeof event.content.text === 'string') {
    candidates.push(event.content.text);
  }

  // 2. pageTitle field (sometimes contains extracted content)
  if (typeof event.content.pageTitle === 'string') {
    candidates.push(event.content.pageTitle);
  }

  // 3. pageText field (alternative naming)
  if (typeof event.content.pageText === 'string') {
    candidates.push(event.content.pageText);
  }

  // Merge candidates, preferring the longest one
  const validCandidates = candidates.filter((c) => c.trim().length > 0);
  if (validCandidates.length === 0) {
    return null;
  }

  // Return the longest candidate (most likely to be the full page content)
  return validCandidates.reduce((longest, current) =>
    current.length > longest.length ? current : longest,
  );
}

/**
 * Check if page content matches junk patterns (navigation, error, placeholder pages).
 */
function isJunkPageContent(text: string): boolean {
  const normalized = text.toLowerCase().trim();

  // Error/placeholder pages
  const errorPatterns = [
    '404 not found',
    'page not found',
    'error',
    'oops',
    'something went wrong',
    'loading...',
    'please wait',
    'access denied',
    'unauthorized',
    'login required',
    'sign in to continue',
  ];

  for (const pattern of errorPatterns) {
    if (normalized.includes(pattern) && text.length < 200) {
      return true;
    }
  }

  // Navigation/menu-only pages (short text, high link density)
  // Detected by: short text + many "click", "here", "go" type words
  const navigationIndicators = ['click here', 'learn more', 'see more', 'read more', 'go to'];
  const navCount = navigationIndicators.filter((phrase) => normalized.includes(phrase)).length;
  if (navCount >= 3 && text.length < 150) {
    return true;
  }

  // Login/signup pages
  const authPatterns = ['sign up', 'log in', 'create account', 'register', 'forgot password'];
  if (authPatterns.some((pattern) => normalized.includes(pattern)) && text.length < 100) {
    return true;
  }

  // Cookie/consent banners (very short, legal-sounding)
  if (
    normalized.includes('cookie') &&
    normalized.includes('accept') &&
    text.length < 80
  ) {
    return true;
  }

  return false;
}

/**
 * Check if page content contains valuable technical/informational patterns.
 */
function hasValuableContentPatterns(text: string): boolean {
  const normalized = text.toLowerCase();

  // Technical content patterns
  const technicalPatterns = [
    'api',
    'function',
    'method',
    'class',
    'interface',
    'implementation',
    'architecture',
    'design',
    'pattern',
    'algorithm',
    'data structure',
    'protocol',
    'format',
    'specification',
    'documentation',
    'tutorial',
    'guide',
    'example',
    'code',
    'script',
    'command',
    'configuration',
    'setup',
    'install',
    'deploy',
    'build',
    'test',
    'debug',
    'fix',
    'issue',
    'bug',
    'feature',
    'release',
    'version',
    'update',
    'change',
    'refactor',
    'optimize',
    'improve',
  ];

  // Check for at least 2 technical patterns (suggests substantive content)
  const matches = technicalPatterns.filter((pattern) => normalized.includes(pattern));
  return matches.length >= 2;
}

/**
 * Check if URL is skippable (localhost, debug URLs).
 */
function isSkippableBrowserPageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

/**
 * Deduplicate events that are too similar using N-gram Jaccard similarity.
 * Keeps the higher-scored event when two events are similar.
 * Input must be sorted by importance (descending).
 */
function deduplicateBySemanticSimilarity(
  items: ScoredMemoryEvent[],
): ScoredMemoryEvent[] {
  const kept: ScoredMemoryEvent[] = [];
  const keptNgrams: Set<string>[] = [];

  for (const scored of items) {
    const text = getEventText(scored.event);

    // Events without text (e.g., pure URL without title) — always keep
    if (!text || text.trim().length === 0) {
      kept.push(scored);
      keptNgrams.push(new Set());
      continue;
    }

    const ngrams = extractNgrams(text, NGRAM_SIZE);

    // Check similarity against all kept items
    const isSimilar = keptNgrams.some(
      (existing) =>
        existing.size > 0 && jaccardSimilarity(ngrams, existing) > SIMILARITY_THRESHOLD,
    );

    if (!isSimilar) {
      keptNgrams.push(ngrams);
      kept.push(scored);
    }
  }

  return kept;
}

/**
 * Balance source types and cap to max_events.
 * Ensures each source type gets fair representation:
 * - At least 30% of slots for each present source type (if available)
 * - Remaining slots filled by highest importance regardless of source
 */
function balanceAndCapBySourceType(
  items: ScoredMemoryEvent[],
  maxEvents: number,
): ScoredMemoryEvent[] {
  if (items.length <= maxEvents) {
    return items;
  }

  // Group by source type
  const bySourceType = new Map<string, ScoredMemoryEvent[]>();
  for (const scored of items) {
    const source = scored.event.sourceType;
    const group = bySourceType.get(source) ?? [];
    group.push(scored);
    bySourceType.set(source, group);
  }

  const sourceCount = bySourceType.size;
  // Each source gets at least 30% of max_events (if they have enough items)
  const minPerSource = Math.floor(maxEvents / sourceCount * 0.3);

  const result: ScoredMemoryEvent[] = [];
  const overflow: ScoredMemoryEvent[] = [];

  // Take guaranteed slots per source type
  for (const [, sourceItems] of bySourceType) {
    // Items are already sorted by importance within the full list
    sourceItems.sort((a, b) => b.importance - a.importance);
    const take = Math.min(minPerSource, sourceItems.length);
    result.push(...sourceItems.slice(0, take));
    overflow.push(...sourceItems.slice(take));
  }

  // Sort overflow by importance and fill remaining slots
  overflow.sort((a, b) => b.importance - a.importance);
  const remainingSlots = maxEvents - result.length;
  result.push(...overflow.slice(0, remainingSlots));

  // Final sort by importance
  result.sort((a, b) => b.importance - a.importance);

  return result;
}

/**
 * Extract text content from a memory event for evaluation.
 */
function getEventText(event: MemoryEvent): string | null {
  const parts: string[] = [];

  if (typeof event.content.title === 'string') {
    parts.push(event.content.title);
  }

  if (typeof event.content.pageTitle === 'string') {
    parts.push(event.content.pageTitle);
  }

  if (typeof event.content.pageText === 'string') {
    // Limit page text to avoid overwhelming similarity comparison
    parts.push(event.content.pageText.slice(0, 500));
  }

  if (typeof event.content.url === 'string') {
    // URL contributes less to text semantics
    parts.push(event.content.url);
  }

  return parts.join(' ').trim() || null;
}

/**
 * Infer page role from URL and title.
 * Same logic as memory-review module.
 */
type PageRole =
  | 'search'
  | 'chat'
  | 'issue'
  | 'pull-request'
  | 'repository'
  | 'docs'
  | 'debug'
  | 'reference'
  | 'shopping'
  | 'entertainment'
  | 'learning'
  | 'reading'
  | 'web';

function inferPageRole(event: MemoryEvent): PageRole {
  const url = (typeof event.content.url === 'string' ? event.content.url : '') ?? '';
  const title = (typeof event.content.title === 'string' ? event.content.title : '') ?? '';
  const normalized = `${url.toLowerCase()} ${title.toLowerCase()}`;

  if (normalized.includes('/search?') || normalized.includes('google search')) {
    return 'search';
  }

  if (normalized.includes('chatgpt.com/') || normalized.includes(' claude ') || normalized.includes('/c/')) {
    return 'chat';
  }

  if (normalized.includes('/issues/')) {
    return 'issue';
  }

  if (normalized.includes('/pull/')) {
    return 'pull-request';
  }

  if (normalized.includes('docs.') || normalized.includes('/docs/') || normalized.includes('guide')) {
    return 'docs';
  }

  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    return 'debug';
  }

  if (normalized.includes('github.com/') && !normalized.includes('/issues/') && !normalized.includes('/pull/')) {
    return 'repository';
  }

  if (normalized.includes('/reference/')) {
    return 'reference';
  }

  if (normalized.includes('amazon') || normalized.includes('shop') || normalized.includes('cart')) {
    return 'shopping';
  }

  if (normalized.includes('music') || normalized.includes('video') || normalized.includes('movie')) {
    return 'entertainment';
  }

  if (normalized.includes('course') || normalized.includes('tutorial') || normalized.includes('learn')) {
    return 'learning';
  }

  if (normalized.includes('arxiv') || normalized.includes('paper') || normalized.includes('article')) {
    return 'reading';
  }

  return 'web';
}

/**
 * Heuristic: does this text look like code, a file path, or a shell command?
 */
function looksLikeCodeOrPath(text: string): boolean {
  const trimmed = text.trim();

  // File paths (Unix or Windows)
  if (
    trimmed.startsWith('/') &&
    trimmed.includes('/') &&
    !trimmed.includes(' ') &&
    trimmed.length < 300
  ) {
    return true;
  }
  if (trimmed.includes(':\\') || trimmed.includes('C:/')) {
    return true;
  }

  // Shell commands: common prefixes
  const cmdPrefixes = [
    'cd ',
    'ls ',
    'rm ',
    'cp ',
    'mv ',
    'mkdir ',
    'chmod ',
    'chown ',
    'sudo ',
    'npm ',
    'npx ',
    'yarn ',
    'pnpm ',
    'cargo ',
    'git ',
    'docker ',
    'brew ',
    'pip ',
    'python ',
    'node ',
    'curl ',
    'wget ',
    'ssh ',
    'scp ',
  ];
  const lower = trimmed.toLowerCase();
  for (const prefix of cmdPrefixes) {
    if (lower.startsWith(prefix) && !trimmed.includes('\n')) {
      return true;
    }
  }

  // Code patterns: high density of code-specific characters
  const codeChars = ['{', '}', '(', ')', ';', '=', '<', '>', '|', '&'];
  const totalChars = trimmed.length;
  if (totalChars > 0) {
    const codeCharCount = codeChars.filter((c) => trimmed.includes(c)).length;
    const ratio = codeCharCount / totalChars;
    // If more than 15% of characters are code-specific, likely code
    if (ratio > 0.15 && totalChars < 500) {
      return true;
    }
  }

  // Import / require statements
  if (trimmed.startsWith('import ') || (trimmed.startsWith('from ') && trimmed.includes('import'))) {
    return true;
  }
  if (
    (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) &&
    trimmed.includes('=')
  ) {
    return true;
  }
  if (trimmed.startsWith('fn ') || trimmed.startsWith('pub fn ') || trimmed.startsWith('def ')) {
    return true;
  }

  return false;
}

/**
 * Extract character N-grams from text for similarity comparison.
 */
function extractNgrams(text: string, n: number): Set<string> {
  const chars = text
    .toLowerCase()
    .split('')
    .filter((c) => !/\s/.test(c));

  if (chars.length < n) {
    return new Set([chars.join('')]);
  }

  const ngrams: string[] = [];
  for (let i = 0; i <= chars.length - n; i++) {
    ngrams.push(chars.slice(i, i + n).join(''));
  }

  return new Set(ngrams);
}

/**
 * Jaccard similarity between two sets (0.0–1.0).
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1.0;
  }

  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;

  return union === 0 ? 0.0 : intersection / union;
}