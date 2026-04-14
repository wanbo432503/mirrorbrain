import { useState, useCallback } from 'react'
import type { KnowledgeArtifact } from '../types/index'

interface KnowledgeDraft {
  id?: string
  draftState: 'draft' | 'published'
  artifactType?: 'daily-review-draft' | 'topic-merge-candidate' | 'topic-knowledge'
  topicKey?: string | null
  title?: string
  summary?: string
  body?: string
  sourceReviewedMemoryIds: string[]
  derivedFromKnowledgeIds?: string[]
  version?: number
  isCurrentBest?: boolean
  supersedesKnowledgeId?: string | null
  updatedAt?: string
  reviewedAt?: string | null
  recencyLabel?: string
}

export function useKnowledgeDraft(initialDraft?: KnowledgeArtifact) {
  const [draft, setDraft] = useState<KnowledgeDraft | null>(
    initialDraft ? { ...initialDraft } : null
  )

  const updateDraft = useCallback((updates: Partial<KnowledgeDraft>) => {
    setDraft((prev) => {
      if (!prev) return null
      return { ...prev, ...updates }
    })
  }, [])

  const setTitle = useCallback((title: string) => {
    updateDraft({ title })
  }, [updateDraft])

  const setSummary = useCallback((summary: string) => {
    updateDraft({ summary })
  }, [updateDraft])

  const setBody = useCallback((body: string) => {
    updateDraft({ body })
  }, [updateDraft])

  const setTopicKey = useCallback((topicKey: string | null) => {
    updateDraft({ topicKey })
  }, [updateDraft])

  const resetDraft = useCallback((newDraft?: KnowledgeArtifact) => {
    setDraft(newDraft ? { ...newDraft } : null)
  }, [])

  const clearDraft = useCallback(() => {
    setDraft(null)
  }, [])

  return {
    draft,
    updateDraft,
    setTitle,
    setSummary,
    setBody,
    setTopicKey,
    resetDraft,
    clearDraft,
  }
}