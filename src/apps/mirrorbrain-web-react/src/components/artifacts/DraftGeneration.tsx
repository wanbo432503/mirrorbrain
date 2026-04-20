import CandidateContext from './CandidateContext'
import DraftEditor from './DraftEditor'
import type { KnowledgeArtifact, SkillArtifact, ReviewedMemory } from '../../types/index'

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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1: Source Context */}
      <div className="col-span-1">
        <div className="mb-3">
          <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
            Source Context
          </h2>
          <p className="font-body text-sm text-slate-600">
            Reviewed memories for artifact generation
          </p>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          <CandidateContext reviewedMemories={reviewedMemories} />
        </div>
      </div>

      {/* Column 2: Knowledge Draft */}
      <div className="col-span-1">
        <div className="mb-3">
          <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
            Knowledge Draft
          </h2>
          <p className="font-body text-sm text-slate-600">
            Edit generated knowledge artifact
          </p>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
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
        </div>
      </div>

      {/* Column 3: Skill Draft */}
      <div className="col-span-1">
        <div className="mb-3">
          <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
            Skill Draft
          </h2>
          <p className="font-body text-sm text-slate-600">
            Configure generated skill artifact
          </p>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
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
        </div>
      </div>
    </div>
  )
}