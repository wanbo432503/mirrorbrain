import type { CandidateMemory } from '../../types/index'
import type { CandidateReviewSuggestion } from '../../types/index'

interface CandidateCardProps {
  candidate: CandidateMemory
  suggestion?: CandidateReviewSuggestion
  isSelected: boolean
  onSelect: () => void
  onKeep: () => void
  onDiscard: () => void
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

function calculateDuration(startAt: string, endAt: string): number {
  const start = new Date(startAt)
  const end = new Date(endAt)
  return Math.round((end.getTime() - start.getTime()) / 60000)
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60)
    return `${hours}h`
  }
  return `${minutes}m`
}

export default function CandidateCard({
  candidate,
  suggestion,
  isSelected,
  onSelect,
  onKeep,
  onDiscard,
}: CandidateCardProps) {
  const durationMinutes = calculateDuration(
    candidate.timeRange.startAt,
    candidate.timeRange.endAt,
  )

  const sourceCount = (candidate.sourceRefs ?? []).length
  const primaryCount = (candidate.sourceRefs ?? []).filter(
    (s) => s.contribution !== 'supporting',
  ).length
  const supportingCount = sourceCount - primaryCount

  const keepScore = suggestion?.keepScore ?? 0
  const scoreLabel =
    keepScore >= 70 ? 'High' :
    keepScore >= 40 ? 'Medium' :
    'Low'

  const scoreColor =
    keepScore >= 70 ? 'text-green-700' :
    keepScore >= 40 ? 'text-blue-700' :
    'text-red-700'

  return (
    <div
      onClick={onSelect}
      className={`
        bg-white border rounded-lg p-4 cursor-pointer transition-colors duration-200
        hover:shadow-md focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        ${isSelected
          ? 'border-teal-500 shadow-md ring-2 ring-teal-500 ring-offset-2'
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
      <div className="space-y-2">
        {/* Top row: Title + Duration badge */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-heading font-semibold text-sm text-slate-900 line-clamp-2 flex-1">
            {candidate.title}
          </h4>

          {/* Duration badge */}
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold bg-slate-100 text-slate-700">
              {formatDuration(durationMinutes)}
            </span>
          </div>
        </div>

        {/* Source count row */}
        <div className="flex items-center gap-2 text-xs font-body text-slate-600">
          <span>{sourceCount} pages</span>
          {primaryCount > 0 && supportingCount > 0 && (
            <>
              <span className="text-slate-400">•</span>
              <span className="text-green-700">{primaryCount} primary</span>
              <span className="text-blue-700">{supportingCount} supporting</span>
            </>
          )}
        </div>

        {/* Time range */}
        <p className="text-xs font-body text-slate-500">
          {formatTimeRange(candidate.timeRange.startAt, candidate.timeRange.endAt)}
        </p>

        {/* Bottom row: Theme + Keep Score */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Theme badge */}
          <div className="inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold bg-slate-100 text-slate-600">
            {candidate.theme}
          </div>

          {/* Keep Score */}
          {suggestion && typeof suggestion.keepScore === 'number' && (
            <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold bg-slate-50 ${scoreColor}`}>
              {scoreLabel} ({keepScore})
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onKeep()
            }}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors duration-200 focus:ring-2 focus:ring-green-500 focus:ring-offset-1 cursor-pointer"
            aria-label="Keep candidate"
            type="button"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDiscard()
            }}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-200 text-slate-700 hover:bg-red-600 hover:text-white transition-colors duration-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 cursor-pointer"
            aria-label="Discard candidate"
            type="button"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}