import type { KnowledgeArtifact } from '../../shared/types/index.js';
import { calculateIDFWeights, buildTFIDFVector } from './tfidf-calculator.js';
import { cosineSimilarity } from './cosine-similarity.js';

interface RelationGraphOptions {
  topK?: number;
  threshold?: number;
}

/**
 * Build knowledge relation graph using TF-IDF cosine similarity
 *
 * For each artifact:
 * 1. Build TF-IDF vector from its tags
 * 2. Compute similarity with all other artifacts
 * 3. Apply TOP_K constraint (max neighbors)
 * 4. Apply threshold constraint (min similarity)
 * 5. Store related knowledge IDs
 *
 * Default parameters:
 * - TOP_K: 5 (prevent super-nodes)
 * - threshold: 0.3 (filter weak edges)
 */
export function buildKnowledgeRelationGraph(
  artifacts: KnowledgeArtifact[],
  options?: RelationGraphOptions,
): Map<string, string[]> {
  const topK = options?.topK ?? 5;
  const threshold = options?.threshold ?? 0.3;

  const graph = new Map<string, string[]>();

  // Handle empty artifacts list
  if (artifacts.length === 0) {
    return graph;
  }

  // Build vocabulary from all artifact tags
  const vocabulary = new Set<string>();

  for (const artifact of artifacts) {
    const artifactTags = artifact.tags ?? [];

    for (const tag of artifactTags) {
      vocabulary.add(tag);
    }
  }

  const vocabularyArray = Array.from(vocabulary);

  // Calculate IDF weights across all artifacts
  const idfWeights = calculateIDFWeights(vocabularyArray, artifacts);

  // Build TF-IDF vectors for each artifact
  const tfidfVectors = new Map<string, Map<string, number>>();

  for (const artifact of artifacts) {
    const tfidfVector = buildTFIDFVector(artifact, idfWeights);
    tfidfVectors.set(artifact.id, tfidfVector);
  }

  // Compute similarity for each pair of artifacts
  for (const artifactA of artifacts) {
    const vecA = tfidfVectors.get(artifactA.id) ?? new Map<string, number>();
    const similarities: Array<{ id: string; similarity: number }> = [];

    for (const artifactB of artifacts) {
      // Skip self-comparison
      if (artifactA.id === artifactB.id) {
        continue;
      }

      const vecB = tfidfVectors.get(artifactB.id) ?? new Map<string, number>();
      const similarity = cosineSimilarity(vecA, vecB);

      // Apply threshold constraint
      if (similarity >= threshold) {
        similarities.push({ id: artifactB.id, similarity });
      }
    }

    // Sort by similarity descending
    similarities.sort((left, right) => right.similarity - left.similarity);

    // Apply TOP_K constraint
    const topRelations = similarities.slice(0, topK);
    const relatedIds = topRelations.map((item) => item.id);

    graph.set(artifactA.id, relatedIds);
  }

  return graph;
}