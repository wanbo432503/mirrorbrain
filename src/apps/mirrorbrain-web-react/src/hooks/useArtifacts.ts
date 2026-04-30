import { useState, useCallback } from 'react'
import { useMirrorBrain } from '../contexts/MirrorBrainContext'
import type { MirrorBrainWebAppApi } from '../api/client'
import type { KnowledgeArtifact, SkillArtifact, ReviewedMemory } from '../types/index'

interface ArtifactsFeedback {
  kind: 'success' | 'error' | 'info'
  message: string
}

function upsertArtifactById<T extends { id: string }>(items: T[], item: T): T[] {
  const existingIndex = items.findIndex((current) => current.id === item.id)

  if (existingIndex === -1) {
    return [...items, item]
  }

  const nextItems = [...items]
  nextItems[existingIndex] = item
  return nextItems
}

export function useArtifacts(api: MirrorBrainWebAppApi) {
  const { state, dispatch } = useMirrorBrain()
  const [feedback, setFeedback] = useState<ArtifactsFeedback | null>(null)
  const [isGeneratingKnowledge, setIsGeneratingKnowledge] = useState(false)
  const [isRegeneratingKnowledge, setIsRegeneratingKnowledge] = useState(false)
  const [isApprovingKnowledge, setIsApprovingKnowledge] = useState(false)
  const [isGeneratingSkill, setIsGeneratingSkill] = useState(false)
  const [isSavingKnowledge, setIsSavingKnowledge] = useState(false)
  const [isSavingSkill, setIsSavingSkill] = useState(false)
  const [isDeletingKnowledge, setIsDeletingKnowledge] = useState(false)
  const [isDeletingSkill, setIsDeletingSkill] = useState(false)

  const generateKnowledge = useCallback(
    async (reviewedMemories: ReviewedMemory[]) => {
      setIsGeneratingKnowledge(true)
      setFeedback(null)

      try {
        const artifact = await api.generateKnowledge(reviewedMemories)
        const savedArtifact = api.saveKnowledgeArtifact
          ? await api.saveKnowledgeArtifact(artifact)
          : artifact

        const updatedKnowledge = upsertArtifactById(
          state.knowledgeArtifacts,
          savedArtifact
        )
        dispatch({ type: 'LOAD_KNOWLEDGE', payload: updatedKnowledge })

        setFeedback({
          kind: 'success',
          message: api.saveKnowledgeArtifact
            ? 'Knowledge artifact generated and saved successfully'
            : 'Knowledge artifact generated successfully',
        })

        return savedArtifact
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate knowledge'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsGeneratingKnowledge(false)
      }
    },
    [api, state.knowledgeArtifacts, dispatch]
  )

  const regenerateKnowledge = useCallback(
    async (existingDraft: KnowledgeArtifact, reviewedMemories: ReviewedMemory[]) => {
      if (!api.regenerateKnowledge) {
        setFeedback({ kind: 'error', message: 'Regenerate knowledge API not available' })
        return null
      }

      setIsRegeneratingKnowledge(true)
      setFeedback(null)

      try {
        const artifact = await api.regenerateKnowledge(existingDraft, reviewedMemories)
        const savedArtifact = api.saveKnowledgeArtifact
          ? await api.saveKnowledgeArtifact(artifact)
          : artifact

        const updatedKnowledge = upsertArtifactById(
          state.knowledgeArtifacts,
          savedArtifact
        )
        dispatch({ type: 'LOAD_KNOWLEDGE', payload: updatedKnowledge })

        setFeedback({
          kind: 'success',
          message: api.saveKnowledgeArtifact
            ? 'Knowledge artifact regenerated and saved successfully'
            : 'Knowledge artifact regenerated successfully',
        })

        return savedArtifact
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to regenerate knowledge'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsRegeneratingKnowledge(false)
      }
    },
    [api, state.knowledgeArtifacts, dispatch]
  )

  const approveKnowledge = useCallback(
    async (draft: KnowledgeArtifact) => {
      if (!api.approveKnowledge) {
        setFeedback({ kind: 'error', message: 'Approve knowledge API not available' })
        return null
      }

      setIsApprovingKnowledge(true)
      setFeedback(null)

      try {
        const { publishedArtifact, assignedTopic } = await api.approveKnowledge(draft)

        // Update knowledge artifacts list in global state
        const updatedKnowledge = upsertArtifactById(
          state.knowledgeArtifacts,
          publishedArtifact
        )
        dispatch({ type: 'LOAD_KNOWLEDGE', payload: updatedKnowledge })

        // Note: Candidate deletion and state clearing will be handled by ReviewPanel
        // after this approve call succeeds

        return { publishedArtifact, assignedTopic }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to approve knowledge'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsApprovingKnowledge(false)
      }
    },
    [api, state.knowledgeArtifacts, dispatch]
  )

  const generateSkill = useCallback(
    async (reviewedMemories: ReviewedMemory[]) => {
      setIsGeneratingSkill(true)
      setFeedback(null)

      try {
        const artifact = await api.generateSkill(reviewedMemories)
        const savedArtifact = api.saveSkillArtifact
          ? await api.saveSkillArtifact(artifact)
          : artifact

        const updatedSkills = upsertArtifactById(state.skillArtifacts, savedArtifact)
        dispatch({ type: 'LOAD_SKILLS', payload: updatedSkills })

        setFeedback({
          kind: 'success',
          message: api.saveSkillArtifact
            ? 'Skill artifact generated and saved successfully'
            : 'Skill artifact generated successfully',
        })

        return savedArtifact
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate skill'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsGeneratingSkill(false)
      }
    },
    [api, state.skillArtifacts, dispatch]
  )

  const saveKnowledgeArtifact = useCallback(
    async (artifact: KnowledgeArtifact) => {
      if (!api.saveKnowledgeArtifact) {
        setFeedback({ kind: 'error', message: 'Save knowledge API not available' })
        return
      }

      setIsSavingKnowledge(true)
      setFeedback(null)

      try {
        const savedArtifact = await api.saveKnowledgeArtifact(artifact)

        // Update knowledge artifacts list in global state
        const updatedKnowledge = upsertArtifactById(
          state.knowledgeArtifacts,
          savedArtifact
        )
        dispatch({ type: 'LOAD_KNOWLEDGE', payload: updatedKnowledge })

        setFeedback({
          kind: 'success',
          message: 'Knowledge artifact saved successfully',
        })

        return savedArtifact
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save knowledge'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsSavingKnowledge(false)
      }
    },
    [api, state.knowledgeArtifacts, dispatch]
  )

  const saveSkillArtifact = useCallback(
    async (artifact: SkillArtifact) => {
      if (!api.saveSkillArtifact) {
        setFeedback({ kind: 'error', message: 'Save skill API not available' })
        return
      }

      setIsSavingSkill(true)
      setFeedback(null)

      try {
        const savedArtifact = await api.saveSkillArtifact(artifact)

        // Update skill artifacts list in global state
        const updatedSkills = upsertArtifactById(state.skillArtifacts, savedArtifact)
        dispatch({ type: 'LOAD_SKILLS', payload: updatedSkills })

        setFeedback({
          kind: 'success',
          message: 'Skill artifact saved successfully',
        })

        return savedArtifact
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save skill'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsSavingSkill(false)
      }
    },
    [api, state.skillArtifacts, dispatch]
  )

  const deleteKnowledgeArtifact = useCallback(
    async (artifactId: string) => {
      if (!api.deleteKnowledgeArtifact) {
        setFeedback({ kind: 'error', message: 'Delete knowledge API not available' })
        return
      }

      setIsDeletingKnowledge(true)
      setFeedback(null)

      try {
        await api.deleteKnowledgeArtifact(artifactId)
        dispatch({
          type: 'LOAD_KNOWLEDGE',
          payload: state.knowledgeArtifacts.filter((artifact) => artifact.id !== artifactId),
        })
        setFeedback({
          kind: 'success',
          message: 'Knowledge artifact deleted successfully',
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete knowledge artifact'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsDeletingKnowledge(false)
      }
    },
    [api, dispatch, state.knowledgeArtifacts]
  )

  const deleteSkillArtifact = useCallback(
    async (artifactId: string) => {
      if (!api.deleteSkillArtifact) {
        setFeedback({ kind: 'error', message: 'Delete skill API not available' })
        return
      }

      setIsDeletingSkill(true)
      setFeedback(null)

      try {
        await api.deleteSkillArtifact(artifactId)
        dispatch({
          type: 'LOAD_SKILLS',
          payload: state.skillArtifacts.filter((artifact) => artifact.id !== artifactId),
        })
        setFeedback({
          kind: 'success',
          message: 'Skill artifact deleted successfully',
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete skill artifact'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsDeletingSkill(false)
      }
    },
    [api, dispatch, state.skillArtifacts]
  )

  const dismissFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  return {
    knowledgeArtifacts: state.knowledgeArtifacts,
    skillArtifacts: state.skillArtifacts,
    knowledgeTopics: state.knowledgeTopics,
    feedback,
    isGeneratingKnowledge,
    isRegeneratingKnowledge,
    isApprovingKnowledge,
    isGeneratingSkill,
    isSavingKnowledge,
    isSavingSkill,
    isDeletingKnowledge,
    isDeletingSkill,
    generateKnowledge,
    regenerateKnowledge,
    approveKnowledge,
    generateSkill,
    saveKnowledgeArtifact,
    saveSkillArtifact,
    deleteKnowledgeArtifact,
    deleteSkillArtifact,
    dismissFeedback,
  }
}
