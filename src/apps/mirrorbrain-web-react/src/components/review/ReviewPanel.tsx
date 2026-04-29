import { useEffect, useMemo, useState } from 'react'
import ReviewActions from './ReviewActions'
import MetricGrid from './MetricGrid'
import CandidateList from './CandidateList'
import SelectedCandidate from './SelectedCandidate'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useReviewWorkflow } from '../../hooks/useReviewWorkflow'
import { useArtifacts } from '../../hooks/useArtifacts'
import { useMirrorBrain } from '../../contexts/MirrorBrainContext'

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

export function shouldAutoLoadDailyCandidates(input: {
  hasAutoLoaded: boolean
  candidateCount: number
  hasLoadedMemoryEvents: boolean
}) {
  return !input.hasAutoLoaded && input.candidateCount === 0 && input.hasLoadedMemoryEvents
}

export default function ReviewPanel() {
  const { state, dispatch } = useMirrorBrain()
  const knowledgeDraft = state.knowledgeDraft
  const skillDraft = state.skillDraft
  const api: MirrorBrainWebAppApi = useMemo(
    () => createMirrorBrainBrowserApi(window.location.origin),
    []
  )

  const {
    candidates,
    reviewWindowDate,
    reviewWindowEventCount,
    selectedCandidateId,
    feedback: workflowFeedback,
    isCreatingCandidates,
    isReviewing,
    createDailyCandidates,
    selectCandidate,
    reviewCandidateMemory,
    undoCandidateReview,
    getSelectedCandidate,
    getReviewSuggestion,
  } = useReviewWorkflow(api)

  const {
    isGeneratingKnowledge,
    isRegeneratingKnowledge,
    isApprovingKnowledge,
    isGeneratingSkill,
    isSavingKnowledge,
    isSavingSkill,
    generateKnowledge,
    regenerateKnowledge,
    approveKnowledge,
    generateSkill,
    saveKnowledgeArtifact,
    saveSkillArtifact,
  } = useArtifacts(api)

  const [reviewDate] = useState(getDefaultReviewDate())
  const [reviewTimeZone] = useState(getLocalTimeZone())
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false)
  const [keptCandidateIds, setKeptCandidateIds] = useState<Set<string>>(new Set())
  const [viewingMode, setViewingMode] = useState<'detail' | 'kept-list' | 'knowledge-draft' | 'skill-draft'>('detail')
  const [approvalFeedback, setApprovalFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  // Filter out kept candidates from main list
  const unreviewedCandidates = useMemo(() => {
    return candidates.filter(c => !keptCandidateIds.has(c.id))
  }, [candidates, keptCandidateIds])

  // Get kept candidates data from reviewed memories
  const keptCandidates = useMemo(() => {
    return state.reviewedMemories.filter(r =>
      r.decision === 'keep' && keptCandidateIds.has(r.candidateMemoryId)
    )
  }, [state.reviewedMemories, keptCandidateIds])

  // Auto-load daily candidates when entering review tab
  useEffect(() => {
    if (
      !shouldAutoLoadDailyCandidates({
        hasAutoLoaded,
        candidateCount: candidates.length,
        hasLoadedMemoryEvents: state.hasLoadedMemoryEvents,
      })
    ) {
      return
    }

    setHasAutoLoaded(true)
    createDailyCandidates(reviewDate, reviewTimeZone).catch(() => {
      // Error already handled by useReviewWorkflow
    })
  }, [
    hasAutoLoaded,
    candidates.length,
    state.hasLoadedMemoryEvents,
    createDailyCandidates,
    reviewDate,
    reviewTimeZone,
  ])

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

      // Add to kept set
      setKeptCandidateIds(prev => new Set([...prev, candidateId]))

      // Switch to kept-list view
      setViewingMode('kept-list')
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

  const handleGenerateKnowledge = async () => {
    setApprovalFeedback(null) // Clear approval feedback when starting new operation
    try {
      const artifact = await generateKnowledge(keptCandidates)
      dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: artifact })
      setViewingMode('knowledge-draft')
    } catch (error) {
      // Error already handled by useArtifacts
    }
  }

  const handleRegenerateKnowledge = async () => {
    if (!knowledgeDraft || !regenerateKnowledge) return
    setApprovalFeedback(null) // Clear approval feedback when starting new operation
    try {
      const artifact = await regenerateKnowledge(knowledgeDraft, keptCandidates)
      if (artifact) {
        dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: artifact })
      }
    } catch (error) {
      // Error handled by useArtifacts
    }
  }

  const handleApproveKnowledge = async () => {
    if (!knowledgeDraft?.id || !approveKnowledge) return

    setApprovalFeedback(null) // Clear previous approval feedback
    try {
      const result = await approveKnowledge(knowledgeDraft)
      if (result) {
        // Knowledge approve succeeded - primary operation

        // Extract candidate IDs from sourceReviewedMemoryIds
        const sourceReviewedIds = knowledgeDraft.sourceReviewedMemoryIds || []
        const candidateIds = sourceReviewedIds
          .map(id => id.replace(/^reviewed:/, 'candidate:'))
          .filter(id => id.startsWith('candidate:')) // Validate conversion result

        // Batch delete candidates
        const deletionErrors: Array<{ candidateId: string; error: Error }> = []
        for (const candidateId of candidateIds) {
          try {
            await api.deleteCandidateMemory(candidateId)
            dispatch({ type: 'REMOVE_CANDIDATE', payload: candidateId })
            // Also remove from keptCandidateIds to update filtered list
            setKeptCandidateIds(prev => {
              const next = new Set(prev)
              next.delete(candidateId)
              return next
            })
          } catch (error) {
            deletionErrors.push({ candidateId, error: error as Error })
          }
        }

        // Show feedback
        if (deletionErrors.length > 0) {
          setApprovalFeedback({
            kind: 'error',
            message: `Knowledge approved, but ${deletionErrors.length} candidate deletion(s) failed`
          })
        } else {
          setApprovalFeedback({
            kind: 'success',
            message: 'Knowledge approved and candidates deleted'
          })
        }

        // Clear draft state
        dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: null })
        dispatch({ type: 'CLEAR_KEPT_REVIEWED_MEMORIES' })
        setViewingMode('kept-list')
      }
    } catch (error) {
      // Approve failed - no deletion attempt
      setApprovalFeedback({ kind: 'error', message: 'Knowledge approval failed' })
    }
  }

  const handleSaveKnowledge = async () => {
    if (!knowledgeDraft) return
    try {
      await saveKnowledgeArtifact(knowledgeDraft)
    } catch (error) {
      // Error handled by useArtifacts
    }
  }

  const handleKnowledgeTitleChange = (title: string) => {
    if (!knowledgeDraft) return
    dispatch({
      type: 'SET_KNOWLEDGE_DRAFT',
      payload: { ...knowledgeDraft, title }
    })
  }

  const handleKnowledgeSummaryChange = (summary: string) => {
    if (!knowledgeDraft) return
    dispatch({
      type: 'SET_KNOWLEDGE_DRAFT',
      payload: { ...knowledgeDraft, summary }
    })
  }

  const handleKnowledgeBodyChange = (body: string) => {
    if (!knowledgeDraft) return
    dispatch({
      type: 'SET_KNOWLEDGE_DRAFT',
      payload: { ...knowledgeDraft, body }
    })
  }

  const handleGenerateSkill = async () => {
    setApprovalFeedback(null) // Clear approval feedback when starting new operation
    try {
      const artifact = await generateSkill(keptCandidates)
      dispatch({ type: 'SET_SKILL_DRAFT', payload: artifact })
      setViewingMode('skill-draft')
    } catch (error) {
      // Error handled by useArtifacts
    }
  }

  const handleSaveSkill = async () => {
    if (!skillDraft) return
    try {
      await saveSkillArtifact(skillDraft)
    } catch (error) {
      // Error handled by useArtifacts
    }
  }

  const handleSkillApprovalStateChange = (approvalState: 'draft' | 'approved') => {
    if (!skillDraft) return
    dispatch({
      type: 'SET_SKILL_DRAFT',
      payload: { ...skillDraft, approvalState }
    })
  }

  const handleSkillRequiresConfirmationChange = (requiresConfirmation: boolean) => {
    if (!skillDraft) return
    dispatch({
      type: 'SET_SKILL_DRAFT',
      payload: {
        ...skillDraft,
        executionSafetyMetadata: { requiresConfirmation }
      }
    })
  }

  const handleUndoKeep = async (reviewedMemoryId: string) => {
    try {
      await undoCandidateReview(reviewedMemoryId)

      // Extract candidate ID from reviewed memory ID
      const candidateId = reviewedMemoryId.replace(/^reviewed:/, '')

      // Remove from kept set
      setKeptCandidateIds(prev => {
        const next = new Set(prev)
        next.delete(candidateId)
        return next
      })

      // If no kept candidates left, switch back to detail view
      if (keptCandidateIds.size === 1) {
        setViewingMode('detail')
      }
    } catch (error) {
      // Error already handled by useReviewWorkflow
    }
  }

  const handleSelectCandidate = (candidateId: string) => {
    selectCandidate(candidateId)
    setViewingMode('detail')
  }

  const selectedCandidate = getSelectedCandidate()

  // Display approval feedback if present, otherwise workflow feedback
  const displayFeedback = approvalFeedback || workflowFeedback

  return (
    <div>
      {/* Feedback Banner */}
      {displayFeedback && (
        <div
          className={`mb-3 p-3 rounded-lg border ${
            displayFeedback.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-700'
              : displayFeedback.kind === 'error'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-blue-100 border-blue-300 text-blue-700'
          }`}
          role="alert"
        >
          <p className="font-body font-medium text-sm">{displayFeedback.message}</p>
        </div>
      )}

      {!state.hasLoadedMemoryEvents && (
        <div
          className="mb-3 p-3 rounded-lg border bg-blue-100 border-blue-300 text-blue-700"
          role="status"
        >
          <p className="font-body font-medium text-sm">
            Waiting for memory to finish loading before generating daily candidates.
          </p>
        </div>
      )}

      {/* Review Actions */}
      <ReviewActions
        onCreateCandidates={handleCreateCandidates}
        isCreatingCandidates={isCreatingCandidates}
        isReviewing={isReviewing}
      />

      {/* Metrics Grid */}
      <MetricGrid
        candidateCount={candidates.length}
        reviewWindowDate={reviewWindowDate ?? reviewDate}
        reviewWindowEventCount={reviewWindowEventCount}
      />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column: Candidate List */}
        <div className="lg:col-span-1">
          <div className="mb-2">
            <h2 className="font-heading font-bold text-xs text-slate-900 uppercase tracking-wide">
              Candidates
            </h2>
            <p className="font-body text-xs text-slate-600">
              {unreviewedCandidates.length} candidates generated
            </p>
          </div>
          <CandidateList
            candidates={unreviewedCandidates}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={handleSelectCandidate}
            onKeepCandidate={handleKeepCandidate}
            onDiscardCandidate={handleDiscardCandidate}
            getReviewSuggestion={getReviewSuggestion}
          />
        </div>

        {/* Right Column: Selected Candidate */}
        <div className="lg:col-span-2">
          <div className="mb-2">
            <h2 className="font-heading font-bold text-xs text-slate-900 uppercase tracking-wide">
              {viewingMode === 'kept-list' ? 'Kept Candidates' : 'Selected Candidate'}
            </h2>
            <p className="font-body text-xs text-slate-600">
              {viewingMode === 'kept-list'
                ? `${keptCandidates.length} candidates kept`
                : selectedCandidateId
                ? 'Viewing details'
                : 'Select from list'}
            </p>
          </div>
          <SelectedCandidate
            candidate={selectedCandidate}
            viewingMode={viewingMode}
            keptCandidates={keptCandidates}
            onUndoKeep={handleUndoKeep}
            knowledgeDraft={knowledgeDraft}
            skillDraft={skillDraft}
            onGenerateKnowledge={handleGenerateKnowledge}
            onGenerateSkill={handleGenerateSkill}
            onRegenerateKnowledge={handleRegenerateKnowledge}
            onApproveKnowledge={handleApproveKnowledge}
            onSaveKnowledge={handleSaveKnowledge}
            onSaveSkill={handleSaveSkill}
            isGeneratingKnowledge={isGeneratingKnowledge}
            isGeneratingSkill={isGeneratingSkill}
            isRegeneratingKnowledge={isRegeneratingKnowledge}
            isApprovingKnowledge={isApprovingKnowledge}
            isSavingKnowledge={isSavingKnowledge}
            isSavingSkill={isSavingSkill}
            onKnowledgeTitleChange={handleKnowledgeTitleChange}
            onKnowledgeSummaryChange={handleKnowledgeSummaryChange}
            onKnowledgeBodyChange={handleKnowledgeBodyChange}
            onSkillApprovalStateChange={handleSkillApprovalStateChange}
            onSkillRequiresConfirmationChange={handleSkillRequiresConfirmationChange}
          />
        </div>
      </div>
    </div>
  )
}
