/**
 * Knowledge Graph Builder
 *
 * Builds a graph snapshot from knowledge artifacts by:
 * 1. Creating topic nodes from topicKey aggregation
 * 2. Creating artifact nodes linked to topics
 * 3. Extracting wikilinks to create REFERENCES edges
 * 4. Computing TF-IDF similarity to create SIMILAR edges
 */

import type { KnowledgeArtifact } from '../../shared/types/index.js';
import { buildKnowledgeRelationGraph } from '../knowledge-relation-network/index.js';
import { extractWikilinks } from './wikilink-extractor.js';
import type {
  KnowledgeGraphSnapshot,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  BuildGraphOptions,
  KnowledgeGraphNodeType,
  KnowledgeGraphEdgeType,
} from './types.js';

/**
 * Build a knowledge graph snapshot from artifacts
 *
 * @param artifacts - Knowledge artifacts to build graph from
 * @param options - Graph building options
 * @returns Graph snapshot with nodes, edges, and statistics
 */
export function buildKnowledgeGraphSnapshot(
  artifacts: KnowledgeArtifact[],
  options?: BuildGraphOptions,
): KnowledgeGraphSnapshot {
  const includeSimilarity = options?.includeSimilarityRelations ?? true;
  const similarityThreshold = options?.similarityThreshold ?? 0.3;
  const topKSimilar = options?.topKSimilar ?? 5;

  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];

  // Handle empty artifacts
  if (artifacts.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      stats: {
        topics: 0,
        knowledgeArtifacts: 0,
        wikilinkReferences: 0,
        similarityRelations: 0,
      },
      nodes,
      edges,
    };
  }

  // Step 1: Group artifacts by topicKey
  const topicKeyToArtifacts = new Map<string, KnowledgeArtifact[]>();
  const artifactIdToTopicKey = new Map<string, string>();

  for (const artifact of artifacts) {
    const topicKey = artifact.topicKey;
    if (!topicKey) {
      // Skip artifacts without topicKey (they don't participate in graph)
      continue;
    }

    artifactIdToTopicKey.set(artifact.id, topicKey);

    const list = topicKeyToArtifacts.get(topicKey) ?? [];
    list.push(artifact);
    topicKeyToArtifacts.set(topicKey, list);
  }

  // Step 2: Create topic nodes
  for (const [topicKey, topicArtifacts] of topicKeyToArtifacts) {
    // Find current best artifact for topic metadata
    const currentBest = topicArtifacts.find((a) => a.isCurrentBest) ?? topicArtifacts[0];

    nodes.push({
      id: buildTopicNodeId(topicKey),
      type: 'topic' as KnowledgeGraphNodeType,
      label: currentBest.title ?? topicKey,
      topicKey,
      properties: {
        artifactId: currentBest.id,
        title: currentBest.title,
        summary: currentBest.summary,
        updatedAt: currentBest.updatedAt,
      },
    });

    // Step 3: Create artifact nodes linked to topic
    for (const artifact of topicArtifacts) {
      nodes.push({
        id: buildArtifactNodeId(artifact.id),
        type: 'knowledge-artifact' as KnowledgeGraphNodeType,
        label: `${artifact.title ?? artifact.id} (v${artifact.version ?? 1})`,
        topicKey,
        properties: {
          artifactId: artifact.id,
          version: artifact.version,
          isCurrentBest: artifact.isCurrentBest,
          tags: artifact.tags,
        },
      });

      // CONTAINS edge: topic -> artifact
      edges.push({
        id: buildEdgeId('CONTAINS', topicKey, artifact.id),
        type: 'CONTAINS' as KnowledgeGraphEdgeType,
        source: buildTopicNodeId(topicKey),
        target: buildArtifactNodeId(artifact.id),
        label: 'contains',
        properties: {},
      });
    }
  }

  // Step 4: Extract wikilinks and create REFERENCES edges (topic-to-topic)
  const addedReferenceEdges = new Set<string>();

  for (const artifact of artifacts) {
    if (!artifact.body || !artifact.topicKey) {
      continue;
    }

    const wikilinks = extractWikilinks(artifact.body);

    for (const link of wikilinks) {
      const targetTopicKey = link.targetTopicKey;

      // Skip if target doesn't exist in our topics
      if (!topicKeyToArtifacts.has(targetTopicKey)) {
        continue;
      }

      // Skip self-references
      if (targetTopicKey === artifact.topicKey) {
        continue;
      }

      // Deduplicate edges (multiple artifacts may have same reference)
      const edgeId = buildEdgeId('REFERENCES', artifact.topicKey, targetTopicKey);
      if (addedReferenceEdges.has(edgeId)) {
        continue;
      }
      addedReferenceEdges.add(edgeId);

      edges.push({
        id: edgeId,
        type: 'REFERENCES' as KnowledgeGraphEdgeType,
        source: buildTopicNodeId(artifact.topicKey),
        target: buildTopicNodeId(targetTopicKey),
        label: 'references',
        properties: {},
      });
    }
  }

  // Step 5: Add TF-IDF similarity edges (topic-to-topic)
  let similarityEdgeCount = 0;

  if (includeSimilarity) {
    const relationGraph = buildKnowledgeRelationGraph(artifacts, {
      topK: topKSimilar,
      threshold: similarityThreshold,
    });

    const addedSimilarEdges = new Set<string>();

    for (const [sourceId, similarInfo] of relationGraph) {
      const sourceTopicKey = artifactIdToTopicKey.get(sourceId);
      if (!sourceTopicKey) {
        continue;
      }

      // relationGraph returns string[] of related artifact IDs
      // We need to map these to topic keys
      for (const targetId of similarInfo) {
        const targetTopicKey = artifactIdToTopicKey.get(targetId);
        if (!targetTopicKey) {
          continue;
        }

        // Skip self-similarity
        if (targetTopicKey === sourceTopicKey) {
          continue;
        }

        // Deduplicate edges
        const edgeId = buildEdgeId('SIMILAR', sourceTopicKey, targetTopicKey);
        const reverseEdgeId = buildEdgeId('SIMILAR', targetTopicKey, sourceTopicKey);
        if (addedSimilarEdges.has(edgeId) || addedSimilarEdges.has(reverseEdgeId)) {
          continue;
        }
        addedSimilarEdges.add(edgeId);

        edges.push({
          id: edgeId,
          type: 'SIMILAR' as KnowledgeGraphEdgeType,
          source: buildTopicNodeId(sourceTopicKey),
          target: buildTopicNodeId(targetTopicKey),
          label: 'similar',
          properties: {
            // Note: actual similarity value would need modification to relation-graph-builder
            similarity: undefined,
          },
        });

        similarityEdgeCount++;
      }
    }
  }

  // Step 6: Compute statistics
  const topicNodes = nodes.filter((n) => n.type === 'topic');
  const artifactNodes = nodes.filter((n) => n.type === 'knowledge-artifact');
  const referenceEdges = edges.filter((e) => e.type === 'REFERENCES');

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      topics: topicNodes.length,
      knowledgeArtifacts: artifactNodes.length,
      wikilinkReferences: referenceEdges.length,
      similarityRelations: similarityEdgeCount,
    },
    nodes,
    edges,
  };
}

/**
 * Build a topic node ID
 */
function buildTopicNodeId(topicKey: string): string {
  return `topic:${topicKey}`;
}

/**
 * Build an artifact node ID
 */
function buildArtifactNodeId(artifactId: string): string {
  return `artifact:${artifactId}`;
}

/**
 * Build an edge ID from type and source/target
 */
function buildEdgeId(
  type: KnowledgeGraphEdgeType,
  sourceKey: string,
  targetKey: string,
): string {
  return `${type.toLowerCase()}:${sourceKey}->${targetKey}`;
}