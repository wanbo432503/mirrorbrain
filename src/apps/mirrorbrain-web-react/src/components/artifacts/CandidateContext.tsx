import Card from '../common/Card'
import type { ReviewedMemory } from '../../types/index'

interface CandidateContextProps {
  reviewedMemories: ReviewedMemory[]
}

function formatTimeRange(startAt: string, endAt: string): string {
  const startDate = new Date(startAt)
  const endDate = new Date(endAt)
  const startTime = startDate.toTimeString().slice(0, 5)
  const endTime = endDate.toTimeString().slice(0, 5)
  return `${startTime} - ${endTime}`
}

function calculateDurationMinutes(startAt: string, endAt: string): number {
  const startDate = new Date(startAt)
  const endDate = new Date(endAt)
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000)
}

export default function CandidateContext({ reviewedMemories }: CandidateContextProps) {
  if (reviewedMemories.length === 0) {
    return (
      <Card className="h-full">
        <div className="text-center py-12">
          <p className="font-heading font-semibold text-base text-slate-600 mb-2">
            No reviewed memories
          </p>
          <p className="font-body text-sm text-slate-500">
            Review candidates from the Review tab first
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <div className="space-y-4">
        <h3 className="font-heading font-bold text-lg text-slate-900 uppercase tracking-wide">
          Reviewed Memories
        </h3>

        <div className="space-y-3 overflow-y-auto max-h-[600px]">
          {reviewedMemories.map((memory) => (
            <div
              key={memory.id}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3"
            >
              <div className="space-y-2">
                {/* Title */}
                <h4 className="font-heading font-semibold text-sm text-slate-900">
                  {memory.candidateTitle}
                </h4>

                {/* Decision Badge */}
                <div
                  className={`
                    inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold border
                    ${memory.decision === 'keep'
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-red-100 text-red-700 border-red-300'
                    }
                  `}
                >
                  {memory.decision.toUpperCase()}
                </div>

                {/* Theme */}
                <p className="font-body text-xs text-slate-600">
                  {memory.candidateTheme}
                </p>

                {/* Time Range and Duration */}
                {memory.candidateTimeRange && (
                  <div className="mt-2 text-xs font-body text-slate-600">
                    <p>
                      <span className="font-semibold">Time:</span> {formatTimeRange(
                        memory.candidateTimeRange.startAt,
                        memory.candidateTimeRange.endAt,
                      )}
                    </p>
                    <p>
                      <span className="font-semibold">Duration:</span> {calculateDurationMinutes(
                        memory.candidateTimeRange.startAt,
                        memory.candidateTimeRange.endAt,
                      )} minutes
                    </p>
                  </div>
                )}

                {/* Formation Reasons */}
                {memory.candidateFormationReasons && memory.candidateFormationReasons.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-heading font-semibold text-slate-700 mb-1">
                      Captured because:
                    </p>
                    <ul className="text-xs font-body text-slate-600 space-y-1">
                      {memory.candidateFormationReasons.map((reason, index) => (
                        <li key={index} className="flex items-start">
                          <span className="mr-1">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Source References */}
                {memory.candidateSourceRefs && memory.candidateSourceRefs.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-heading font-semibold text-slate-700 mb-1">
                      Sources ({memory.candidateSourceRefs.length}):
                    </p>
                    <div className="space-y-1">
                      {memory.candidateSourceRefs.slice(0, 5).map((source) => (
                        <div key={source.id} className="text-xs font-body">
                          <div className="flex items-start">
                            <span className="mr-1">•</span>
                            <div>
                              <p className="text-slate-700">
                                {source.title ?? 'Untitled'}
                                {source.contribution === 'primary' && (
                                  <span className="ml-1 text-green-600 font-semibold">(primary)</span>
                                )}
                                {source.contribution === 'supporting' && (
                                  <span className="ml-1 text-blue-600 font-semibold">(supporting)</span>
                                )}
                              </p>
                              {source.url && (
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-500 hover:text-slate-700 underline break-all"
                                >
                                  {source.url}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {memory.candidateSourceRefs.length > 5 && (
                        <p className="text-xs font-body text-slate-500 italic">
                          +{memory.candidateSourceRefs.length - 5} more sources
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Reviewed At */}
                <p className="font-body text-xs text-slate-500 mt-2">
                  {new Date(memory.reviewedAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <p className="text-sm font-body text-blue-700">
            {reviewedMemories.length} reviewed memories selected for artifact generation
          </p>
        </div>
      </div>
    </Card>
  )
}