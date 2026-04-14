import Card from '../common/Card'
import type { CandidateMemory } from '../../types/index'

interface SelectedCandidateProps {
  candidate: CandidateMemory | undefined
}

type CandidateSourceRef = NonNullable<CandidateMemory['sourceRefs']>[number]

export function formatCandidateDuration(startAt: string, endAt: string): string {
  const durationMs = new Date(endAt).getTime() - new Date(startAt).getTime()

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 'Under 1 minute'
  }

  const durationMinutes = Math.max(1, Math.round(durationMs / (60 * 1000)))

  if (durationMinutes < 60) {
    return `${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`
  }

  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60

  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }

  return `${hours}h ${minutes}m`
}

export function splitCandidateSourcesByContribution(
  sourceRefs: CandidateSourceRef[]
): {
  primary: CandidateSourceRef[]
  supporting: CandidateSourceRef[]
} {
  return sourceRefs.reduce(
    (groups, sourceRef) => {
      if (sourceRef.contribution === 'supporting') {
        groups.supporting.push(sourceRef)
      } else {
        groups.primary.push(sourceRef)
      }

      return groups
    },
    {
      primary: [] as CandidateSourceRef[],
      supporting: [] as CandidateSourceRef[],
    }
  )
}

export function getCandidateFormationReasons(
  candidate: Pick<CandidateMemory, 'formationReasons'>
): string[] {
  if (candidate.formationReasons && candidate.formationReasons.length > 0) {
    return candidate.formationReasons
  }

  return [
    'This candidate was formed from related browser activity in the selected review window.',
  ]
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

  const { primary, supporting } = splitCandidateSourcesByContribution(
    candidate.sourceRefs ?? []
  )
  const formationReasons = getCandidateFormationReasons(candidate)

  const renderSourceGroup = (
    label: string,
    sources: CandidateSourceRef[],
    emptyMessage: string
  ) => (
    <div>
      <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-2">
        {label}
      </p>
      {sources.length === 0 ? (
        <p className="font-body text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <div key={source.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-sm font-medium text-slate-900">
                    {source.title ?? source.url ?? source.id}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {source.role && (
                      <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-1 text-[11px] font-heading font-semibold uppercase tracking-wide text-slate-700">
                        {source.role}
                      </span>
                    )}
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {source.url}
                      </a>
                    )}
                  </div>
                </div>
                <p className="shrink-0 text-xs text-slate-500">
                  {formatTimestamp(source.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

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
          <p className="font-body text-xs text-slate-600 mt-1">
            Duration: {formatCandidateDuration(candidate.timeRange.startAt, candidate.timeRange.endAt)}
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

        {/* Formation Reasons */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Why This Candidate Exists
          </p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {formationReasons.map((reason) => (
              <p key={reason} className="font-body text-sm text-slate-700 leading-relaxed">
                {reason}
              </p>
            ))}
          </div>
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

        {/* Visited URLs */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Visited URLs
          </p>
          <div className="space-y-4">
            {renderSourceGroup(
              'Primary Sources',
              primary,
              'No primary sources identified.'
            )}
            {renderSourceGroup(
              'Supporting Sources',
              supporting,
              'No supporting sources identified.'
            )}
            {(candidate.sourceRefs ?? []).length === 0 && (
              <p className="font-body text-sm text-slate-700">
                {candidate.memoryEventIds.length} events included
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
