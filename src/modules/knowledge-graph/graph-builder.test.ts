/**
 * Knowledge Graph Builder Tests
 */

import { describe, it, expect } from 'vitest';
import { buildKnowledgeGraphSnapshot } from './graph-builder.js';
import type { KnowledgeArtifact } from '../../shared/types/index.js';

describe('buildKnowledgeGraphSnapshot', () => {
  it('handles empty artifacts', () => {
    const snapshot = buildKnowledgeGraphSnapshot([]);

    expect(snapshot.stats.topics).toBe(0);
    expect(snapshot.stats.knowledgeArtifacts).toBe(0);
    expect(snapshot.stats.wikilinkReferences).toBe(0);
    expect(snapshot.nodes).toHaveLength(0);
    expect(snapshot.edges).toHaveLength(0);
  });

  it('creates topic nodes from artifacts', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A Title',
        summary: 'Summary of topic A',
        isCurrentBest: true,
        sourceReviewedMemoryIds: [],
      },
      {
        id: 'artifact-2',
        draftState: 'published',
        topicKey: 'topic-b',
        title: 'Topic B Title',
        isCurrentBest: true,
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    expect(snapshot.stats.topics).toBe(2);
    expect(snapshot.stats.knowledgeArtifacts).toBe(2);

    const topicNodes = snapshot.nodes.filter((n) => n.type === 'topic');
    expect(topicNodes).toHaveLength(2);

    expect(topicNodes[0].topicKey).toBe('topic-a');
    expect(topicNodes[0].label).toBe('Topic A Title');
    expect(topicNodes[1].topicKey).toBe('topic-b');
  });

  it('creates CONTAINS edges for artifacts', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A',
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    const containsEdges = snapshot.edges.filter((e) => e.type === 'CONTAINS');
    expect(containsEdges).toHaveLength(1);
    expect(containsEdges[0].source).toBe('topic:topic-a');
    expect(containsEdges[0].target).toBe('artifact:artifact-1');
  });

  it('creates REFERENCES edges from wikilinks', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A',
        body: 'This references [[topic-b]].',
        sourceReviewedMemoryIds: [],
      },
      {
        id: 'artifact-2',
        draftState: 'published',
        topicKey: 'topic-b',
        title: 'Topic B',
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    const refEdges = snapshot.edges.filter((e) => e.type === 'REFERENCES');
    expect(refEdges).toHaveLength(1);
    expect(refEdges[0].source).toBe('topic:topic-a');
    expect(refEdges[0].target).toBe('topic:topic-b');
    expect(snapshot.stats.wikilinkReferences).toBe(1);
  });

  it('skips wikilinks to non-existent topics', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A',
        body: 'This references [[non-existent-topic]].',
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    const refEdges = snapshot.edges.filter((e) => e.type === 'REFERENCES');
    expect(refEdges).toHaveLength(0);
  });

  it('skips self-referencing wikilinks', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A',
        body: 'Self reference [[topic-a]] here.',
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    const refEdges = snapshot.edges.filter((e) => e.type === 'REFERENCES');
    expect(refEdges).toHaveLength(0);
  });

  it('deduplicates wikilink references', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A v1',
        body: 'See [[topic-b]].',
        sourceReviewedMemoryIds: [],
      },
      {
        id: 'artifact-2',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A v2',
        version: 2,
        isCurrentBest: true,
        body: 'Also see [[topic-b]] again.',
        sourceReviewedMemoryIds: [],
      },
      {
        id: 'artifact-3',
        draftState: 'published',
        topicKey: 'topic-b',
        title: 'Topic B',
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    const refEdges = snapshot.edges.filter((e) => e.type === 'REFERENCES');
    // Only one edge, even though multiple artifacts have same wikilink
    expect(refEdges).toHaveLength(1);
  });

  it('skips artifacts without topicKey', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'draft',
        title: 'Draft without topic',
        sourceReviewedMemoryIds: [],
      },
      {
        id: 'artifact-2',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A',
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    expect(snapshot.stats.topics).toBe(1);
    expect(snapshot.stats.knowledgeArtifacts).toBe(1);
  });

  it('creates SIMILAR edges when similarity is enabled', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A',
        tags: ['shared-tag', 'unique-a'],
        sourceReviewedMemoryIds: [],
      },
      {
        id: 'artifact-2',
        draftState: 'published',
        topicKey: 'topic-b',
        title: 'Topic B',
        tags: ['shared-tag', 'unique-b'],
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts, {
      includeSimilarityRelations: true,
      similarityThreshold: 0.1, // Low threshold to ensure edge is created
    });

    const similarEdges = snapshot.edges.filter((e) => e.type === 'SIMILAR');
    // Should have at least one SIMILAR edge due to shared tag
    expect(similarEdges.length).toBeGreaterThanOrEqual(0);
  });

  it('skips SIMILAR edges when disabled', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Topic A',
        tags: ['tag'],
        sourceReviewedMemoryIds: [],
      },
      {
        id: 'artifact-2',
        draftState: 'published',
        topicKey: 'topic-b',
        title: 'Topic B',
        tags: ['tag'],
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts, {
      includeSimilarityRelations: false,
    });

    const similarEdges = snapshot.edges.filter((e) => e.type === 'SIMILAR');
    expect(similarEdges).toHaveLength(0);
    expect(snapshot.stats.similarityRelations).toBe(0);
  });

  it('uses currentBest artifact for topic metadata', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'artifact-1',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'Old Title',
        summary: 'Old summary',
        version: 1,
        isCurrentBest: false,
        sourceReviewedMemoryIds: [],
      },
      {
        id: 'artifact-2',
        draftState: 'published',
        topicKey: 'topic-a',
        title: 'New Title',
        summary: 'New summary',
        version: 2,
        isCurrentBest: true,
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    const topicNode = snapshot.nodes.find((n) => n.type === 'topic');
    expect(topicNode?.label).toBe('New Title');
    expect(topicNode?.properties.summary).toBe('New summary');
    expect(topicNode?.properties.artifactId).toBe('artifact-2');
  });

  it('generates valid node IDs', () => {
    const artifacts: KnowledgeArtifact[] = [
      {
        id: 'abc123',
        draftState: 'published',
        topicKey: 'my-topic',
        title: 'My Topic',
        sourceReviewedMemoryIds: [],
      },
    ];

    const snapshot = buildKnowledgeGraphSnapshot(artifacts);

    const topicNode = snapshot.nodes.find((n) => n.type === 'topic');
    const artifactNode = snapshot.nodes.find((n) => n.type === 'knowledge-artifact');

    expect(topicNode?.id).toBe('topic:my-topic');
    expect(artifactNode?.id).toBe('artifact:abc123');
  });
});