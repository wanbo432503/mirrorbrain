import type { KnowledgeArtifact } from '../../shared/types/index.js';

/**
 * Calculate IDF (Inverse Document Frequency) weights for vocabulary tags
 *
 * IDF formula: ln((N + 1) / (df + 1))
 * - N: total number of artifacts
 * - df: document frequency (number of artifacts containing the tag)
 *
 * Rare tags get higher IDF weight, common tags get lower weight
 */
export function calculateIDFWeights(
  vocabulary: string[],
  artifacts: KnowledgeArtifact[],
): Map<string, number> {
  const idfWeights = new Map<string, number>();
  const N = artifacts.length;

  // Count document frequency for each tag
  const documentFrequency = new Map<string, number>();

  for (const tag of vocabulary) {
    let df = 0;

    for (const artifact of artifacts) {
      const artifactTags = artifact.tags ?? [];
      if (artifactTags.includes(tag)) {
        df++;
      }
    }

    documentFrequency.set(tag, df);
  }

  // Calculate IDF weight for each tag
  for (const tag of vocabulary) {
    const df = documentFrequency.get(tag) ?? 0;
    const idf = Math.log((N + 1) / (df + 1)) + 1;
    idfWeights.set(tag, idf);
  }

  return idfWeights;
}

/**
 * Calculate TF (Term Frequency) vector for a single artifact
 *
 * TF: count of tag occurrences in the artifact
 */
export function calculateTFVector(
  artifact: KnowledgeArtifact,
): Map<string, number> {
  const tfVector = new Map<string, number>();
  const artifactTags = artifact.tags ?? [];

  for (const tag of artifactTags) {
    const currentCount = tfVector.get(tag) ?? 0;
    tfVector.set(tag, currentCount + 1);
  }

  return tfVector;
}

/**
 * Build TF-IDF vector by multiplying TF and IDF weights
 *
 * TF-IDF: TF * IDF
 *
 * Only includes tags that are in the IDF weights map
 */
export function buildTFIDFVector(
  artifact: KnowledgeArtifact,
  idfWeights: Map<string, number>,
): Map<string, number> {
  const tfidfVector = new Map<string, number>();
  const tfVector = calculateTFVector(artifact);

  for (const [tag, tf] of tfVector.entries()) {
    const idf = idfWeights.get(tag);

    if (idf !== undefined) {
      const tfidf = tf * idf;
      tfidfVector.set(tag, tfidf);
    }
  }

  return tfidfVector;
}
