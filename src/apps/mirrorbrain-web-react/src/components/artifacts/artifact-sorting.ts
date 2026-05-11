import type { KnowledgeArtifact, SkillArtifact } from '../../types/index'

function getKnowledgeTimelineTimestamp(artifact: KnowledgeArtifact): number {
  const timestamp = artifact.updatedAt ?? artifact.reviewedAt ?? ''
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : 0
}

function getSkillTimelineTimestamp(artifact: SkillArtifact): number {
  const timestamp = artifact.updatedAt ?? artifact.reviewedAt ?? ''
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : 0
}

export function sortKnowledgeArtifactsByNewest(
  artifacts: KnowledgeArtifact[]
): KnowledgeArtifact[] {
  return artifacts
    .filter((artifact) => artifact.draftState === 'published')
    .sort(
      (left, right) => getKnowledgeTimelineTimestamp(right) - getKnowledgeTimelineTimestamp(left)
    )
}

export function selectCurrentBestKnowledgeArtifacts(
  artifacts: KnowledgeArtifact[],
): KnowledgeArtifact[] {
  const topicArtifacts = artifacts.filter(
    (artifact) => artifact.draftState === 'published' && artifact.topicKey !== undefined,
  );
  const grouped = new Map<string, KnowledgeArtifact[]>();

  for (const artifact of topicArtifacts) {
    const topicKey = artifact.topicKey ?? '';
    const group = grouped.get(topicKey) ?? [];
    group.push(artifact);
    grouped.set(topicKey, group);
  }

  return [...grouped.values()]
    .map((group) =>
      [...group].sort((left, right) => {
        if (left.isCurrentBest !== right.isCurrentBest) {
          return left.isCurrentBest ? -1 : 1;
        }

        const versionDelta = (right.version ?? 0) - (left.version ?? 0);
        if (versionDelta !== 0) {
          return versionDelta;
        }

        return getKnowledgeTimelineTimestamp(right) - getKnowledgeTimelineTimestamp(left);
      })[0],
    )
    .filter((artifact): artifact is KnowledgeArtifact => artifact !== undefined)
    .sort(
      (left, right) => getKnowledgeTimelineTimestamp(right) - getKnowledgeTimelineTimestamp(left)
    );
}

export function sortSkillArtifactsByNewest(artifacts: SkillArtifact[]): SkillArtifact[] {
  return [...artifacts].sort(
    (left, right) => getSkillTimelineTimestamp(right) - getSkillTimelineTimestamp(left)
  )
}
