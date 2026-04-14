import CandidateCard from './CandidateCard'
import EmptyState from '../common/EmptyState'
import type { CandidateMemory } from '../../types/index'
import type { CandidateReviewSuggestion } from '../../types/index'

interface CandidateListProps {
  candidates: CandidateMemory[]
  selectedCandidateId: string | null
  onSelectCandidate: (candidateId: string) => void
  getReviewSuggestion: (candidateId: string) => CandidateReviewSuggestion | undefined
}

export default function CandidateList({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
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

  return (
    <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2">
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
          suggestion={getReviewSuggestion(candidate.id)}
          isSelected={candidate.id === selectedCandidateId}
          onSelect={() => onSelectCandidate(candidate.id)}
        />
      ))}
    </div>
  )
}