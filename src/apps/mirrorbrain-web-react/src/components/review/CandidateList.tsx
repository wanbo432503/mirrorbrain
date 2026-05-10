import CandidateCard from './CandidateCard'
import EmptyState from '../common/EmptyState'
import type { CandidateMemory } from '../../types/index'
import type { CandidateReviewSuggestion } from '../../types/index'

interface CandidateListProps {
  candidates: CandidateMemory[]
  selectedCandidateId: string | null
  onSelectCandidate: (candidateId: string) => void
  onKeepCandidate: (candidateId: string) => void
  onDiscardCandidate: (candidateId: string) => void
  getReviewSuggestion: (candidateId: string) => CandidateReviewSuggestion | undefined
}

function sortByReviewPriority(
  candidates: CandidateMemory[],
  getReviewSuggestion: (candidateId: string) => CandidateReviewSuggestion | undefined,
): CandidateMemory[] {
  return [...candidates].sort((left, right) => {
    const leftSuggestion = getReviewSuggestion(left.id)
    const rightSuggestion = getReviewSuggestion(right.id)

    // Primary: Keep score (higher = more important)
    const leftKeepScore = leftSuggestion?.keepScore ?? 0
    const rightKeepScore = rightSuggestion?.keepScore ?? 0
    if (leftKeepScore !== rightKeepScore) {
      return rightKeepScore - leftKeepScore // Higher score first
    }

    // Secondary: Duration (longer = more significant)
    const leftDuration = getDurationMinutes(left.timeRange.startAt, left.timeRange.endAt)
    const rightDuration = getDurationMinutes(right.timeRange.startAt, right.timeRange.endAt)
    if (leftDuration !== rightDuration) {
      return rightDuration - leftDuration // Longer first
    }

    // Tertiary: Source count (more sources = more context)
    const leftSourceCount = (left.sourceRefs ?? []).length
    const rightSourceCount = (right.sourceRefs ?? []).length
    if (leftSourceCount !== rightSourceCount) {
      return rightSourceCount - leftSourceCount // More sources first
    }

    // Final: Chronological order (earlier first)
    return left.timeRange.startAt.localeCompare(right.timeRange.startAt)
  })
}

function getDurationMinutes(startAt: string, endAt: string): number {
  const start = new Date(startAt)
  const end = new Date(endAt)
  return Math.round((end.getTime() - start.getTime()) / 60000)
}

export default function CandidateList({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onKeepCandidate,
  onDiscardCandidate,
  getReviewSuggestion,
}: CandidateListProps) {
  if (candidates.length === 0) {
    return (
      <EmptyState
        message="No candidates generated"
        description="Click 'Create Daily Candidates' to start review"
      />
    )
  }

  // Sort candidates by review priority
  const sortedCandidates = sortByReviewPriority(candidates, getReviewSuggestion)

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
      {sortedCandidates.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
          suggestion={getReviewSuggestion(candidate.id)}
          isSelected={candidate.id === selectedCandidateId}
          onSelect={() => onSelectCandidate(candidate.id)}
          onKeep={() => onKeepCandidate(candidate.id)}
          onDiscard={() => onDiscardCandidate(candidate.id)}
        />
      ))}
    </div>
  )
}
