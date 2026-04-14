import Card from '../common/Card'
import type { CandidateReviewSuggestion, ReviewedMemory } from '../../types/index'

interface ReviewGuidanceProps {
  suggestion: CandidateReviewSuggestion | undefined
  reviewedMemory: ReviewedMemory | null
}

type CandidateSourceRef = {
  contribution?: 'primary' | 'supporting'
}

export function buildCandidateEvidenceSummary(
  sourceRefs: CandidateSourceRef[]
): string {
  const primaryCount = sourceRefs.filter((sourceRef) => sourceRef.contribution !== 'supporting').length
  const supportingCount = sourceRefs.filter((sourceRef) => sourceRef.contribution === 'supporting').length

  const primaryLabel = `${primaryCount} primary page${primaryCount === 1 ? '' : 's'}`
  const supportingLabel = `${supportingCount} supporting page${supportingCount === 1 ? '' : 's'}`

  return `Built from ${primaryLabel} and ${supportingLabel}.`
}

export default function ReviewGuidance({ suggestion, reviewedMemory }: ReviewGuidanceProps) {
  if (!suggestion && !reviewedMemory) {
    return (
      <Card className="h-full">
        <div className="text-center py-12">
          <p className="font-heading font-semibold text-base text-slate-600 mb-2">
            No guidance available
          </p>
          <p className="font-body text-sm text-slate-500">
            Select a candidate to see AI suggestions
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <div className="space-y-6">
        {/* AI Suggestion */}
        {suggestion && (
          <div>
            <h3 className="font-heading font-bold text-lg text-slate-900 mb-4 uppercase tracking-wide">
              AI Recommendation
            </h3>

            <div className="space-y-3">
              {/* Recommendation Badge */}
              <div
                className={`
                  inline-flex items-center px-3 py-2 rounded-md text-sm font-heading font-semibold border
                  ${suggestion.recommendation === 'keep'
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : suggestion.recommendation === 'discard'
                    ? 'bg-red-100 text-red-700 border-red-300'
                    : 'bg-blue-100 text-blue-700 border-blue-300'
                  }
                `}
              >
                {suggestion.recommendation.toUpperCase()}
              </div>

              {/* Confidence Score */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-heading font-semibold text-slate-600 uppercase">
                    Confidence
                  </p>
                  <p className="text-sm font-heading font-bold text-slate-900">
                    {Math.round(suggestion.confidenceScore * 100)}%
                  </p>
                </div>

                {/* Confidence Bar */}
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${suggestion.confidenceScore * 100}%` }}
                  />
                </div>
              </div>

              {/* Keep Score */}
              {typeof suggestion.keepScore === 'number' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-heading font-semibold text-slate-600 uppercase">
                      Keep Score
                    </p>
                    <p className="text-sm font-heading font-bold text-slate-900">
                      {Math.round(suggestion.keepScore)}%
                    </p>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, suggestion.keepScore))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Priority Score */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-heading font-semibold text-slate-600 uppercase">
                    Priority
                  </p>
                  <p className="text-sm font-heading font-bold text-slate-900">
                    {Math.round(suggestion.priorityScore * 100)}
                  </p>
                </div>
              </div>

              {/* Rationale */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-heading font-semibold text-slate-600 uppercase mb-2">
                  Rationale
                </p>
                <p className="font-body text-sm text-slate-700 leading-relaxed">
                  {suggestion.rationale}
                </p>
              </div>

              {suggestion.supportingReasons && suggestion.supportingReasons.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-heading font-semibold text-slate-600 uppercase mb-2">
                    Why This Candidate Exists
                  </p>
                  <ul className="space-y-2">
                    {suggestion.supportingReasons.map((reason) => (
                      <li key={reason} className="font-body text-sm text-slate-700 leading-relaxed">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {suggestion.evidenceSummary && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-heading font-semibold text-slate-600 uppercase mb-2">
                    Evidence Mix
                  </p>
                  <p className="font-body text-sm text-slate-700 leading-relaxed">
                    {suggestion.evidenceSummary}
                  </p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Reviewed Memory */}
        {reviewedMemory && (
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-heading font-bold text-lg text-slate-900 mb-4 uppercase tracking-wide">
              Reviewed Memory
            </h3>

            <div className="space-y-3">
              {/* Decision */}
              <div
                className={`
                  inline-flex items-center px-3 py-2 rounded-md text-sm font-heading font-semibold border
                  ${reviewedMemory.decision === 'keep'
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-red-100 text-red-700 border-red-300'
                  }
                `}
              >
                {reviewedMemory.decision.toUpperCase()}
              </div>

              {/* Candidate Title */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-heading font-semibold text-slate-600 uppercase mb-1">
                  Candidate
                </p>
                <p className="font-heading font-semibold text-sm text-slate-900">
                  {reviewedMemory.candidateTitle}
                </p>
              </div>

              {/* Reviewed At */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-heading font-semibold text-slate-600 uppercase mb-1">
                  Reviewed At
                </p>
                <p className="font-body text-sm text-slate-700">
                  {new Date(reviewedMemory.reviewedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
