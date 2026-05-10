/**
 * Knowledge Graph Types
 *
 * Defines the data structures for the knowledge relation graph.
 * Adapted from pulseOS-lite's graph types for MirrorBrain's knowledge artifacts.
 */

/**
 * Node types in the knowledge graph
 *
 * - topic: A topic aggregation point (topicKey)
 * - knowledge-artifact: An individual knowledge artifact version
 */
export type KnowledgeGraphNodeType = 'topic' | 'knowledge-artifact';

/**
 * Edge types in the knowledge graph
 *
 * - CONTAINS: Topic contains artifact (hierarchical)
 * - REFERENCES: Wikilink reference from one topic to another (explicit)
 * - SIMILAR: TF-IDF similarity relation between topics (computed)
 */
export type KnowledgeGraphEdgeType = 'CONTAINS' | 'REFERENCES' | 'SIMILAR';

/**
 * A node in the knowledge graph
 *
 * Represents either a topic (topicKey) or an individual knowledge artifact.
 */
export interface KnowledgeGraphNode {
  /** Unique identifier: "topic:topicKey" or "artifact:artifactId" */
  id: string;

  /** Node type */
  type: KnowledgeGraphNodeType;

  /** Display label (title or topicKey) */
  label: string;

  /** Associated topicKey for this node */
  topicKey: string;

  /** Additional properties */
  properties: {
    artifactId?: string;
    title?: string;
    summary?: string;
    version?: number;
    isCurrentBest?: boolean;
    updatedAt?: string;
    tags?: string[];
  };
}

/**
 * An edge in the knowledge graph
 *
 * Represents a relationship between two nodes.
 */
export interface KnowledgeGraphEdge {
  /** Unique edge identifier */
  id: string;

  /** Edge type */
  type: KnowledgeGraphEdgeType;

  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Display label */
  label: string;

  /** Additional properties */
  properties: {
    /** Similarity score for SIMILAR edges */
    similarity?: number;
  };
}

/**
 * Snapshot of the knowledge graph at a point in time
 *
 * Contains all nodes, edges, and statistics for visualization.
 */
export interface KnowledgeGraphSnapshot {
  /** Timestamp when snapshot was generated */
  generatedAt: string;

  /** Statistics about the graph */
  stats: {
    /** Number of topic nodes */
    topics: number;

    /** Number of artifact nodes */
    knowledgeArtifacts: number;

    /** Number of wikilink reference edges */
    wikilinkReferences: number;

    /** Number of TF-IDF similarity edges */
    similarityRelations: number;
  };

  /** All nodes in the graph */
  nodes: KnowledgeGraphNode[];

  /** All edges in the graph */
  edges: KnowledgeGraphEdge[];
}

/**
 * Options for building the knowledge graph
 */
export interface BuildGraphOptions {
  /** Include TF-IDF similarity relations (default: true) */
  includeSimilarityRelations?: boolean;

  /** Minimum similarity threshold for SIMILAR edges (default: 0.3) */
  similarityThreshold?: number;

  /** Maximum similar neighbors per topic (default: 5) */
  topKSimilar?: number;
}