import type { ReviewedMemory, KnowledgeArtifact } from '../../shared/types/index.js';
import type { DiscoveryResult } from './discovery-stage.js';
import { extractTags } from './tag-extraction.js';

interface ExecuteResult {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  sourceReviewedMemoryIds: string[];
  timeRange: {
    startAt: string;
    endAt: string;
  };
  compilationMetadata: {
    discoveryInsights: string[];
    generationMethod: 'two-stage-compilation';
    discoveryStageCompletedAt?: string;
    executeStageCompletedAt: string;
  };
}

/**
 * Format wiki-link syntax for topic key
 *
 * Format: [[topic-key]]
 */
export function formatWikiLink(topicKey: string): string {
  if (!topicKey || topicKey.trim().length === 0) {
    return '';
  }

  return `[[${topicKey}]]`;
}

/**
 * Generate knowledge title from discovery result
 *
 * Title format: "{Primary Topic} - {Supporting Themes}"
 */
export function generateKnowledgeTitle(discovery: DiscoveryResult): string {
  if (!discovery.primaryTopic) {
    return 'General Knowledge';
  }

  const parts: string[] = [discovery.primaryTopic];

  if (discovery.supportingThemes.length > 0) {
    const topThemes = discovery.supportingThemes.slice(0, 2);
    parts.push(...topThemes);
  }

  return parts.join(' - ');
}

/**
 * Generate knowledge summary from discovery insights
 *
 * Summary captures primary focus, supporting themes, and patterns
 */
export function generateKnowledgeSummary(discovery: DiscoveryResult): string {
  const summaryParts: string[] = [];

  if (discovery.discoveryInsights.length > 0) {
    // Use first 2-3 discovery insights for summary
    const insights = discovery.discoveryInsights.slice(0, 3);
    summaryParts.push(...insights);
  } else {
    if (discovery.primaryTopic) {
      summaryParts.push(`Focus on ${discovery.primaryTopic}`);
    }

    if (discovery.supportingThemes.length > 0) {
      summaryParts.push(`Related themes: ${discovery.supportingThemes.join(', ')}`);
    }

    // Fallback for completely empty discovery
    if (summaryParts.length === 0) {
      summaryParts.push('General knowledge artifact');
    }
  }

  return summaryParts.join('. ');
}

/**
 * Generate knowledge body with wiki-links
 *
 * Body structure:
 * - Overview section
 * - Key topics with wiki-links
 * - Source activity summary
 */
export function generateKnowledgeBody(
  discovery: DiscoveryResult,
  memories: ReviewedMemory[],
): string {
  const bodySections: string[] = [];

  // Overview section
  bodySections.push('## Overview');

  if (discovery.primaryTopic) {
    const wikiLink = formatWikiLink(discovery.primaryTopic);
    bodySections.push(`This knowledge focuses on ${wikiLink}.`);
  }

  if (discovery.supportingThemes.length > 0) {
    const themeLinks = discovery.supportingThemes.map((theme) => formatWikiLink(theme));
    bodySections.push(`\nRelated topics: ${themeLinks.join(', ')}.`);
  }

  // Key topics section
  if (discovery.tags.length > 0) {
    bodySections.push('\n## Key Topics');

    const uniqueTags = Array.from(new Set(discovery.tags));
    const topTags = uniqueTags.slice(0, 10);

    const tagLinks = topTags.map((tag) => formatWikiLink(tag));
    bodySections.push(`Primary concepts: ${tagLinks.join(', ')}.`);
  }

  // Source activity summary
  if (memories.length > 0) {
    bodySections.push('\n## Source Activities');

    for (const memory of memories) {
      bodySections.push(`\n- ${memory.candidateTitle}`);
    }
  }

  return bodySections.join('\n');
}

/**
 * Calculate time range from reviewed memories
 *
 * Returns earliest and latest review timestamps
 */
function calculateTimeRange(memories: ReviewedMemory[]): { startAt: string; endAt: string } {
  if (memories.length === 0) {
    const now = new Date().toISOString();
    return { startAt: now, endAt: now };
  }

  const timestamps = memories.map((m) => m.reviewedAt).sort();

  const startAt = timestamps[0] ?? new Date().toISOString();
  const endAt = timestamps[timestamps.length - 1] ?? new Date().toISOString();

  return { startAt, endAt };
}

/**
 * Run execute stage
 *
 * Generates knowledge artifact from discovery insights and reviewed memories
 *
 * Process:
 * 1. Generate title from discovery
 * 2. Generate summary from insights
 * 3. Generate body with wiki-links
 * 4. Extract unique tags
 * 5. Link to source reviewed memories
 * 6. Calculate time range
 * 7. Set compilation metadata
 */
export function runExecuteStage(
  discovery: DiscoveryResult,
  memories: ReviewedMemory[],
): ExecuteResult {
  // Generate unique ID for knowledge artifact
  const id = `knowledge-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  // Generate title
  const title = generateKnowledgeTitle(discovery);

  // Generate summary
  const summary = generateKnowledgeSummary(discovery);

  // Generate body with wiki-links
  const body = generateKnowledgeBody(discovery, memories);

  // Extract unique tags
  const uniqueTags = Array.from(new Set(discovery.tags));

  // Link to source reviewed memories
  const sourceReviewedMemoryIds = memories.map((m) => m.id);

  // Calculate time range
  const timeRange = calculateTimeRange(memories);

  // Set compilation metadata
  const compilationMetadata = {
    discoveryInsights: discovery.discoveryInsights,
    generationMethod: 'two-stage-compilation' as const,
    discoveryStageCompletedAt: undefined, // Would be set by orchestration
    executeStageCompletedAt: new Date().toISOString(),
  };

  return {
    id,
    title,
    summary,
    body,
    tags: uniqueTags,
    sourceReviewedMemoryIds,
    timeRange,
    compilationMetadata,
  };
}