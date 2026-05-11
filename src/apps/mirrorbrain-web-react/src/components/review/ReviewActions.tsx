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
    <div className="mb-3 flex items-stretch justify-end gap-3">
      {feedback && (
        <div
          className={`min-w-0 flex-1 self-stretch p-3 rounded-lg border ${
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
      <Button
        variant="primary"
        onClick={onCreateCandidates}
        loading={isCreatingCandidates}
        disabled={isCreatingCandidates || isReviewing}
        className="self-stretch"
      >
        {isCreatingCandidates ? 'Creating...' : 'Create Daily Candidates'}
      </Button>
    </div>
  )
}
