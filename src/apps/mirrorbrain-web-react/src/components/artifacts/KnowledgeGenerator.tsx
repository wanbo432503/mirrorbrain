import CandidateContext from './CandidateContext'
import DraftEditor from './DraftEditor'
import type { KnowledgeArtifact, ReviewedMemory } from '../../types/index'

interface KnowledgeGeneratorProps {
  reviewedMemories: ReviewedMemory[]
  knowledgeDraft: KnowledgeArtifact | null
  onGenerate: () => void
  onSave: () => void
  isGenerating: boolean
  isSaving: boolean
  onTitleChange: (title: string) => void
  onSummaryChange: (summary: string) => void
  onBodyChange: (body: string) => void
}

export default function KnowledgeGenerator({
  reviewedMemories,
  knowledgeDraft,
  onGenerate,
  onSave,
  isGenerating,
  isSaving,
  onTitleChange,
  onSummaryChange,
  onBodyChange,
}: KnowledgeGeneratorProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Candidate Context */}
      <div className="lg:col-span-1">
        <div className="mb-3">
          <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
            Source Context
          </h2>
          <p className="font-body text-sm text-slate-600">
            Reviewed memories for knowledge generation
          </p>
        </div>
        <CandidateContext reviewedMemories={reviewedMemories} />
      </div>

      {/* Right Column: Draft Editor */}
      <div className="lg:col-span-1">
        <div className="mb-3">
          <h2 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide">
            Knowledge Draft
          </h2>
          <p className="font-body text-sm text-slate-600">
            Edit generated knowledge artifact
          </p>
        </div>
        <DraftEditor
          mode="knowledge"
          draft={knowledgeDraft}
          onGenerate={onGenerate}
          onSave={onSave}
          isGenerating={isGenerating}
          isSaving={isSaving}
          onTitleChange={onTitleChange}
          onSummaryChange={onSummaryChange}
          onBodyChange={onBodyChange}
        />
      </div>
    </div>
  )
}