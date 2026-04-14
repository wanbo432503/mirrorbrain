import Card from '../common/Card'
import type { CandidateMemory } from '../../types/index'

interface SelectedCandidateProps {
  candidate: CandidateMemory | undefined
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export default function SelectedCandidate({ candidate }: SelectedCandidateProps) {
  if (!candidate) {
    return (
      <Card className="h-full">
        <div className="text-center py-12">
          <p className="font-heading font-semibold text-base text-slate-600 mb-2">
            No candidate selected
          </p>
          <p className="font-body text-sm text-slate-500">
            Click a candidate from the list to view details
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Title
          </p>
          <h3 className="font-heading font-bold text-lg text-slate-900">
            {candidate.title}
          </h3>
        </div>

        {/* Theme */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Theme
          </p>
          <div className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-heading font-semibold bg-blue-100 text-blue-700 border border-blue-300">
            {candidate.theme}
          </div>
        </div>

        {/* Time Range */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Time Range
          </p>
          <p className="font-body text-sm text-slate-900">
            {formatTimestamp(candidate.timeRange.startAt)} to{' '}
            {formatTimestamp(candidate.timeRange.endAt)}
          </p>
        </div>

        {/* Summary */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Summary
          </p>
          <p className="font-body text-sm text-slate-700 leading-relaxed">
            {candidate.summary}
          </p>
        </div>

        {/* Review State */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Review State
          </p>
          <div className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-heading font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">
            {candidate.reviewState}
          </div>
        </div>

        {/* Review Date */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Review Date
          </p>
          <p className="font-body text-sm text-slate-900">
            {formatTimestamp(candidate.reviewDate)}
          </p>
        </div>

        {/* Memory Event IDs */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Source Events
          </p>
          <p className="font-body text-sm text-slate-700">
            {candidate.memoryEventIds.length} events included
          </p>
        </div>
      </div>
    </Card>
  )
}