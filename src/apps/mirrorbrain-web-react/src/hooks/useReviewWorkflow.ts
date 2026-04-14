import { useState, useCallback } from 'react'
import { useMirrorBrain } from '../contexts/MirrorBrainContext'
import type { MirrorBrainWebAppApi } from '../api/client'
import type { CandidateReviewSuggestion, ReviewedMemory } from '../types/index'

interface ReviewFeedback {
  kind: 'success' | 'error' | 'info'
  message: string
}

export function useReviewWorkflow(api: MirrorBrainWebAppApi) {
  const { state, dispatch } = useMirrorBrain()
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [reviewSuggestions, setReviewSuggestions] = useState<CandidateReviewSuggestion[]>([])
  const [reviewedMemory, setReviewedMemory] = useState<ReviewedMemory | null>(null)
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null)
  const [isCreatingCandidates, setIsCreatingCandidates] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)

  const createDailyCandidates = useCallback(
    async (reviewDate: string, reviewTimeZone?: string) => {
      setIsCreatingCandidates(true)
      setFeedback(null)

      try {
        const candidates = await api.createDailyCandidates(reviewDate, reviewTimeZone)
        dispatch({ type: 'SET_CANDIDATES', payload: candidates })

        // Get review suggestions for all candidates
        const suggestions = await api.suggestCandidateReviews(candidates)
        setReviewSuggestions(suggestions)

        // Set review window info
        dispatch({
          type: 'SET_REVIEW_WINDOW',
          payload: { date: reviewDate, eventCount: candidates.length },
        })

        setFeedback({
          kind: 'success',
          message: `Created ${candidates.length} daily candidates`,
        })

        return candidates
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create candidates'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsCreatingCandidates(false)
      }
    },
    [api, dispatch]
  )

  const selectCandidate = useCallback((candidateId: string) => {
    setSelectedCandidateId(candidateId)
    setReviewedMemory(null)
  }, [])

  const reviewCandidateMemory = useCallback(
    async (decision: 'keep' | 'discard') => {
      if (!selectedCandidateId) {
        setFeedback({ kind: 'error', message: 'No candidate selected' })
        return
      }

      const candidate = state.candidateMemories.find((c) => c.id === selectedCandidateId)
      if (!candidate) {
        setFeedback({ kind: 'error', message: 'Candidate not found' })
        return
      }

      setIsReviewing(true)
      setFeedback(null)

      try {
        const reviewed = await api.reviewCandidateMemory(candidate, {
          decision,
          reviewedAt: new Date().toISOString(),
        })

        setReviewedMemory(reviewed)

        setFeedback({
          kind: 'success',
          message: `Candidate ${decision === 'keep' ? 'kept' : 'discarded'}`,
        })

        return reviewed
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to review candidate'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsReviewing(false)
      }
    },
    [api, selectedCandidateId, state.candidateMemories]
  )

  const getSelectedCandidate = useCallback(() => {
    return state.candidateMemories.find((c) => c.id === selectedCandidateId)
  }, [state.candidateMemories, selectedCandidateId])

  const getReviewSuggestion = useCallback(
    (candidateId: string) => {
      return reviewSuggestions.find((s) => s.candidateMemoryId === candidateId)
    },
    [reviewSuggestions]
  )

  const dismissFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  return {
    candidates: state.candidateMemories,
    selectedCandidateId,
    reviewSuggestions,
    reviewedMemory,
    feedback,
    isCreatingCandidates,
    isReviewing,
    createDailyCandidates,
    selectCandidate,
    reviewCandidateMemory,
    getSelectedCandidate,
    getReviewSuggestion,
    dismissFeedback,
  }
}