import { useState, useCallback } from 'react'
import { useMirrorBrain } from '../contexts/MirrorBrainContext'
import type { MirrorBrainWebAppApi } from '../api/client'
import type { KnowledgeArtifact, SkillArtifact, ReviewedMemory } from '../types/index'

interface ArtifactsFeedback {
  kind: 'success' | 'error' | 'info'
  message: string
}

export function useArtifacts(api: MirrorBrainWebAppApi) {
  const { state, dispatch } = useMirrorBrain()
  const [feedback, setFeedback] = useState<ArtifactsFeedback | null>(null)
  const [isGeneratingKnowledge, setIsGeneratingKnowledge] = useState(false)
  const [isGeneratingSkill, setIsGeneratingSkill] = useState(false)
  const [isSavingKnowledge, setIsSavingKnowledge] = useState(false)
  const [isSavingSkill, setIsSavingSkill] = useState(false)

  const generateKnowledge = useCallback(
    async (reviewedMemories: ReviewedMemory[]) => {
      setIsGeneratingKnowledge(true)
      setFeedback(null)

      try {
        const artifact = await api.generateKnowledge(reviewedMemories)

        setFeedback({
          kind: 'success',
          message: 'Knowledge artifact generated successfully',
        })

        return artifact
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate knowledge'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsGeneratingKnowledge(false)
      }
    },
    [api]
  )

  const generateSkill = useCallback(
    async (reviewedMemories: ReviewedMemory[]) => {
      setIsGeneratingSkill(true)
      setFeedback(null)

      try {
        const artifact = await api.generateSkill(reviewedMemories)

        setFeedback({
          kind: 'success',
          message: 'Skill artifact generated successfully',
        })

        return artifact
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate skill'
        setFeedback({ kind: 'error', message })
        throw error
      } finally {
        setIsGeneratingSkill(false)
      }
    },
    [api]
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
        const updatedKnowledge = [...state.knowledgeArtifacts, savedArtifact]
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
        const updatedSkills = [...state.skillArtifacts, savedArtifact]
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

  const dismissFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  return {
    knowledgeArtifacts: state.knowledgeArtifacts,
    skillArtifacts: state.skillArtifacts,
    knowledgeTopics: state.knowledgeTopics,
    feedback,
    isGeneratingKnowledge,
    isGeneratingSkill,
    isSavingKnowledge,
    isSavingSkill,
    generateKnowledge,
    generateSkill,
    saveKnowledgeArtifact,
    saveSkillArtifact,
    dismissFeedback,
  }
}