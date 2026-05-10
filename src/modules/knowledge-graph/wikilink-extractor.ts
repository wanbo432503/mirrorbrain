/**
 * Wikilink Extractor
 *
 * Extracts Obsidian-style wikilinks from markdown content.
 *
 * Wikilink syntax:
 * - [[topicKey]] - simple link
 * - [[topicKey|displayText]] - link with alias
 */

/**
 * A wikilink reference extracted from markdown content
 */
export interface WikilinkReference {
  /** Target topic key (the link destination) */
  targetTopicKey: string;

  /** Display text/alias if specified (null for simple links) */
  displayText: string | null;

  /** Position in the source content */
  position: {
    start: number;
    end: number;
  };
}

/**
 * Regex pattern for Obsidian-style wikilinks
 *
 * Matches:
 * - [[topicKey]]
 * - [[topicKey|displayText]]
 *
 * Groups:
 * - Group 1: topicKey
 * - Group 2: displayText (optional)
 */
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extract wikilinks from markdown content
 *
 * @param content - Markdown body containing wikilinks
 * @returns Array of extracted wikilink references
 *
 * @example
 * ```typescript
 * const content = "See [[example-topic]] for details. Also check [[other|Alternative]].";
 * const links = extractWikilinks(content);
 * // [
 * //   { targetTopicKey: "example-topic", displayText: null, position: { start: 4, end: 20 } },
 * //   { targetTopicKey: "other", displayText: "Alternative", position: { start: 42, end: 61 } }
 * // ]
 * ```
 */
export function extractWikilinks(content: string): WikilinkReference[] {
  const links: WikilinkReference[] = [];

  // Reset regex state for reuse
  WIKILINK_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = WIKILINK_PATTERN.exec(content)) !== null) {
    const targetTopicKey = match[1]?.trim() ?? '';
    const displayText = match[2]?.trim() ?? null;

    // Skip empty topic keys
    if (targetTopicKey.length === 0) {
      continue;
    }

    links.push({
      targetTopicKey,
      displayText,
      position: {
        start: match.index,
        end: match.index + match[0].length,
      },
    });
  }

  return links;
}

/**
 * Get unique topic keys from a list of wikilinks
 *
 * @param links - Array of wikilink references
 * @returns Set of unique target topic keys
 */
export function getUniqueTopicKeys(links: WikilinkReference[]): Set<string> {
  return new Set(links.map((link) => link.targetTopicKey));
}