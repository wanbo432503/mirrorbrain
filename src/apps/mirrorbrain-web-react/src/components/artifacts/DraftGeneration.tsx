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
  onGenerateSkill: () => void
  onSaveKnowledge: () => void
  onSaveSkill: () => void
  isGeneratingKnowledge: boolean
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
  onGenerateSkill,
  onSaveKnowledge,
  onSaveSkill,
  isGeneratingKnowledge,
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
        <div className="mb-3">
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
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`
              px-3 py-1.5 rounded-lg font-heading font-semibold text-xs uppercase tracking-wide
              cursor-pointer transition-all duration-200
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
              ${activeTab === 'knowledge'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }
            `}
          >
            Knowledge Draft
          </button>
          <button
            onClick={() => setActiveTab('skill')}
            className={`
              px-3 py-1.5 rounded-lg font-heading font-semibold text-xs uppercase tracking-wide
              cursor-pointer transition-all duration-200
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
              ${activeTab === 'skill'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
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
              onSave={onSaveKnowledge}
              isGenerating={isGeneratingKnowledge}
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