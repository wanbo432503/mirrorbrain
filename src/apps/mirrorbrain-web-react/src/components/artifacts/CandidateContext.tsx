import Card from '../common/Card'
import type { ReviewedMemory } from '../../types/index'

interface CandidateContextProps {
  reviewedMemories: ReviewedMemory[]
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

        <div className="space-y-3 overflow-y-auto max-h-[400px]">
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

                {/* Reviewed At */}
                <p className="font-body text-xs text-slate-500">
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