import { useState, useCallback } from 'react'
import { useMirrorBrain } from '../contexts/MirrorBrainContext'
import type { MirrorBrainWebAppApi } from '../api/client'
import type { SkillArtifact, ReviewedMemory } from '../types/index'

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
  const [isGeneratingSkill, setIsGeneratingSkill] = useState(false)
  const [isSavingSkill, setIsSavingSkill] = useState(false)
  const [isDeletingSkill, setIsDeletingSkill] = useState(false)

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
    skillArtifacts: state.skillArtifacts,
    feedback,
    isGeneratingSkill,
    isSavingSkill,
    isDeletingSkill,
    generateSkill,
    saveSkillArtifact,
    deleteSkillArtifact,
    dismissFeedback,
  }
}
