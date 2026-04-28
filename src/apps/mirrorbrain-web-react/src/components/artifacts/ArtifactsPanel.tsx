import { useState } from 'react'
import SubtabNavigation from './SubtabNavigation'
import HistoryTopics from './HistoryTopics'
import DraftGeneration from './DraftGeneration'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useArtifacts } from '../../hooks/useArtifacts'
import { useMirrorBrain } from '../../contexts/MirrorBrainContext'

type ArtifactsSubtab = 'history-topics' | 'draft-generation'

export default function ArtifactsPanel() {
  const api: MirrorBrainWebAppApi = createMirrorBrainBrowserApi(window.location.origin)

  const {
    knowledgeArtifacts,
    skillArtifacts,
    knowledgeTopics,
    feedback,
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

  const { state, dispatch } = useMirrorBrain()

  const [activeSubtab, setActiveSubtab] = useState<ArtifactsSubtab>('history-topics')
  const knowledgeDraft = state.knowledgeDraft
  const skillDraft = state.skillDraft
  // Use only kept reviewed memories from global state for artifact generation
  const reviewedMemories = state.reviewedMemories.filter((memory) => memory.decision === 'keep')

  // Knowledge handlers
  const handleGenerateKnowledge = async () => {
    try {
      const artifact = await generateKnowledge(reviewedMemories)
      dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: artifact })
    } catch (error) {
      // Error handled by useArtifacts
    }
  }

  const handleRegenerateKnowledge = async () => {
    if (!knowledgeDraft || !regenerateKnowledge) return
    try {
      const artifact = await regenerateKnowledge(knowledgeDraft, reviewedMemories)
      if (artifact) {
        dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: artifact })
      }
    } catch (error) {
      // Error handled by useArtifacts
    }
  }

  const handleApproveKnowledge = async () => {
    if (!knowledgeDraft?.id || !approveKnowledge) return
    try {
      const result = await approveKnowledge(knowledgeDraft)
      if (result) {
        // Clear the draft after successful approval
        dispatch({ type: 'SET_KNOWLEDGE_DRAFT', payload: null })
      }
    } catch (error) {
      // Error handled by useArtifacts
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

  // Skill handlers
  const handleGenerateSkill = async () => {
    try {
      const artifact = await generateSkill(reviewedMemories)
      dispatch({ type: 'SET_SKILL_DRAFT', payload: artifact })
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

  return (
    <div>
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-3 p-3 rounded-lg border ${
            feedback.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-700'
              : feedback.kind === 'error'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-blue-100 border-blue-300 text-blue-700'
          }`}
          role="alert"
        >
          <p className="font-body font-medium text-sm">{feedback.message}</p>
        </div>
      )}

      {/* Subtab Navigation */}
      <SubtabNavigation activeSubtab={activeSubtab} onSubtabChange={setActiveSubtab} />

      {/* Subtab Content */}
      <div role="tabpanel" id={`${activeSubtab}-panel`}>
        {activeSubtab === 'history-topics' && (
          <HistoryTopics
            knowledgeTopics={knowledgeTopics}
            knowledgeArtifacts={knowledgeArtifacts}
            skillArtifacts={skillArtifacts}
          />
        )}

        {activeSubtab === 'draft-generation' && (
          <DraftGeneration
            reviewedMemories={reviewedMemories}
            knowledgeDraft={knowledgeDraft}
            skillDraft={skillDraft}
            onGenerateKnowledge={handleGenerateKnowledge}
            onRegenerateKnowledge={handleRegenerateKnowledge}
            onApproveKnowledge={handleApproveKnowledge}
            onGenerateSkill={handleGenerateSkill}
            onSaveKnowledge={handleSaveKnowledge}
            onSaveSkill={handleSaveSkill}
            isGeneratingKnowledge={isGeneratingKnowledge}
            isRegeneratingKnowledge={isRegeneratingKnowledge}
            isApprovingKnowledge={isApprovingKnowledge}
            isGeneratingSkill={isGeneratingSkill}
            isSavingKnowledge={isSavingKnowledge}
            isSavingSkill={isSavingSkill}
            onKnowledgeTitleChange={(title) =>
              dispatch({
                type: 'SET_KNOWLEDGE_DRAFT',
                payload: knowledgeDraft ? { ...knowledgeDraft, title } : null,
              })
            }
            onKnowledgeSummaryChange={(summary) =>
              dispatch({
                type: 'SET_KNOWLEDGE_DRAFT',
                payload: knowledgeDraft ? { ...knowledgeDraft, summary } : null,
              })
            }
            onKnowledgeBodyChange={(body) =>
              dispatch({
                type: 'SET_KNOWLEDGE_DRAFT',
                payload: knowledgeDraft ? { ...knowledgeDraft, body } : null,
              })
            }
            onSkillApprovalStateChange={(approvalState) =>
              dispatch({
                type: 'SET_SKILL_DRAFT',
                payload: skillDraft ? { ...skillDraft, approvalState } : null,
              })
            }
            onSkillRequiresConfirmationChange={(requiresConfirmation) =>
              dispatch({
                type: 'SET_SKILL_DRAFT',
                payload: skillDraft
                  ? {
                      ...skillDraft,
                      executionSafetyMetadata: { requiresConfirmation },
                    }
                  : null,
              })
            }
          />
        )}
      </div>
    </div>
  )
}
