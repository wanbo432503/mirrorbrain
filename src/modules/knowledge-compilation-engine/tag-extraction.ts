/**
 * Tag Extraction Module
 *
 * Extracts strict noun-only tags from text for TF-IDF weighting.
 *
 * Rules:
 * - Noun-only: extract nouns, not verbs, adjectives, or adverbs
 * - Specific nouns: prefer specific technical/domain nouns (e.g., 'react', 'authentication')
 * - Blacklist generic terms: filter out vague, meta-level, or generic nouns (e.g., 'system', 'approach')
 * - Lowercase normalization: all tags normalized to lowercase
 * - No duplicates: remove duplicate tags
 */

/**
 * Blacklisted tags: generic, vague, meta-level terms that add no value to TF-IDF
 */
const BLACKLISTED_TAGS = new Set([
  // Meta-level nouns (but NOT 'component', 'function', 'feature' - specific in programming)
  'system',
  'systems',
  'approach',
  'approaches',
  'method',
  'methods',
  'process',
  'processes',
  'concept',
  'concepts',
  'idea',
  'ideas',
  'thing',
  'things',
  'item',
  'items',
  'aspect',
  'aspects',
  'factor',
  'factors',
  'element',
  'elements',
  'part',
  'parts',
  'activity',
  'activities',
  'action',
  'actions',
  'task',
  'tasks',
  'work',
  'works',
  'issue',
  'issues',

  // Vague nouns
  'stuff',
  'object',
  'objects',
  'data',
  'value',
  'values',
  'result',
  'results',
  'information',
  'content',
  'material',
  'materials',
  'resource',
  'resources',

  // Generic programming terms
  'code',
  'codes',
  'programming',
  'development',
  'software',
  'technology',
  'technologies',
  'application',
  'applications',
  'program',
  'programs',
  'implementation',
  'implementations',
  'solution',
  'solutions',

  // Additional vague terms
  'use',
  'uses',
  'usage',
]);

/**
 * Common English words to filter out
 */
const COMMON_WORDS = new Set([
  'this',
  'that',
  'these',
  'those',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'then',
  'else',
  'when',
  'where',
  'why',
  'how',
  'for',
  'to',
  'from',
  'in',
  'on',
  'at',
  'by',
  'with',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'again',
  'further',
  'once',
  'here',
  'there',
  'all',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
]);

/**
 * Check if a tag is blacklisted (generic or vague)
 */
export function isBlacklistedTag(tag: string): boolean {
  return BLACKLISTED_TAGS.has(tag.toLowerCase());
}

/**
 * Check if a tag is generic programming term
 */
export function isGenericTag(tag: string): boolean {
  const lowerTag = tag.toLowerCase();

  return (
    BLACKLISTED_TAGS.has(lowerTag) ||
    lowerTag.includes('code') ||
    lowerTag.includes('programming') ||
    lowerTag.includes('development') ||
    lowerTag.includes('software') ||
    lowerTag.includes('technology')
  );
}

/**
 * Simple noun detection heuristic
 *
 * Heuristic approach without full NLP library:
 * - Skip common English words (pronouns, articles, prepositions, etc.)
 * - Skip words that look like verbs (ending in -ed, -ly)
 * - Keep words that might be nouns (technical terms, domain nouns)
 * - Exception: keep words ending in -ing if they're common technical nouns (e.g., 'testing', 'caching')
 *
 * This is a simplified approach. In production, a proper NLP library would be better.
 */
function mightBeNoun(word: string): boolean {
  const lowerWord = word.toLowerCase();

  // Skip common words
  if (COMMON_WORDS.has(lowerWord)) {
    return false;
  }

  // Skip obvious verb forms (heuristic, but allow technical -ing nouns)
  if (lowerWord.endsWith('ed') || lowerWord.endsWith('ly')) {
    return false;
  }

  // Special handling for -ing words: keep common technical nouns
  const technicalIngNouns = new Set([
    'testing',
    'caching',
    'testing',
    'logging',
    'batching',
    'routing',
    'mapping',
    'sorting',
    'filtering',
    'tagging',
    'linking',
    'matching',
    'parsing',
    'indexing',
    'hashing',
    'encoding',
    'decoding',
    'rendering',
    'compiling',
    'building',
    'deployment',
    'monitoring',
  ]);

  if (lowerWord.endsWith('ing') && !technicalIngNouns.has(lowerWord)) {
    return false;
  }

  // Skip adjective forms
  if (lowerWord.endsWith('able') || lowerWord.endsWith('ible')) {
    return false;
  }

  // Skip very short words (likely articles or pronouns)
  if (lowerWord.length < 3) {
    return false;
  }

  // Assume remaining words might be nouns
  return true;
}

/**
 * Extract tags from text
 *
 * Process:
 * 1. Split text into words
 * 2. Filter candidate nouns (heuristic)
 * 3. Remove blacklisted generic tags
 * 4. Normalize to lowercase
 * 5. Remove duplicates
 */
export function extractTags(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split text into words, keeping hyphenated terms
  const words = text
    .toLowerCase()
    .split(/[^\w\-\/]+/)
    .filter((word) => word.length > 0);

  // Extract candidate nouns
  const candidateTags: string[] = [];

  for (const word of words) {
    const lowerWord = word.toLowerCase();

    // Skip if not a noun (heuristic)
    if (!mightBeNoun(lowerWord)) {
      continue;
    }

    // Skip if blacklisted
    if (isBlacklistedTag(lowerWord)) {
      continue;
    }

    candidateTags.push(lowerWord);
  }

  // Remove duplicates
  const uniqueTags = Array.from(new Set(candidateTags));

  return uniqueTags;
}