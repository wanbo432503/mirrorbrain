import { buildKnowledgeRelationGraph } from '../../modules/knowledge-relation-network/index.js';
import { extractTags } from '../../modules/knowledge-compilation-engine/index.js';
import type { KnowledgeArtifact } from '../../shared/types/index.js';

export interface KnowledgeLintInput {
  knowledgeArtifacts: KnowledgeArtifact[];
  seedKnowledgeIds: string[];
}

export interface KnowledgeLintPlan {
  updateArtifacts: KnowledgeArtifact[];
  deleteArtifactIds: string[];
  mergeCandidateArtifacts: KnowledgeArtifact[];
}

export function lintKnowledgeArtifacts(
  input: KnowledgeLintInput,
): KnowledgeLintPlan {
  const deleteArtifactIds = findDuplicatedDraftIds(input.knowledgeArtifacts, input.seedKnowledgeIds);
  const deleteIdSet = new Set(deleteArtifactIds);
  const activeArtifacts = input.knowledgeArtifacts.filter(
    (artifact) => !deleteIdSet.has(artifact.id),
  );
  const relationInput = activeArtifacts.map((artifact) => ({
    ...artifact,
    tags: buildRelationTags(artifact),
  }));
  const graph = buildKnowledgeRelationGraph(relationInput);
  const mergeCandidateArtifacts = buildMergeCandidateArtifacts({
    activeArtifacts,
    graph,
    seedKnowledgeIds: input.seedKnowledgeIds,
  });
  const updateArtifacts = activeArtifacts
    .map((artifact) => withRelatedKnowledgeIds(artifact, graph.get(artifact.id) ?? []))
    .filter((artifact, index) =>
      !sameStringArray(artifact.relatedKnowledgeIds ?? [], activeArtifacts[index]?.relatedKnowledgeIds ?? []),
    );

  return {
    updateArtifacts,
    deleteArtifactIds,
    mergeCandidateArtifacts,
  };
}

function buildMergeCandidateArtifacts(input: {
  activeArtifacts: KnowledgeArtifact[];
  graph: Map<string, string[]>;
  seedKnowledgeIds: string[];
}): KnowledgeArtifact[] {
  const artifactById = new Map(
    input.activeArtifacts.map((artifact) => [artifact.id, artifact]),
  );
  const existingCandidateKeys = new Set(
    input.activeArtifacts
      .filter((artifact) => artifact.artifactType === 'topic-merge-candidate')
      .map((artifact) => getDerivedKnowledgeKey(artifact.derivedFromKnowledgeIds ?? [])),
  );
  const candidates: KnowledgeArtifact[] = [];

  for (const seedKnowledgeId of input.seedKnowledgeIds) {
    const seedArtifact = artifactById.get(seedKnowledgeId);

    if (!seedArtifact || seedArtifact.artifactType === 'topic-merge-candidate') {
      continue;
    }

    for (const relatedKnowledgeId of input.graph.get(seedKnowledgeId) ?? []) {
      const relatedArtifact = artifactById.get(relatedKnowledgeId);

      if (!relatedArtifact || relatedArtifact.artifactType === 'topic-merge-candidate') {
        continue;
      }

      if (hasSameReviewedMemorySources(seedArtifact, relatedArtifact)) {
        continue;
      }

      const derivedFromKnowledgeIds = [seedArtifact.id, relatedArtifact.id];
      const candidateKey = getDerivedKnowledgeKey(derivedFromKnowledgeIds);

      if (existingCandidateKeys.has(candidateKey)) {
        continue;
      }

      existingCandidateKeys.add(candidateKey);
      candidates.push(createMergeCandidate(seedArtifact, relatedArtifact));
    }
  }

  return candidates;
}

