import { useState } from 'react'
import CandidateContext from './CandidateContext'
import DraftEditor from './DraftEditor'
import type { KnowledgeArtifact, SkillArtifact, ReviewedMemory } from '../../types/index'

type DraftTab = 'knowledge' | 'skill'

interface DraftGenerationProps {
  reviewedMemories: ReviewedMemory[]
  knowledgeDraft: KnowledgeArtifact | null
  skillDraft: SkillArtifact | null
  onGenerateKnowledge: () => void
  onRegenerateKnowledge: () => void
  onApproveKnowledge: () => void
  onGenerateSkill: () => void
  onSaveKnowledge: () => void
  onSaveSkill: () => void
  isGeneratingKnowledge: boolean
  isRegeneratingKnowledge: boolean
  isApprovingKnowledge: boolean
  isGeneratingSkill: boolean
  isSavingKnowledge: boolean
  isSavingSkill: boolean
  onKnowledgeTitleChange: (title: string) => void
  onKnowledgeSummaryChange: (summary: string) => void
  onKnowledgeBodyChange: (body: string) => void
  onSkillApprovalStateChange: (state: 'draft' | 'approved') => void
  onSkillRequiresConfirmationChange: (requiresConfirmation: boolean) => void
}

export default function DraftGeneration({
  reviewedMemories,
  knowledgeDraft,
  skillDraft,
  onGenerateKnowledge,
  onRegenerateKnowledge,
  onApproveKnowledge,
  onGenerateSkill,
  onSaveKnowledge,
  onSaveSkill,
  isGeneratingKnowledge,
  isRegeneratingKnowledge,
  isApprovingKnowledge,
  isGeneratingSkill,
  isSavingKnowledge,
  isSavingSkill,
  onKnowledgeTitleChange,
  onKnowledgeSummaryChange,
  onKnowledgeBodyChange,
  onSkillApprovalStateChange,
  onSkillRequiresConfirmationChange,
}: DraftGenerationProps) {
  const [activeTab, setActiveTab] = useState<DraftTab>('knowledge')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: '590px' }}>
      {/* Column 1: Source Context */}
      <div className="col-span-1">
        <div className="mb-3 py-2">
          <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
            Source Context
          </h2>
        </div>
        <div className="h-[550px] overflow-y-auto">
          <CandidateContext reviewedMemories={reviewedMemories} />
        </div>
      </div>

      {/* Column 2: Draft Tabs (Knowledge/Skill) */}
      <div className="lg:col-span-2">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-3">
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`
              px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
              cursor-pointer transition-colors duration-200
              focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
              border-b-2 -mb-px
              ${activeTab === 'knowledge'
                ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }
            `}
          >
            Knowledge Draft
          </button>
          <button
            onClick={() => setActiveTab('skill')}
            className={`
              px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
              cursor-pointer transition-colors duration-200
              focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
              border-b-2 -mb-px
              ${activeTab === 'skill'
                ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }
            `}
          >
            Skill Draft
          </button>
        </div>

        {/* Tab Content */}
        <div className="h-[550px] overflow-y-auto">
          {activeTab === 'knowledge' && (
            <DraftEditor
              mode="knowledge"
              draft={knowledgeDraft}
              onGenerate={onGenerateKnowledge}
              onRegenerate={onRegenerateKnowledge}
              onApprove={onApproveKnowledge}
              onSave={onSaveKnowledge}
              isGenerating={isGeneratingKnowledge}
              isRegenerating={isRegeneratingKnowledge}
              isApproving={isApprovingKnowledge}
              isSaving={isSavingKnowledge}
              onTitleChange={onKnowledgeTitleChange}
              onSummaryChange={onKnowledgeSummaryChange}
              onBodyChange={onKnowledgeBodyChange}
            />
          )}
          {activeTab === 'skill' && (
            <DraftEditor
              mode="skill"
              draft={skillDraft}
              onGenerate={onGenerateSkill}
              onSave={onSaveSkill}
              isGenerating={isGeneratingSkill}
              isSaving={isSavingSkill}
              onApprovalStateChange={onSkillApprovalStateChange}
              onRequiresConfirmationChange={onSkillRequiresConfirmationChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}