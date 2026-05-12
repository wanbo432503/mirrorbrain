import { useState } from 'react'

import type { MirrorBrainWebAppApi } from '../../api/client'
import type {
  AnalysisWindowPreset,
  WorkSessionCandidate,
  WorkSessionAnalysisResult,
  WorkSessionReviewResult,
} from '../../types'

interface WorkSessionAnalysisPanelProps {
  api: MirrorBrainWebAppApi
}

const ANALYSIS_WINDOWS: Array<{
  label: string
  preset: AnalysisWindowPreset
}> = [
  { label: 'Last 6h', preset: 'last-6-hours' },
  { label: 'Last 24h', preset: 'last-24-hours' },
  { label: 'Last 7d', preset: 'last-7-days' },
]

function formatWindow(result: WorkSessionAnalysisResult): string {
  return `${result.analysisWindow.startAt} to ${result.analysisWindow.endAt}`
}

export default function WorkSessionAnalysisPanel({
  api,
}: WorkSessionAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<WorkSessionAnalysisResult | null>(null)
  const [runningPreset, setRunningPreset] = useState<AnalysisWindowPreset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectNames, setProjectNames] = useState<Record<string, string>>({})
  const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null)
  const [reviewResults, setReviewResults] = useState<
    Record<string, WorkSessionReviewResult>
  >({})

  const runAnalysis = async (preset: AnalysisWindowPreset) => {
    setRunningPreset(preset)
    setError(null)

    try {
      const result = await api.analyzeWorkSessions(preset)
      setAnalysis(result)
      setProjectNames(
        Object.fromEntries(
          result.candidates.map((candidate) => [
            candidate.id,
            candidate.projectHint,
          ])
        )
      )
      setReviewResults({})
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to analyze work sessions.'
      )
    } finally {
      setRunningPreset(null)
    }
  }

  const reviewCandidate = async (
    candidate: WorkSessionCandidate,
    decision: 'keep' | 'discard'
  ) => {
    setReviewingCandidateId(candidate.id)
    setError(null)

    try {
      const projectName = projectNames[candidate.id]?.trim() || candidate.projectHint
      const result = await api.reviewWorkSessionCandidate(candidate, {
        decision,
        reviewedBy: 'mirrorbrain-web',
        title: candidate.title,
        summary: candidate.summary,
        ...(decision === 'keep'
          ? {
              projectAssignment: {
                kind: 'confirmed-new-project' as const,
                name: projectName,
              },
            }
          : {}),
      })

      setReviewResults((current) => ({
        ...current,
        [candidate.id]: result,
      }))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to review work session.'
      )
    } finally {
      setReviewingCandidateId(null)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-md px-md pb-md">
      <header className="flex flex-wrap items-center justify-between gap-sm">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink">
            Work Sessions
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-inkMuted">
            Manual analysis windows turn imported memory into pending work-session candidates.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-xs">
          {ANALYSIS_WINDOWS.map((window) => (
            <button
              key={window.preset}
              type="button"
              className="h-9 min-w-20 rounded border border-slate-300 px-3 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-60"
              disabled={runningPreset !== null}
              onClick={() => void runAnalysis(window.preset)}
            >
              {runningPreset === window.preset ? 'Running' : window.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {analysis && (
        <div className="flex flex-wrap items-center gap-sm text-xs text-inkMuted">
          <span className="rounded border border-slate-200 px-2 py-1">
            {formatWindow(analysis)}
          </span>
          <span className="rounded border border-slate-200 px-2 py-1">
            {analysis.candidates.length} candidates
          </span>
          <span className="rounded border border-slate-200 px-2 py-1">
            {analysis.excludedMemoryEventIds.length} excluded
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!analysis && (
          <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-inkMuted">
            Select an analysis window to generate pending work-session candidates.
          </div>
        )}

        {analysis && analysis.candidates.length === 0 && (
          <div className="rounded border border-slate-200 px-4 py-8 text-center text-sm text-inkMuted">
            No work-session candidates found in this window.
          </div>
        )}

        {analysis && analysis.candidates.length > 0 && (
          <div className="grid gap-sm">
            {analysis.candidates.map((candidate) => (
              <article
                key={candidate.id}
                className="rounded border border-slate-200 bg-canvas px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div>
                    <h3 className="font-heading text-base font-semibold text-ink">
                      {candidate.title}
                    </h3>
                    <p className="mt-1 text-sm text-inkMuted">
                      {candidate.summary}
                    </p>
                  </div>
                  <span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                    {candidate.reviewState}
                  </span>
                </div>

                <dl className="mt-3 grid gap-2 text-sm text-inkMuted sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase text-inkMuted-80">Project</dt>
                    <dd className="font-medium text-ink">{candidate.projectHint}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-inkMuted-80">Sources</dt>
                    <dd className="font-medium text-ink">
                      {candidate.sourceTypes.join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-inkMuted-80">Provenance</dt>
                    <dd className="font-medium text-ink">
                      {candidate.memoryEventIds.length}{' '}
                      {candidate.memoryEventIds.length === 1
                        ? 'memory event'
                        : 'memory events'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-inkMuted-80">Range</dt>
                    <dd className="font-medium text-ink">
                      {candidate.timeRange.startAt} to {candidate.timeRange.endAt}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-end gap-sm border-t border-slate-200 pt-3">
                  <label className="grid gap-1 text-sm text-inkMuted">
                    <span>Project name</span>
                    <input
                      aria-label={`Project name for ${candidate.title}`}
                      className="h-9 w-56 rounded border border-slate-300 px-3 text-sm text-ink focus:border-primary focus:outline-none"
                      value={projectNames[candidate.id] ?? candidate.projectHint}
                      onChange={(event) =>
                        setProjectNames((current) => ({
                          ...current,
                          [candidate.id]: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="h-9 rounded border border-primary bg-primary px-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
                    disabled={reviewingCandidateId !== null}
                    onClick={() => void reviewCandidate(candidate, 'keep')}
                  >
                    {reviewingCandidateId === candidate.id ? 'Saving' : 'Keep as project'}
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded border border-slate-300 px-3 text-sm font-medium text-ink transition-colors hover:border-red-400 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
                    disabled={reviewingCandidateId !== null}
                    onClick={() => void reviewCandidate(candidate, 'discard')}
                  >
                    Discard
                  </button>

                  {reviewResults[candidate.id] && (
                    <span className="text-sm font-medium text-green-700">
                      {reviewResults[candidate.id].reviewedWorkSession.projectId
                        ? `Reviewed into project: ${reviewResults[candidate.id].reviewedWorkSession.projectId}`
                        : 'Discarded work session'}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
