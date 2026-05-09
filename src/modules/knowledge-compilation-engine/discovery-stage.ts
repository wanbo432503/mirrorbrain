import type { ReviewedMemory } from '../../shared/types/index.js';
import { extractTags } from './tag-extraction.js';

export interface DiscoveryResult {
  primaryTopic: string | undefined;
  supportingThemes: string[];
  tags: string[];
  discoveryInsights: string[];
  patterns: string[];
}

interface DiscoveryOptions {
  maxThemes?: number;
  maxPatterns?: number;
}

/**
 * Identify primary topic from tags
 *
 * Primary topic is the most frequent tag
 */
export function identifyPrimaryTopic(tags: string[]): string | undefined {
  if (tags.length === 0) {
    return undefined;
  }

  // Count tag frequency
  const tagFrequency = new Map<string, number>();

  for (const tag of tags) {
    const currentCount = tagFrequency.get(tag) ?? 0;
    tagFrequency.set(tag, currentCount + 1);
  }

  // Find most frequent tag
  let maxFrequency = 0;
  let primaryTopic: string | undefined;

  for (const [tag, frequency] of tagFrequency.entries()) {
    if (frequency > maxFrequency) {
      maxFrequency = frequency;
      primaryTopic = tag;
    }
  }

  return primaryTopic;
}

/**
 * Identify supporting themes from tags
 *
 * Supporting themes are secondary tags (excluding primary topic)
 * Sorted by frequency, limited to maxThemes
 */
export function identifySupportingThemes(
  tags: string[],
  primaryTopic: string | undefined,
  options?: DiscoveryOptions,
): string[] {
  const maxThemes = options?.maxThemes ?? 5;

  if (tags.length === 0 || !primaryTopic) {
    return [];
  }

  // Count tag frequency (excluding primary topic)
  const tagFrequency = new Map<string, number>();

  for (const tag of tags) {
    if (tag === primaryTopic) {
      continue;
    }

    const currentCount = tagFrequency.get(tag) ?? 0;
    tagFrequency.set(tag, currentCount + 1);
  }

  // Sort by frequency descending
  const sortedTags = Array.from(tagFrequency.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([tag]) => tag);

  // Limit to maxThemes
  return sortedTags.slice(0, maxThemes);
}

/**
 * Extract patterns from reviewed memories
 *
 * Patterns are recurring themes or workflows detected in memory titles and summaries
 * Simplified heuristic approach: detect repeated keywords across memories
 */
export function extractPatternsFromMemories(
  memories: ReviewedMemory[],
  options?: DiscoveryOptions,
): string[] {
  const maxPatterns = options?.maxPatterns ?? 5;

  if (memories.length === 0) {
    return [];
  }

  // Extract all tags from titles and summaries
  const allTags: string[] = [];

  for (const memory of memories) {
    const titleTags = extractTags(memory.candidateTitle);
    const summaryTags = extractTags(memory.candidateSummary);

    allTags.push(...titleTags, ...summaryTags);
  }

  // Count tag frequency
  const tagFrequency = new Map<string, number>();

  for (const tag of allTags) {
    const currentCount = tagFrequency.get(tag) ?? 0;
    tagFrequency.set(tag, currentCount + 1);
  }

  // Tags appearing in multiple memories suggest patterns
  const patterns: string[] = [];

  for (const [tag, frequency] of tagFrequency.entries()) {
    if (frequency >= 2) {
      patterns.push(`recurring ${tag} activity`);
    }
  }

  // Limit to maxPatterns
  return patterns.slice(0, maxPatterns);
}

/**
 * Run discovery stage
 *
 * Analyzes reviewed memories and generates discovery insights for compilation
 *
 * Process:
 * 1. Extract tags from all memories (titles + summaries)
 * 2. Identify primary topic (most frequent tag)
 * 3. Identify supporting themes (secondary tags)
 * 4. Extract patterns (recurring themes/workflows)
 * 5. Generate discovery insights (structured summary)
 */
export function runDiscoveryStage(
  memories: ReviewedMemory[],
  options?: DiscoveryOptions,
): DiscoveryResult {
  if (memories.length === 0) {
    return {
      primaryTopic: undefined,
      supportingThemes: [],
      tags: [],
      discoveryInsights: [],
      patterns: [],
    };
  }

  // Extract all tags from titles and summaries
  const allTags: string[] = [];

  for (const memory of memories) {
    const titleTags = extractTags(memory.candidateTitle);
    const summaryTags = extractTags(memory.candidateSummary);

    allTags.push(...titleTags, ...summaryTags);
  }

  // Identify primary topic
  const primaryTopic = identifyPrimaryTopic(allTags);

  // Identify supporting themes
  const supportingThemes = identifySupportingThemes(allTags, primaryTopic, options);

  // Extract patterns
  const patterns = extractPatternsFromMemories(memories, options);

  // Generate discovery insights
  const discoveryInsights: string[] = [];

  if (primaryTopic) {
    discoveryInsights.push(`Primary focus: ${primaryTopic}`);
  }

  if (supportingThemes.length > 0) {
    discoveryInsights.push(`Supporting themes: ${supportingThemes.join(', ')}`);
  }

  if (patterns.length > 0) {
    discoveryInsights.push(`Detected patterns: ${patterns.join(', ')}`);
  }

  discoveryInsights.push(`Analyzed ${memories.length} reviewed memories`);

  return {
    primaryTopic,
    supportingThemes,
    tags: allTags,
    discoveryInsights,
    patterns,
  };
}
