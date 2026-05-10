import { useState, useCallback } from 'react'
import { useMirrorBrain } from '../contexts/MirrorBrainContext'
import type { MirrorBrainWebAppApi } from '../api/client'
import type { CandidateMemory, CandidateReviewSuggestion, ReviewedMemory } from '../types/index'

interface ReviewFeedback {
  kind: 'success' | 'error' | 'info'
  message: string
}

export function countCandidateReviewSources(candidates: CandidateMemory[]): number {
  const urls = new Set<string>()

  for (const candidate of candidates) {
    for (const source of candidate.sourceRefs ?? []) {
      const url = source.url?.trim()
      if (url && url.length > 0) {
        urls.add(url)
      }
    }
  }

  if (urls.size > 0) {
    return urls.size
  }

  return new Set(candidates.flatMap((candidate) => candidate.memoryEventIds)).size
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
        // Check if candidates already exist
        if (api.listCandidateMemoriesByDate) {
          const existingCandidates = await api.listCandidateMemoriesByDate(reviewDate)

          if (existingCandidates.length > 0) {
            dispatch({ type: 'SET_CANDIDATES', payload: existingCandidates })

            // Get review suggestions for all candidates
            const suggestions = await api.suggestCandidateReviews(existingCandidates)
            setReviewSuggestions(suggestions)

            // Set review window info
            dispatch({
              type: 'SET_REVIEW_WINDOW',
              payload: {
                date: reviewDate,
                eventCount: countCandidateReviewSources(existingCandidates),
              },
            })

            setFeedback({
              kind: 'info',
              message: 'Daily candidates already generated',
            })

            return existingCandidates
          }
        }

        // If no existing candidates, create new ones
        const candidates = await api.createDailyCandidates(reviewDate, reviewTimeZone)
        dispatch({ type: 'SET_CANDIDATES', payload: candidates })

        // Get review suggestions for all candidates
        const suggestions = await api.suggestCandidateReviews(candidates)
        setReviewSuggestions(suggestions)

        // Set review window info
        dispatch({
          type: 'SET_REVIEW_WINDOW',
          payload: {
            date: reviewDate,
            eventCount: countCandidateReviewSources(candidates),
          },
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
    async (decision: 'keep' | 'discard', candidateIdOverride?: string) => {
      const candidateId = candidateIdOverride ?? selectedCandidateId

      if (!candidateId) {
        setFeedback({ kind: 'error', message: 'No candidate selected' })
        return
      }

      const candidate = state.candidateMemories.find((c) => c.id === candidateId)
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

        // Update global state based on decision
        if (decision === 'keep') {
          // Add reviewed memory to global state
          dispatch({ type: 'ADD_REVIEWED_MEMORY', payload: reviewed })
        } else if (decision === 'discard') {
          // Remove candidate from global state
          dispatch({ type: 'REMOVE_CANDIDATE', payload: candidate.id })
        }

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
    [api, selectedCandidateId, state.candidateMemories, dispatch]
  )

  const undoCandidateReview = useCallback(
    async (reviewedMemoryId: string) => {
      setFeedback(null)

      try {
        await api.undoCandidateReview(reviewedMemoryId)

        // Remove from global state
        dispatch({ type: 'REMOVE_REVIEWED_MEMORY', payload: reviewedMemoryId })

        setFeedback({
          kind: 'success',
          message: 'Candidate review undone',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to undo review'
        setFeedback({ kind: 'error', message })
        throw error
      }
    },
    [api, dispatch]
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
    reviewWindowDate: state.reviewWindowDate,
    reviewWindowEventCount: state.reviewWindowEventCount,
    selectedCandidateId,
    reviewSuggestions,
    reviewedMemory,
    feedback,
    isCreatingCandidates,
    isReviewing,
    createDailyCandidates,
    selectCandidate,
    reviewCandidateMemory,
    undoCandidateReview,
    getSelectedCandidate,
    getReviewSuggestion,
    dismissFeedback,
  }
}
