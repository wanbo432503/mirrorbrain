import { useEffect, useMemo, useState } from 'react'
import ReviewActions from './ReviewActions'
import MetricGrid from './MetricGrid'
import CandidateList from './CandidateList'
import SelectedCandidate from './SelectedCandidate'
import ReviewGuidance from './ReviewGuidance'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useReviewWorkflow } from '../../hooks/useReviewWorkflow'

export function getDefaultReviewDate(now: Date = new Date()): string {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(yesterday)
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export default function ReviewPanel() {
  const api: MirrorBrainWebAppApi = useMemo(
    () => createMirrorBrainBrowserApi(window.location.origin),
    []
  )

  const {
    candidates,
    reviewWindowDate,
    reviewWindowEventCount,
    selectedCandidateId,
    reviewedMemory,
    feedback,
    isCreatingCandidates,
    isReviewing,
    createDailyCandidates,
    selectCandidate,
    reviewCandidateMemory,
    getSelectedCandidate,
    getReviewSuggestion,
  } = useReviewWorkflow(api)

  const [reviewDate] = useState(getDefaultReviewDate())
  const [reviewTimeZone] = useState(getLocalTimeZone())
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false)

  // Auto-load daily candidates when entering review tab
  useEffect(() => {
    if (!hasAutoLoaded && candidates.length === 0) {
      setHasAutoLoaded(true)
      createDailyCandidates(reviewDate, reviewTimeZone).catch(() => {
        // Error already handled by useReviewWorkflow
      })
    }
  }, [hasAutoLoaded, candidates.length, createDailyCandidates, reviewDate, reviewTimeZone])

  const handleCreateCandidates = async () => {
    try {
      await createDailyCandidates(reviewDate, reviewTimeZone)
    } catch (error) {
      // Error already handled by useReviewWorkflow
    }
  }

  const handleKeepCandidate = async (candidateId: string) => {
    try {
      selectCandidate(candidateId)
      await reviewCandidateMemory('keep')
    } catch (error) {
      // Error already handled by useReviewWorkflow
    }
  }

  const handleDiscardCandidate = async (candidateId: string) => {
    try {
      selectCandidate(candidateId)
      await reviewCandidateMemory('discard')
    } catch (error) {
      // Error already handled by useReviewWorkflow
    }
  }

  const selectedCandidate = getSelectedCandidate()
  const currentSuggestion = selectedCandidateId ? getReviewSuggestion(selectedCandidateId) : undefined

  return (
    <div>
      {/* Review Actions with Inline Feedback */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0">
          <ReviewActions
            onCreateCandidates={handleCreateCandidates}
            isCreatingCandidates={isCreatingCandidates}
            isReviewing={isReviewing}
          />
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`flex-1 px-3 py-1.5 rounded-lg border ${
              feedback.kind === 'success'
                ? 'bg-green-100 border-green-300 text-green-700'
                : feedback.kind === 'error'
                ? 'bg-red-100 border-red-300 text-red-700'
                : 'bg-blue-100 border-blue-300 text-blue-700'
            }`}
            role="alert"
          >
            <p className="font-body font-medium text-xs">{feedback.message}</p>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <MetricGrid
        candidateCount={candidates.length}
        reviewWindowDate={reviewWindowDate ?? reviewDate}
        reviewWindowEventCount={reviewWindowEventCount}
      />

      {/* Three-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column: Candidate List */}
        <div className="lg:col-span-1">
          <div className="mb-2">
            <h2 className="font-heading font-bold text-xs text-slate-900 uppercase tracking-wide">
              Candidates
            </h2>
            <p className="font-body text-xs text-slate-600">
              {candidates.length} candidates generated
            </p>
          </div>
          <CandidateList
            candidates={candidates}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={selectCandidate}
            onKeepCandidate={handleKeepCandidate}
            onDiscardCandidate={handleDiscardCandidate}
            getReviewSuggestion={getReviewSuggestion}
          />
        </div>

        {/* Center Column: Selected Candidate */}
        <div className="lg:col-span-1">
          <div className="mb-2">
            <h2 className="font-heading font-bold text-xs text-slate-900 uppercase tracking-wide">
              Selected Candidate
            </h2>
            <p className="font-body text-xs text-slate-600">
              {selectedCandidateId ? 'Viewing details' : 'Select from list'}
            </p>
          </div>
          <SelectedCandidate candidate={selectedCandidate} />
        </div>

        {/* Right Column: Review Guidance */}
        <div className="lg:col-span-1">
          <div className="mb-2">
            <h2 className="font-heading font-bold text-xs text-slate-900 uppercase tracking-wide">
              AI Guidance
            </h2>
            <p className="font-body text-xs text-slate-600">
              Suggestions and reviewed memory
            </p>
          </div>
          <ReviewGuidance
            suggestion={currentSuggestion}
            reviewedMemory={reviewedMemory}
          />
        </div>
      </div>
    </div>
  )
}
