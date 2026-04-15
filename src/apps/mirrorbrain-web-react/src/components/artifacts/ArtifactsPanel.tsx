import { useState } from 'react'
import SubtabNavigation from './SubtabNavigation'
import HistoryTopics from './HistoryTopics'
import KnowledgeGenerator from './KnowledgeGenerator'
import SkillGenerator from './SkillGenerator'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useArtifacts } from '../../hooks/useArtifacts'
import type { ReviewedMemory, KnowledgeArtifact, SkillArtifact } from '../../types/index'

type ArtifactsSubtab = 'history-topics' | 'generate-knowledge' | 'generate-skill'

export default function ArtifactsPanel() {
  const api: MirrorBrainWebAppApi = createMirrorBrainBrowserApi(window.location.origin)

  const {
    knowledgeArtifacts,
    skillArtifacts,
    knowledgeTopics,
    feedback,
    isGeneratingKnowledge,
    isGeneratingSkill,
    isSavingKnowledge,
    isSavingSkill,
    generateKnowledge,
    generateSkill,
    saveKnowledgeArtifact,
    saveSkillArtifact,
  } = useArtifacts(api)

  const [activeSubtab, setActiveSubtab] = useState<ArtifactsSubtab>('history-topics')
  const [knowledgeDraft, setKnowledgeDraft] = useState<KnowledgeArtifact | null>(null)
  const [skillDraft, setSkillDraft] = useState<SkillArtifact | null>(null)
  const [reviewedMemories] = useState<ReviewedMemory[]>([])

  // Knowledge handlers
  const handleGenerateKnowledge = async () => {
    try {
      const artifact = await generateKnowledge(reviewedMemories)
      setKnowledgeDraft(artifact)
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
      setSkillDraft(artifact)
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

        {activeSubtab === 'generate-knowledge' && (
          <KnowledgeGenerator
            reviewedMemories={reviewedMemories}
            knowledgeDraft={knowledgeDraft}
            onGenerate={handleGenerateKnowledge}
            onSave={handleSaveKnowledge}
            isGenerating={isGeneratingKnowledge}
            isSaving={isSavingKnowledge}
            onTitleChange={(title) =>
              setKnowledgeDraft((prev) => prev ? { ...prev, title } : null)
            }
            onSummaryChange={(summary) =>
              setKnowledgeDraft((prev) => prev ? { ...prev, summary } : null)
            }
            onBodyChange={(body) =>
              setKnowledgeDraft((prev) => prev ? { ...prev, body } : null)
            }
          />
        )}

        {activeSubtab === 'generate-skill' && (
          <SkillGenerator
            reviewedMemories={reviewedMemories}
            skillDraft={skillDraft}
            onGenerate={handleGenerateSkill}
            onSave={handleSaveSkill}
            isGenerating={isGeneratingSkill}
            isSaving={isSavingSkill}
            onApprovalStateChange={(approvalState) =>
              setSkillDraft((prev) => prev ? { ...prev, approvalState } : null)
            }
            onRequiresConfirmationChange={(requiresConfirmation) =>
              setSkillDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      executionSafetyMetadata: { requiresConfirmation },
                    }
                  : null
              )
            }
          />
        )}
      </div>
    </div>
  )
}