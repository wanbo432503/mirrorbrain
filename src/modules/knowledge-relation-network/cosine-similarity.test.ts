import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from './cosine-similarity.js';

describe('cosine-similarity', () => {
  describe('cosineSimilarity', () => {
    it('calculates cosine similarity for two vectors', () => {
      // Vector A: { react: 0.5, hooks: 0.3 }
      // Vector B: { react: 0.4, hooks: 0.6 }
      const vecA = new Map<string, number>();
      vecA.set('react', 0.5);
      vecA.set('hooks', 0.3);

      const vecB = new Map<string, number>();
      vecB.set('react', 0.4);
      vecB.set('hooks', 0.6);

      // dot(A, B) = 0.5*0.4 + 0.3*0.6 = 0.2 + 0.18 = 0.38
      // ||A|| = sqrt(0.5^2 + 0.3^2) = sqrt(0.25 + 0.09) = sqrt(0.34) ≈ 0.583
      // ||B|| = sqrt(0.4^2 + 0.6^2) = sqrt(0.16 + 0.36) = sqrt(0.52) ≈ 0.721
      // cosine = 0.38 / (0.583 * 0.721) ≈ 0.38 / 0.419 ≈ 0.907

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(0.907, 2);
    });

    it('returns 1 for identical vectors', () => {
      const vecA = new Map<string, number>();
      vecA.set('react', 0.5);
      vecA.set('hooks', 0.3);

      const similarity = cosineSimilarity(vecA, vecA);

      expect(similarity).toBeCloseTo(1.0);
    });

    it('returns 0 for orthogonal vectors (no common tags)', () => {
      const vecA = new Map<string, number>();
      vecA.set('react', 0.5);
      vecA.set('hooks', 0.3);

      const vecB = new Map<string, number>();
      vecB.set('vue', 0.4);
      vecB.set('composition', 0.6);

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(0.0);
    });

    it('handles vectors with partial overlap', () => {
      const vecA = new Map<string, number>();
      vecA.set('react', 0.5);
      vecA.set('hooks', 0.3);
      vecA.set('api', 0.2);

      const vecB = new Map<string, number>();
      vecB.set('hooks', 0.6);
      vecB.set('api', 0.4);

      // Only overlap on 'hooks' and 'api'
      // dot(A, B) = 0.3*0.6 + 0.2*0.4 = 0.18 + 0.08 = 0.26
      // ||A|| = sqrt(0.5^2 + 0.3^2 + 0.2^2) = sqrt(0.25 + 0.09 + 0.04) = sqrt(0.38) ≈ 0.616
      // ||B|| = sqrt(0.6^2 + 0.4^2) = sqrt(0.36 + 0.16) = sqrt(0.52) ≈ 0.721
      // cosine = 0.26 / (0.616 * 0.721) ≈ 0.26 / 0.444 ≈ 0.586

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(0.586, 2);
    });

    it('handles empty vectors', () => {
      const vecA = new Map<string, number>();
      const vecB = new Map<string, number>();

      const similarity = cosineSimilarity(vecA, vecB);

      // Two empty vectors are considered identical (similarity = 1)
      expect(similarity).toBeCloseTo(1.0);
    });

    it('handles one empty vector', () => {
      const vecA = new Map<string, number>();
      vecA.set('react', 0.5);

      const vecB = new Map<string, number>();

      const similarity = cosineSimilarity(vecA, vecB);

      // No overlap, similarity = 0
      expect(similarity).toBeCloseTo(0.0);
    });

    it('handles zero magnitude vector', () => {
      const vecA = new Map<string, number>();
      vecA.set('react', 0.0);

      const vecB = new Map<string, number>();
      vecB.set('react', 0.5);

      const similarity = cosineSimilarity(vecA, vecB);

      // Zero magnitude, similarity = 0
      expect(similarity).toBeCloseTo(0.0);
    });

    it('handles negative values', () => {
      const vecA = new Map<string, number>();
      vecA.set('react', 0.5);
      vecA.set('hooks', -0.3);

      const vecB = new Map<string, number>();
      vecB.set('react', 0.4);
      vecB.set('hooks', 0.6);

      // dot(A, B) = 0.5*0.4 + (-0.3)*0.6 = 0.2 - 0.18 = 0.02
      // ||A|| = sqrt(0.5^2 + (-0.3)^2) = sqrt(0.25 + 0.09) = sqrt(0.34) ≈ 0.583
      // ||B|| = sqrt(0.4^2 + 0.6^2) = sqrt(0.16 + 0.36) = sqrt(0.52) ≈ 0.721
      // cosine = 0.02 / (0.583 * 0.721) ≈ 0.02 / 0.419 ≈ 0.048

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(0.048, 2);
    });
  });
});