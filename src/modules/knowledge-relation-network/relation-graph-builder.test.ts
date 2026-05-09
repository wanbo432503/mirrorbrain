import { describe, it, expect } from 'vitest';
import { buildKnowledgeRelationGraph } from './relation-graph-builder.js';
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

describe('relation-graph-builder', () => {
  describe('buildKnowledgeRelationGraph', () => {
    it('builds relation graph for knowledge artifacts', () => {
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['react', 'hooks', 'state'] }),
        createArtifact({ id: 'k2', tags: ['react', 'hooks', 'effect'] }),
        createArtifact({ id: 'k3', tags: ['vue', 'composition', 'reactive'] }),
      ];

      // Use lower threshold for partial overlap cases
      const graph = buildKnowledgeRelationGraph(artifacts, { threshold: 0.2 });

      // k1 and k2 share 'react' and 'hooks' → moderate similarity
      // k3 has different tags → low similarity with k1 and k2
      const k1Related = graph.get('k1') ?? [];
      const k2Related = graph.get('k2') ?? [];
      const k3Related = graph.get('k3') ?? [];

      expect(k1Related).toContain('k2');
      expect(k2Related).toContain('k1');

      // k3 should not be related to k1 or k2 (below threshold)
      expect(k3Related).not.toContain('k1');
      expect(k3Related).not.toContain('k2');
    });

    it('applies TOP_K constraint to prevent super-nodes', () => {
      // Create many similar artifacts (all share 'react' tag)
      const artifacts: KnowledgeArtifact[] = [];

      for (let i = 0; i < 10; i++) {
        artifacts.push(
          createArtifact({
            id: `k${i}`,
            tags: ['react', `unique-${i}`], // 'react' is common, unique tag ensures distinctiveness
          }),
        );
      }

      const graph = buildKnowledgeRelationGraph(artifacts, { topK: 5 });

      // Each artifact should have at most 5 relations
      for (const [id, related] of graph.entries()) {
        expect(related.length).toBeLessThanOrEqual(5);
      }
    });

    it('applies threshold to filter weak edges', () => {
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['react', 'hooks'] }),
        createArtifact({ id: 'k2', tags: ['react', 'api'] }),
        createArtifact({ id: 'k3', tags: ['vue', 'composition'] }),
      ];

      // With threshold = 0.5, only high similarity relations are kept
      const graph = buildKnowledgeRelationGraph(artifacts, { threshold: 0.5 });

      const k1Related = graph.get('k1') ?? [];

      // k1 and k2 share only 'react', similarity may be below 0.5
      // k1 and k3 have no common tags, similarity = 0
      expect(k1Related.length).toBeLessThanOrEqual(1);
    });

    it('returns empty graph for empty artifacts list', () => {
      const graph = buildKnowledgeRelationGraph([]);

      expect(graph.size).toBe(0);
    });

    it('handles artifacts without tags', () => {
      const artifacts = [
        createArtifact({ id: 'k1', tags: [] }),
        createArtifact({ id: 'k2', tags: [] }),
      ];

      const graph = buildKnowledgeRelationGraph(artifacts);

      // Both have empty tags, but empty vectors are considered identical (similarity = 1)
      expect(graph.get('k1')).toContain('k2');
      expect(graph.get('k2')).toContain('k1');
    });

    it('preserves artifact IDs in graph keys', () => {
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['react'] }),
        createArtifact({ id: 'k2', tags: ['hooks'] }),
      ];

      const graph = buildKnowledgeRelationGraph(artifacts);

      expect(graph.has('k1')).toBe(true);
      expect(graph.has('k2')).toBe(true);
    });

    it('returns symmetric relations (if A relates to B, B relates to A)', () => {
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['react', 'hooks'] }),
        createArtifact({ id: 'k2', tags: ['react', 'hooks'] }),
      ];

      // Identical tags, use threshold 0.0 to ensure relation is captured
      const graph = buildKnowledgeRelationGraph(artifacts, { threshold: 0.0 });

      // Identical tags → similarity = 1 → both should be related
      const k1Related = graph.get('k1') ?? [];
      const k2Related = graph.get('k2') ?? [];

      expect(k1Related).toContain('k2');
      expect(k2Related).toContain('k1');
    });

    it('calculates similarity correctly for partial overlap', () => {
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['react', 'hooks', 'state', 'effect'] }),
        createArtifact({ id: 'k2', tags: ['react', 'hooks', 'api', 'fetch'] }),
      ];

      const graph = buildKnowledgeRelationGraph(artifacts, { threshold: 0.0 });

      // k1 and k2 share 'react' and 'hooks' (2 out of 4 tags each)
      // Similarity should be > 0 but < 1
      const k1Related = graph.get('k1') ?? [];

      expect(k1Related).toContain('k2');
    });

    it('relates two artifacts that share their only topic tag', () => {
      const artifacts = [
        createArtifact({ id: 'k1', tags: ['vitest'] }),
        createArtifact({ id: 'k2', tags: ['vitest'] }),
      ];

      const graph = buildKnowledgeRelationGraph(artifacts);

      expect(graph.get('k1')).toContain('k2');
      expect(graph.get('k2')).toContain('k1');
    });
  });
});
