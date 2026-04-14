import type { CandidateMemory } from '../../types/index'
import type { CandidateReviewSuggestion } from '../../types/index'

interface CandidateCardProps {
  candidate: CandidateMemory
  suggestion?: CandidateReviewSuggestion
  isSelected: boolean
  onSelect: () => void
}

function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)

  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return `${formatter.format(start)} - ${formatter.format(end)}`
}

export default function CandidateCard({
  candidate,
  suggestion,
  isSelected,
  onSelect,
}: CandidateCardProps) {
  const recommendationColor =
    suggestion?.recommendation === 'keep'
      ? 'bg-green-100 text-green-700 border-green-300'
      : suggestion?.recommendation === 'discard'
      ? 'bg-red-100 text-red-700 border-red-300'
      : 'bg-blue-100 text-blue-700 border-blue-300'

  return (
    <div
      onClick={onSelect}
      className={`
        bg-white border rounded-lg p-4 cursor-pointer transition-all duration-200
        hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${isSelected
          ? 'border-blue-500 shadow-md ring-2 ring-blue-500 ring-offset-2'
          : 'border-slate-200 hover:border-slate-300'
        }
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-selected={isSelected}
    >
      <div className="space-y-3">
        {/* Title */}
        <h4 className="font-heading font-semibold text-base text-slate-900 line-clamp-2">
          {candidate.title}
        </h4>

        {/* Time Range */}
        <p className="text-xs font-body text-slate-600">
          {formatTimeRange(candidate.timeRange.startAt, candidate.timeRange.endAt)}
        </p>

        {/* Theme */}
        <div className="inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold bg-slate-100 text-slate-600">
          {candidate.theme}
        </div>

        {/* AI Recommendation */}
        {suggestion && (
          <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold ${recommendationColor} border`}>
            AI: {suggestion.recommendation} ({Math.round(suggestion.confidenceScore * 100)}%)
          </div>
        )}
      </div>
    </div>
  )
}