function createMergeCandidate(
  seedArtifact: KnowledgeArtifact,
  relatedArtifact: KnowledgeArtifact,
): KnowledgeArtifact {
  const topicKey =
    seedArtifact.topicKey ?? relatedArtifact.topicKey ?? 'untitled-topic';
  const title = `Merge candidate: ${seedArtifact.title ?? seedArtifact.id}`;
  const relatedTitle = relatedArtifact.title ?? relatedArtifact.id;
  const updatedAt = [seedArtifact.updatedAt, relatedArtifact.updatedAt]
    .filter((value): value is string => value !== undefined)
    .sort()
    .at(-1);

  return {
    ...seedArtifact,
    id: `topic-merge-candidate:${topicKey}:${encodeURIComponent(seedArtifact.id)}:${encodeURIComponent(relatedArtifact.id)}`,
    artifactType: 'topic-merge-candidate',
    draftState: 'draft',
    topicKey,
    title,
    summary: `Suggested merge with similar knowledge: ${relatedTitle}.`,
    body: [
      '## Merge Suggestion',
      '',
      `This candidate links similar knowledge artifacts for human review: ${seedArtifact.title ?? seedArtifact.id} and ${relatedTitle}.`,
      '',
      '## New Knowledge',
      '',
      seedArtifact.body ?? seedArtifact.summary ?? '',
      '',
      '## Related Knowledge',
      '',
      relatedArtifact.body ?? relatedArtifact.summary ?? '',
    ].join('\n'),
    sourceReviewedMemoryIds: Array.from(
      new Set([
        ...seedArtifact.sourceReviewedMemoryIds,
        ...relatedArtifact.sourceReviewedMemoryIds,
      ]),
    ),
    derivedFromKnowledgeIds: [seedArtifact.id, relatedArtifact.id],
    isCurrentBest: false,
    supersedesKnowledgeId: null,
    updatedAt,
    provenanceRefs: [
      ...(seedArtifact.provenanceRefs ?? []),
      ...(relatedArtifact.provenanceRefs ?? []),
      { kind: 'knowledge-artifact', id: seedArtifact.id },
      { kind: 'knowledge-artifact', id: relatedArtifact.id },
    ],
    tags: Array.from(new Set([...(seedArtifact.tags ?? []), ...(relatedArtifact.tags ?? [])])),
    relatedKnowledgeIds: [seedArtifact.id, relatedArtifact.id],
  };
}

function getDerivedKnowledgeKey(knowledgeIds: string[]): string {
  return [...knowledgeIds].sort().join('|');
}

function hasSameReviewedMemorySources(
  left: KnowledgeArtifact,
  right: KnowledgeArtifact,
): boolean {
  return getDerivedKnowledgeKey(left.sourceReviewedMemoryIds) ===
    getDerivedKnowledgeKey(right.sourceReviewedMemoryIds);
}

function findDuplicatedDraftIds(
  artifacts: KnowledgeArtifact[],
  seedKnowledgeIds: string[],
): string[] {
  const seedIdSet = new Set(seedKnowledgeIds);
  const draftGroups = new Map<string, KnowledgeArtifact[]>();

  for (const artifact of artifacts) {
    if (!isGeneratedDailyReviewDraft(artifact)) {
      continue;
    }

    const sourceReviewedMemoryIds = [...artifact.sourceReviewedMemoryIds].sort();

    if (sourceReviewedMemoryIds.length === 0) {
      continue;
    }

    const key = [
      artifact.topicKey ?? '',
      sourceReviewedMemoryIds.join('|'),
    ].join('::');
    const group = draftGroups.get(key) ?? [];

    group.push(artifact);
    draftGroups.set(key, group);
  }

  return [...draftGroups.values()].flatMap((group) => {
    if (group.length <= 1) {
      return [];
    }

    const keeper =
      group.find((artifact) => seedIdSet.has(artifact.id)) ??
      [...group].sort((left, right) =>
        (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''),
      )[0];

    return group
      .filter((artifact) => artifact.id !== keeper?.id)
      .map((artifact) => artifact.id)
      .sort();
  });
}

function isGeneratedDailyReviewDraft(artifact: KnowledgeArtifact): boolean {
  return (
    artifact.draftState === 'draft' &&
    artifact.artifactType === 'daily-review-draft' &&
    artifact.id.startsWith('knowledge-draft:')
  );
}

function withRelatedKnowledgeIds(
  artifact: KnowledgeArtifact,
  relatedKnowledgeIds: string[],
): KnowledgeArtifact {
  if (relatedKnowledgeIds.length > 0) {
    return {
      ...artifact,
      relatedKnowledgeIds,
    };
  }

  if (artifact.relatedKnowledgeIds !== undefined) {
    return {
      ...artifact,
      relatedKnowledgeIds: [],
    };
  }

  return artifact;
}

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function buildRelationTags(artifact: KnowledgeArtifact): string[] {
  if (artifact.tags !== undefined && artifact.tags.length > 0) {
    return Array.from(new Set(artifact.tags));
  }

  return extractTags(
    [
      artifact.topicKey,
      artifact.title,
      artifact.summary,
      artifact.body,
    ]
      .filter((value): value is string => typeof value === 'string')
      .filter((value) => value.length > 0)
      .join('\n'),
  );
}
