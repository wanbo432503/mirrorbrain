import { describe, it, expect } from 'vitest';
import {
  calculateIDFWeights,
  calculateTFVector,
  buildTFIDFVector,
} from './tfidf-calculator.js';
import type { KnowledgeArtifact } from '../../shared/types/index.js';

function createArtifact(input: {
  id: string;
  tags?: string[];
}): KnowledgeArtifact {
  return {
    id: input.id,
    draftState: 'published',
    artifactType: 'topic-knowledge',
    sourceReviewedMemoryIds: [],
    tags: input.tags ?? [],
  };
}

describe('tfidf-calculator', () => {
  describe('calculateIDFWeights', () => {
    it('calculates IDF weights for vocabulary across artifacts', () => {
      const vocabulary = ['react', 'hooks', 'api', 'authentication'];
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['react', 'hooks'] }),
        createArtifact({ id: 'k2', tags: ['react', 'api'] }),
        createArtifact({ id: 'k3', tags: ['api', 'authentication'] }),
      ];

      const idfWeights = calculateIDFWeights(vocabulary, artifacts);

      // Total artifacts N = 3
      // 'react': df = 2, IDF = ln((3+1)/(2+1)) = ln(4/3) ≈ 0.288
      // 'hooks': df = 1, IDF = ln((3+1)/(1+1)) = ln(4/2) = ln(2) ≈ 0.693
      // 'api': df = 2, IDF = ln((3+1)/(2+1)) = ln(4/3) ≈ 0.288
      // 'authentication': df = 1, IDF = ln((3+1)/(1+1)) = ln(4/2) ≈ 0.693

      expect(idfWeights.get('react')).toBeCloseTo(Math.log((3 + 1) / (2 + 1)));
      expect(idfWeights.get('hooks')).toBeCloseTo(Math.log((3 + 1) / (1 + 1)));
      expect(idfWeights.get('api')).toBeCloseTo(Math.log((3 + 1) / (2 + 1)));
      expect(idfWeights.get('authentication')).toBeCloseTo(Math.log((3 + 1) / (1 + 1)));
    });

    it('gives higher weight to rare tags', () => {
      const vocabulary = ['common', 'rare'];
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['common', 'rare'] }),
        createArtifact({ id: 'k2', tags: ['common'] }),
        createArtifact({ id: 'k3', tags: ['common'] }),
      ];

      const idfWeights = calculateIDFWeights(vocabulary, artifacts);

      // 'common': appears in all 3 artifacts, low IDF
      // 'rare': appears in only 1 artifact, high IDF
      const commonWeight = idfWeights.get('common') ?? 0;
      const rareWeight = idfWeights.get('rare') ?? 0;

      expect(rareWeight).toBeGreaterThan(commonWeight);
    });

    it('handles empty vocabulary', () => {
      const vocabulary: string[] = [];
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['react', 'hooks'] }),
      ];

      const idfWeights = calculateIDFWeights(vocabulary, artifacts);

      expect(idfWeights.size).toBe(0);
    });

    it('handles artifacts without tags', () => {
      const vocabulary = ['react', 'hooks'];
      const artifacts = [
        createArtifact({ id: 'k1', tags: [] }),
        createArtifact({ id: 'k2', tags: [] }),
      ];

      const idfWeights = calculateIDFWeights(vocabulary, artifacts);

      // All tags have df = 0, IDF = ln((2+1)/(0+1)) = ln(3) ≈ 1.099
      expect(idfWeights.get('react')).toBeCloseTo(Math.log((2 + 1) / (0 + 1)));
      expect(idfWeights.get('hooks')).toBeCloseTo(Math.log((2 + 1) / (0 + 1)));
    });
  });

  describe('calculateTFVector', () => {
    it('counts tag occurrences in artifact', () => {
      const artifact = createArtifact({
        id: 'k1',
        tags: ['react', 'hooks', 'react', 'api', 'hooks', 'hooks'],
      });

      const tfVector = calculateTFVector(artifact);

      // 'react': count = 2
      // 'hooks': count = 3
      // 'api': count = 1
      expect(tfVector.get('react')).toBe(2);
      expect(tfVector.get('hooks')).toBe(3);
      expect(tfVector.get('api')).toBe(1);
    });

    it('handles artifact without tags', () => {
      const artifact = createArtifact({ id: 'k1', tags: [] });

      const tfVector = calculateTFVector(artifact);

      expect(tfVector.size).toBe(0);
    });

    it('handles artifact with undefined tags', () => {
      const artifact = createArtifact({ id: 'k1', tags: undefined });

      const tfVector = calculateTFVector(artifact);

      expect(tfVector.size).toBe(0);
    });
  });

  describe('buildTFIDFVector', () => {
    it('builds TF-IDF vector by multiplying TF and IDF', () => {
      const artifact = createArtifact({
        id: 'k1',
        tags: ['react', 'hooks', 'react'],
      });

      const idfWeights = new Map<string, number>();
      idfWeights.set('react', 0.288);
      idfWeights.set('hooks', 0.693);

      const tfidfVector = buildTFIDFVector(artifact, idfWeights);

      // 'react': TF = 2, IDF = 0.288, TF-IDF = 2 * 0.288 = 0.576
      // 'hooks': TF = 1, IDF = 0.693, TF-IDF = 1 * 0.693 = 0.693
      expect(tfidfVector.get('react')).toBeCloseTo(2 * 0.288);
      expect(tfidfVector.get('hooks')).toBeCloseTo(1 * 0.693);
    });

    it('ignores tags not in IDF weights', () => {
      const artifact = createArtifact({
        id: 'k1',
        tags: ['react', 'unknown-tag', 'hooks'],
      });

      const idfWeights = new Map<string, number>();
      idfWeights.set('react', 0.288);
      idfWeights.set('hooks', 0.693);

      const tfidfVector = buildTFIDFVector(artifact, idfWeights);

      expect(tfidfVector.has('unknown-tag')).toBe(false);
      expect(tfidfVector.get('react')).toBeCloseTo(1 * 0.288);
      expect(tfidfVector.get('hooks')).toBeCloseTo(1 * 0.693);
    });

    it('handles artifact without tags', () => {
      const artifact = createArtifact({ id: 'k1', tags: [] });

      const idfWeights = new Map<string, number>();
      idfWeights.set('react', 0.288);

      const tfidfVector = buildTFIDFVector(artifact, idfWeights);

      expect(tfidfVector.size).toBe(0);
    });
  });
});