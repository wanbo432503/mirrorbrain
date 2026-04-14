import { useState, useCallback } from 'react'
import type { SkillArtifact } from '../types/index'

interface SkillDraft {
  id?: string
  approvalState: 'draft' | 'approved'
  workflowEvidenceRefs: string[]
  executionSafetyMetadata: {
    requiresConfirmation: boolean
  }
}

export function useSkillDraft(initialDraft?: SkillArtifact) {
  const [draft, setDraft] = useState<SkillDraft | null>(
    initialDraft ? { ...initialDraft } : null
  )

  const updateDraft = useCallback((updates: Partial<SkillDraft>) => {
    setDraft((prev) => {
      if (!prev) return null
      return { ...prev, ...updates }
    })
  }, [])

  const setApprovalState = useCallback((approvalState: 'draft' | 'approved') => {
    updateDraft({ approvalState })
  }, [updateDraft])

  const setWorkflowEvidenceRefs = useCallback((refs: string[]) => {
    updateDraft({ workflowEvidenceRefs: refs })
  }, [updateDraft])

  const setRequiresConfirmation = useCallback((requiresConfirmation: boolean) => {
    setDraft((prev) => {
      if (!prev) return null
      return {
        ...prev,
        executionSafetyMetadata: {
          ...prev.executionSafetyMetadata,
          requiresConfirmation,
        },
      }
    })
  }, [])

  const resetDraft = useCallback((newDraft?: SkillArtifact) => {
    setDraft(newDraft ? { ...newDraft } : null)
  }, [])

  const clearDraft = useCallback(() => {
    setDraft(null)
  }, [])

  return {
    draft,
    updateDraft,
    setApprovalState,
    setWorkflowEvidenceRefs,
    setRequiresConfirmation,
    resetDraft,
    clearDraft,
  }
}