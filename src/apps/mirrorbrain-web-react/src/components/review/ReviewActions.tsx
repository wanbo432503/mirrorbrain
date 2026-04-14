import Button from '../common/Button'

interface ReviewActionsProps {
  onCreateCandidates: () => void
  onKeepCandidate: () => void
  onDiscardCandidate: () => void
  isCreatingCandidates: boolean
  isReviewing: boolean
  selectedCandidateId: string | null
}

export default function ReviewActions({
  onCreateCandidates,
  onKeepCandidate,
  onDiscardCandidate,
  isCreatingCandidates,
  isReviewing,
  selectedCandidateId,
}: ReviewActionsProps) {
  return (
    <div className="space-y-4 mb-8">
      {/* Create Candidates Button */}
      <Button
        variant="primary"
        onClick={onCreateCandidates}
        loading={isCreatingCandidates}
        disabled={isCreatingCandidates || isReviewing}
      >
        {isCreatingCandidates ? 'Creating...' : 'Create Daily Candidates'}
      </Button>

      {/* Review Decision Buttons */}
      {selectedCandidateId && (
        <div className="flex gap-4">
          <Button
            variant="success"
            onClick={onKeepCandidate}
            loading={isReviewing}
            disabled={isReviewing || isCreatingCandidates}
          >
            {isReviewing ? 'Reviewing...' : 'Keep Candidate'}
          </Button>
          <Button
            variant="ghost"
            onClick={onDiscardCandidate}
            loading={isReviewing}
            disabled={isReviewing || isCreatingCandidates}
          >
            {isReviewing ? 'Reviewing...' : 'Discard Candidate'}
          </Button>
        </div>
      )}
    </div>
  )
}