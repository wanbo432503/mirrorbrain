/**
 * Knowledge Graph Module
 *
 * Provides knowledge graph building and visualization support.
 *
 * Key components:
 * - Wikilink extraction: Parse [[topicKey]] syntax from markdown
 * - Graph builder: Combine wikilink references + TF-IDF similarity
 * - Types: Graph node and edge definitions
 */

export {
  extractWikilinks,
  getUniqueTopicKeys,
  type WikilinkReference,
} from './wikilink-extractor.js';

export {
  buildKnowledgeGraphSnapshot,
} from './graph-builder.js';

export {
  type KnowledgeGraphNodeType,
  type KnowledgeGraphEdgeType,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
  type KnowledgeGraphSnapshot,
  type BuildGraphOptions,
} from './types.js';