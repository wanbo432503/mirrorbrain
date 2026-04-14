import CandidateContext from './CandidateContext'
import DraftEditor from './DraftEditor'
import type { SkillArtifact, ReviewedMemory } from '../../types/index'

interface SkillGeneratorProps {
  reviewedMemories: ReviewedMemory[]
  skillDraft: SkillArtifact | null
  onGenerate: () => void
  onSave: () => void
  isGenerating: boolean
  isSaving: boolean
  onApprovalStateChange: (state: 'draft' | 'approved') => void
  onRequiresConfirmationChange: (requiresConfirmation: boolean) => void
}

export default function SkillGenerator({
  reviewedMemories,
  skillDraft,
  onGenerate,
  onSave,
  isGenerating,
  isSaving,
  onApprovalStateChange,
  onRequiresConfirmationChange,
}: SkillGeneratorProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Candidate Context */}
      <div className="lg:col-span-1">
        <div className="mb-3">
          <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
            Source Context
          </h2>
          <p className="font-body text-sm text-slate-600">
            Reviewed memories for skill generation
          </p>
        </div>
        <CandidateContext reviewedMemories={reviewedMemories} />
      </div>

      {/* Right Column: Draft Editor */}
      <div className="lg:col-span-1">
        <div className="mb-3">
          <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
            Skill Draft
          </h2>
          <p className="font-body text-sm text-slate-600">
            Configure generated skill artifact
          </p>
        </div>
        <DraftEditor
          mode="skill"
          draft={skillDraft}
          onGenerate={onGenerate}
          onSave={onSave}
          isGenerating={isGenerating}
          isSaving={isSaving}
          onApprovalStateChange={onApprovalStateChange}
          onRequiresConfirmationChange={onRequiresConfirmationChange}
        />
      </div>
    </div>
  )
}