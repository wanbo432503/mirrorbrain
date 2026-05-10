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

export function sortSkillArtifactsByNewest(artifacts: SkillArtifact[]): SkillArtifact[] {
  return [...artifacts].sort(
    (left, right) => getSkillTimelineTimestamp(right) - getSkillTimelineTimestamp(left)
  )
}
