import Button from '../common/Button'

interface ReviewActionsProps {
  onCreateCandidates: () => void
  isCreatingCandidates: boolean
  isReviewing: boolean
  feedback?: {
    kind: 'success' | 'error' | 'info'
    message: string
  } | null
}

export default function ReviewActions({
  onCreateCandidates,
  isCreatingCandidates,
  isReviewing,
  feedback,
}: ReviewActionsProps) {
  return (
    <div className="flex flex-col items-end mb-3">
      <Button
        variant="primary"
        onClick={onCreateCandidates}
        loading={isCreatingCandidates}
        disabled={isCreatingCandidates || isReviewing}
      >
        {isCreatingCandidates ? 'Creating...' : 'Create Daily Candidates'}
      </Button>
      {feedback && (
        <div
          className={`mt-3 p-3 rounded-lg border ${
            feedback.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-700'
              : feedback.kind === 'error'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-blue-100 border-blue-300 text-blue-700'
          }`}
          role="alert"
        >
          <p className="font-body font-medium text-sm">{feedback.message}</p>
        </div>
      )}
    </div>
  )
}
