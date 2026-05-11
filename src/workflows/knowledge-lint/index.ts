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
  const updateArtifacts = activeArtifacts
    .map((artifact) => withRelatedKnowledgeIds(artifact, graph.get(artifact.id) ?? []))
    .filter((artifact, index) =>
      !sameStringArray(artifact.relatedKnowledgeIds ?? [], activeArtifacts[index]?.relatedKnowledgeIds ?? []),
    );

  return {
    updateArtifacts,
    deleteArtifactIds,
  };
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
