import type { SkillArtifact } from '../../types/index'

function getSkillTimelineTimestamp(artifact: SkillArtifact): number {
  const timestamp = artifact.updatedAt ?? artifact.reviewedAt ?? ''
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : 0
}

export function sortSkillArtifactsByNewest(artifacts: SkillArtifact[]): SkillArtifact[] {
  return [...artifacts].sort(
    (left, right) => getSkillTimelineTimestamp(right) - getSkillTimelineTimestamp(left)
  )
}
