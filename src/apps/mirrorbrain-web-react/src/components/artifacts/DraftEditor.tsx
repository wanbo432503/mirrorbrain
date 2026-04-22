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
  onRegenerate: () => void
  onApprove: () => void
  onSave: () => void
  isGenerating: boolean
  isRegenerating: boolean
  isApproving: boolean
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
  onRegenerate,
  onApprove,
  onSave,
  isGenerating,
  isRegenerating,
  isApproving,
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
        {/* Action Buttons */}
        <div className="mb-3 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onRegenerate}
            loading={isRegenerating}
            disabled={isRegenerating || isSaving || isApproving}
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </Button>
          {mode === 'knowledge' && (
            <>
              <Button
                variant="success"
                onClick={onApprove}
                loading={isApproving}
                disabled={isApproving || isSaving || isRegenerating}
              >
                {isApproving ? 'Approving...' : 'Approved'}
              </Button>
              <Button
                variant="primary"
                onClick={onSave}
                loading={isSaving}
                disabled={isSaving || isRegenerating || isApproving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>

        {/* Knowledge Form */}
        {mode === 'knowledge' && (
          <TextArea
            value={(draft as KnowledgeArtifact).body || ''}
            onChange={(e) => onBodyChange?.(e.target.value)}
            rows={20}
            className="h-full"
          />
        )}

        {/* Skill Form */}
        {mode === 'skill' && (
          <div className="space-y-4">
            {/* Approval State */}
            <div className="space-y-2">
              <p className="text-sm font-heading font-semibold text-slate-900 uppercase tracking-wide">
                Approval State
              </p>
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => onApprovalStateChange?.('draft')}
                  className={`
                    px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
                    cursor-pointer transition-colors duration-200
                    focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
                    border-b-2 -mb-px
                    ${(draft as SkillArtifact).approvalState === 'draft'
                      ? 'border-yellow-500 text-yellow-700 bg-yellow-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }
                  `}
                >
                  Draft
                </button>
                <button
                  onClick={() => onApprovalStateChange?.('approved')}
                  className={`
                    px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
                    cursor-pointer transition-colors duration-200
                    focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
                    border-b-2 -mb-px
                    ${(draft as SkillArtifact).approvalState === 'approved'
                      ? 'border-green-500 text-green-700 bg-green-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
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
          <div className="pt-4 border-t border-slate-200 flex justify-end">
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