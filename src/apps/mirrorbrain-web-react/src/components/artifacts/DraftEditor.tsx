import Card from '../common/Card'
import Button from '../common/Button'
import Input from '../forms/Input'
import TextArea from '../forms/TextArea'
import Checkbox from '../forms/Checkbox'
import type { KnowledgeArtifact, SkillArtifact } from '../../types/index'

interface DraftEditorProps {
  mode: 'knowledge' | 'skill'
  draft: KnowledgeArtifact | SkillArtifact | null
  onGenerate: () => void
  onSave: () => void
  isGenerating: boolean
  isSaving: boolean
  // Knowledge-specific handlers
  onTitleChange?: (title: string) => void
  onSummaryChange?: (summary: string) => void
  onBodyChange?: (body: string) => void
  // Skill-specific handlers
  onApprovalStateChange?: (state: 'draft' | 'approved') => void
  onRequiresConfirmationChange?: (requiresConfirmation: boolean) => void
}

export default function DraftEditor({
  mode,
  draft,
  onGenerate,
  onSave,
  isGenerating,
  isSaving,
  onTitleChange,
  onSummaryChange,
  onBodyChange,
  onApprovalStateChange,
  onRequiresConfirmationChange,
}: DraftEditorProps) {
  if (!draft) {
    return (
      <Card className="h-full">
        <div className="text-center py-12 space-y-4">
          <p className="font-heading font-semibold text-base text-slate-600 mb-2">
            No draft available
          </p>
          <p className="font-body text-sm text-slate-500 mb-6">
            Click 'Generate' to create a new draft
          </p>
          <Button
            variant="primary"
            onClick={onGenerate}
            loading={isGenerating}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Draft'}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <div className="space-y-6">
        {/* Generate Button (if draft exists) */}
        <div className="flex justify-between items-center">
          <h3 className="font-heading font-bold text-lg text-slate-900 uppercase tracking-wide">
            {mode === 'knowledge' ? 'Knowledge Draft' : 'Skill Draft'}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onGenerate}
              loading={isGenerating}
              disabled={isGenerating || isSaving}
            >
              Regenerate
            </Button>
            {mode === 'knowledge' && (
              <>
                <Button variant="success">
                  Approved
                </Button>
                <Button variant="primary">
                  Save
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Knowledge Form */}
        {mode === 'knowledge' && (
          <div className="space-y-4">
            <TextArea
              label="Knowledge Content (Markdown)"
              value={(draft as KnowledgeArtifact).body || ''}
              onChange={(e) => onBodyChange?.(e.target.value)}
              rows={15}
              helpText="Edit knowledge content in markdown format"
            />
          </div>
        )}

        {/* Skill Form */}
        {mode === 'skill' && (
          <div className="space-y-4">
            {/* Approval State */}
            <div className="space-y-2">
              <p className="text-sm font-heading font-semibold text-slate-900 uppercase tracking-wide">
                Approval State
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => onApprovalStateChange?.('draft')}
                  className={`
                    px-4 py-2 rounded-lg font-heading font-semibold text-sm uppercase tracking-wide
                    cursor-pointer transition-all duration-200 border
                    ${(draft as SkillArtifact).approvalState === 'draft'
                      ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }
                  `}
                >
                  Draft
                </button>
                <button
                  onClick={() => onApprovalStateChange?.('approved')}
                  className={`
                    px-4 py-2 rounded-lg font-heading font-semibold text-sm uppercase tracking-wide
                    cursor-pointer transition-all duration-200 border
                    ${(draft as SkillArtifact).approvalState === 'approved'
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }
                  `}
                >
                  Approved
                </button>
              </div>
            </div>

            {/* Workflow Evidence Refs */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-heading font-semibold text-slate-600 uppercase mb-2">
                Workflow Evidence
              </p>
              <p className="font-body text-sm text-slate-700">
                {(draft as SkillArtifact).workflowEvidenceRefs.length} references attached
              </p>
            </div>

            {/* Execution Safety */}
            <Checkbox
              label="Requires Confirmation"
              description="Skill execution must be explicitly confirmed by user"
              checked={(draft as SkillArtifact).executionSafetyMetadata.requiresConfirmation}
              onChange={(e) => onRequiresConfirmationChange?.(e.target.checked)}
            />
          </div>
        )}

        {/* Save Button */}
        {mode === 'skill' && (
          <div className="pt-4 border-t border-slate-200">
            <Button
              variant="success"
              onClick={onSave}
              loading={isSaving}
              disabled={isSaving || isGenerating}
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}