/**
 * Calculate cosine similarity between two TF-IDF vectors
 *
 * Cosine similarity formula: dot(A, B) / (||A|| * ||B||)
 * - dot(A, B): dot product (sum of A[tag] * B[tag] for common tags)
 * - ||A||: magnitude/norm of vector A (sqrt of sum of squared values)
 * - ||B||: magnitude/norm of vector B
 *
 * Range: [0, 1]
 * - 1.0: identical vectors (perfect similarity)
 * - 0.0: orthogonal vectors (no similarity)
 */
export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>,
): number {
  // Handle edge case: both vectors empty
  if (vecA.size === 0 && vecB.size === 0) {
    return 1.0;
  }

  // Calculate dot product
  let dotProduct = 0.0;

  for (const [tag, valueA] of vecA.entries()) {
    const valueB = vecB.get(tag);

    if (valueB !== undefined) {
      dotProduct += valueA * valueB;
    }
  }

  // Calculate magnitude of vector A
  let magnitudeA = 0.0;

  for (const value of vecA.values()) {
    magnitudeA += value * value;
  }

  magnitudeA = Math.sqrt(magnitudeA);

  // Calculate magnitude of vector B
  let magnitudeB = 0.0;

  for (const value of vecB.values()) {
    magnitudeB += value * value;
  }

  magnitudeB = Math.sqrt(magnitudeB);

  // Handle edge case: zero magnitude
  if (magnitudeA === 0.0 || magnitudeB === 0.0) {
    return 0.0;
  }

  // Calculate cosine similarity
  const similarity = dotProduct / (magnitudeA * magnitudeB);

  return similarity;
}