import { useMemo, useState } from 'react'
import ReviewActions from './ReviewActions'
import MetricGrid from './MetricGrid'
import CandidateList from './CandidateList'
import SelectedCandidate from './SelectedCandidate'
import ReviewGuidance from './ReviewGuidance'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useReviewWorkflow } from '../../hooks/useReviewWorkflow'

function getTodayDateString(): string {
  const today = new Date()
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today)
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

  const [reviewDate] = useState(getTodayDateString())

  const handleCreateCandidates = async () => {
    try {
      await createDailyCandidates(reviewDate)
    } catch (error) {
      // Error already handled by useReviewWorkflow
    }
  }

  const handleKeepCandidate = async () => {
    try {
      await reviewCandidateMemory('keep')
    } catch (error) {
      // Error already handled by useReviewWorkflow
    }
  }

  const handleDiscardCandidate = async () => {
    try {
      await reviewCandidateMemory('discard')
    } catch (error) {
      // Error already handled by useReviewWorkflow
    }
  }

  const selectedCandidate = getSelectedCandidate()
  const currentSuggestion = selectedCandidateId ? getReviewSuggestion(selectedCandidateId) : undefined

  return (
    <div>
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            feedback.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-700'
              : feedback.kind === 'error'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-blue-100 border-blue-300 text-blue-700'
          }`}
          role="alert"
        >
          <p className="font-body font-medium">{feedback.message}</p>
        </div>
      )}

      {/* Review Actions */}
      <ReviewActions
        onCreateCandidates={handleCreateCandidates}
        onKeepCandidate={handleKeepCandidate}
        onDiscardCandidate={handleDiscardCandidate}
        isCreatingCandidates={isCreatingCandidates}
        isReviewing={isReviewing}
        selectedCandidateId={selectedCandidateId}
      />

      {/* Metrics Grid */}
      <MetricGrid
        candidateCount={candidates.length}
        reviewWindowDate={reviewWindowDate ?? reviewDate}
        reviewWindowEventCount={reviewWindowEventCount}
      />

      {/* Three-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Candidate List */}
        <div className="lg:col-span-1">
          <div className="mb-3">
            <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
              Candidates
            </h2>
            <p className="font-body text-sm text-slate-600">
              {candidates.length} candidates generated
            </p>
          </div>
          <CandidateList
            candidates={candidates}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={selectCandidate}
            getReviewSuggestion={getReviewSuggestion}
          />
        </div>

        {/* Center Column: Selected Candidate */}
        <div className="lg:col-span-1">
          <div className="mb-3">
            <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
              Selected Candidate
            </h2>
            <p className="font-body text-sm text-slate-600">
              {selectedCandidateId ? 'Viewing details' : 'Select from list'}
            </p>
          </div>
          <SelectedCandidate candidate={selectedCandidate} />
        </div>

        {/* Right Column: Review Guidance */}
        <div className="lg:col-span-1">
          <div className="mb-3">
            <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
              AI Guidance
            </h2>
            <p className="font-body text-sm text-slate-600">
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
