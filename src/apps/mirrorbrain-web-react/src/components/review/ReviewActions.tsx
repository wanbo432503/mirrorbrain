import Button from '../common/Button'

interface ReviewActionsProps {
  onCreateCandidates: () => void
  isCreatingCandidates: boolean
  isReviewing: boolean
}

export default function ReviewActions({
  onCreateCandidates,
  isCreatingCandidates,
  isReviewing,
}: ReviewActionsProps) {
  return (
    <div className="space-y-2 mb-3">
      {/* Create Candidates Button */}
      <Button
        variant="primary"
        onClick={onCreateCandidates}
        loading={isCreatingCandidates}
        disabled={isCreatingCandidates || isReviewing}
      >
        {isCreatingCandidates ? 'Creating...' : 'Create Daily Candidates'}
      </Button>
    </div>
  )
}