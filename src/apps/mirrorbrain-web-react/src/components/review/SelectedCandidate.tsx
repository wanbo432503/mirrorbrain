import { useState } from 'react'
import Card from '../common/Card'
import Button from '../common/Button'
import TextArea from '../forms/TextArea'
import Checkbox from '../forms/Checkbox'
import LoadingSpinner from '../common/LoadingSpinner'
import KeptCandidateCard from './KeptCandidateCard'
import type { CandidateMemory, ReviewedMemory, KnowledgeArtifact, SkillArtifact } from '../../types/index'

interface SelectedCandidateProps {
  candidate: CandidateMemory | undefined
  viewingMode: 'detail' | 'kept-list' | 'knowledge-draft' | 'skill-draft'
  keptCandidates: ReviewedMemory[]
  onUndoKeep: (reviewedMemoryId: string) => void

  // Add draft generation props
  knowledgeDraft: KnowledgeArtifact | null
  skillDraft: SkillArtifact | null
  onGenerateKnowledge: () => void
  onGenerateSkill: () => void
  onRegenerateKnowledge: () => void
  onApproveKnowledge: () => void
  onSaveKnowledge: () => void
  onSaveSkill: () => void
  isGeneratingKnowledge: boolean
  isGeneratingSkill: boolean
  isRegeneratingKnowledge: boolean
  isApprovingKnowledge: boolean
  isSavingKnowledge: boolean
  isSavingSkill: boolean

  // Knowledge editing handlers
  onKnowledgeTitleChange: (title: string) => void
  onKnowledgeSummaryChange: (summary: string) => void
  onKnowledgeBodyChange: (body: string) => void

  // Skill editing handlers
  onSkillApprovalStateChange: (state: 'draft' | 'approved') => void
  onSkillRequiresConfirmationChange: (requiresConfirmation: boolean) => void
}

type CandidateSourceRef = NonNullable<CandidateMemory['sourceRefs']>[number]

export function formatCandidateDuration(startAt: string, endAt: string): string {
  const durationMs = new Date(endAt).getTime() - new Date(startAt).getTime()

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 'Under 1 minute'
  }

  const durationMinutes = Math.max(1, Math.round(durationMs / (60 * 1000)))

  if (durationMinutes < 60) {
    return `${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`
  }

  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60

  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }

  return `${hours}h ${minutes}m`
}

export function splitCandidateSourcesByContribution(
  sourceRefs: CandidateSourceRef[]
): {
  primary: CandidateSourceRef[]
  supporting: CandidateSourceRef[]
} {
  return sourceRefs.reduce(
    (groups, sourceRef) => {
      if (sourceRef.contribution === 'supporting') {
        groups.supporting.push(sourceRef)
      } else {
        groups.primary.push(sourceRef)
      }

      return groups
    },
    {
      primary: [] as CandidateSourceRef[],
      supporting: [] as CandidateSourceRef[],
    }
  )
}

export function getCandidateFormationReasons(
  candidate: Pick<CandidateMemory, 'formationReasons'>
): string[] {
  if (candidate.formationReasons && candidate.formationReasons.length > 0) {
    return candidate.formationReasons
  }

  return [
    'This candidate was formed from related browser activity in the selected review window.',
  ]
}

export function getCandidateDiscardReasons(
  candidate: Pick<CandidateMemory, 'discardReasons'>
): string[] {
  return candidate.discardReasons ?? []
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export default function SelectedCandidate({
  candidate,
  viewingMode,
  keptCandidates,
  onUndoKeep,
  knowledgeDraft,
  skillDraft,
  onGenerateKnowledge,
  onGenerateSkill,
  onRegenerateKnowledge,
  onApproveKnowledge,
  onSaveKnowledge,
  onSaveSkill,
  isGeneratingKnowledge,
  isGeneratingSkill,
  isRegeneratingKnowledge,
  isApprovingKnowledge,
  isSavingKnowledge,
  isSavingSkill,
  onKnowledgeBodyChange,
  onSkillApprovalStateChange,
  onSkillRequiresConfirmationChange,
}: SelectedCandidateProps) {
  const [knowledgeRevisionRequest, setKnowledgeRevisionRequest] = useState('')

  function handleImproveKnowledgeNote() {
    const request = knowledgeRevisionRequest.trim()
    if (request.length === 0) {
      return
    }

    const currentBody = knowledgeDraft?.body ?? ''
    onKnowledgeBodyChange(`${currentBody}\n\nRevision request:\n${request}`)
    setKnowledgeRevisionRequest('')
  }

  // Kept list mode
  if (viewingMode === 'kept-list') {
    if (keptCandidates.length === 0) {
      return (
        <Card className="h-full overflow-y-auto max-h-[540px]">
          <div className="text-center py-12">
            <p className="font-heading font-semibold text-base text-slate-600 mb-2">
              No kept candidates
            </p>
            <p className="font-body text-sm text-slate-500">
              Click "Keep" on candidates to add them here
            </p>
          </div>
        </Card>
      )
    }

    return (
      <Card className="h-full overflow-y-auto max-h-[540px]">
        <div className="space-y-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-xs text-slate-900 uppercase tracking-wide">
                Kept Candidates ({keptCandidates.length})
              </h3>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={onGenerateKnowledge}
                disabled={keptCandidates.length === 0}
                loading={isGeneratingKnowledge}
              >
                Generate Knowledge
              </Button>
              <Button
                variant="primary"
                onClick={onGenerateSkill}
                disabled={keptCandidates.length === 0}
                loading={isGeneratingSkill}
              >
                Generate Skill
              </Button>
            </div>
          </div>
          {keptCandidates.map((reviewedMemory) => (
            <KeptCandidateCard
              key={reviewedMemory.id}
              reviewedMemory={reviewedMemory}
              onUndo={onUndoKeep}
            />
          ))}
        </div>
      </Card>
    )
  }

  // Knowledge draft mode
  if (viewingMode === 'knowledge-draft') {
    // Loading state during generation
    if (isGeneratingKnowledge) {
      return (
        <Card className="h-full">
          <div className="text-center py-12">
            <LoadingSpinner />
            <p className="font-heading font-semibold text-base text-slate-600 mt-4">
              Generating knowledge draft...
            </p>
          </div>
        </Card>
      )
    }

    // Draft editing interface
    return (
      <Card className="h-full overflow-y-auto max-h-[540px]">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-bold text-base text-slate-900">
              Knowledge Draft
            </h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={onRegenerateKnowledge}
                loading={isRegeneratingKnowledge}
                disabled={isRegeneratingKnowledge || isSavingKnowledge || isApprovingKnowledge}
              >
                {isRegeneratingKnowledge ? 'Regenerating...' : 'Regenerate'}
              </Button>
              <Button
                variant="success"
                onClick={onApproveKnowledge}
                loading={isApprovingKnowledge}
                disabled={isApprovingKnowledge || isSavingKnowledge || isRegeneratingKnowledge}
              >
                {isApprovingKnowledge ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                variant="primary"
                onClick={onSaveKnowledge}
                loading={isSavingKnowledge}
                disabled={isSavingKnowledge || isRegeneratingKnowledge || isApprovingKnowledge}
              >
                {isSavingKnowledge ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          <TextArea
            id="generated-knowledge-note"
            label="Generated Note"
            value={knowledgeDraft?.body || ''}
            onChange={(e) => onKnowledgeBodyChange(e.target.value)}
            rows={20}
            className="w-full font-body text-sm"
            placeholder="Generated note content will appear here..."
          />
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <TextArea
              id="knowledge-revision-request"
              label="Revision Request"
              value={knowledgeRevisionRequest}
              onChange={(e) => setKnowledgeRevisionRequest(e.target.value)}
              rows={4}
              className="w-full font-body text-sm"
              placeholder="Describe how MirrorBrain should improve this note..."
            />
            <Button
              variant="primary"
              onClick={handleImproveKnowledgeNote}
              disabled={knowledgeRevisionRequest.trim().length === 0}
            >
              Improve Note
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Skill draft mode
  if (viewingMode === 'skill-draft') {
    // Loading state during generation
    if (isGeneratingSkill) {
      return (
        <Card className="h-full">
          <div className="text-center py-12">
            <LoadingSpinner />
            <p className="font-heading font-semibold text-base text-slate-600 mt-4">
              Generating skill draft...
            </p>
          </div>
        </Card>
      )
    }

    // Draft editing interface
    return (
      <Card className="h-full overflow-y-auto max-h-[540px]">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-bold text-base text-slate-900">
              Skill Draft
            </h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={onRegenerateKnowledge}
                disabled={isSavingSkill}
              >
                Regenerate
              </Button>
              <Button
                variant="success"
                onClick={onSaveSkill}
                loading={isSavingSkill}
                disabled={isSavingSkill}
              >
                {isSavingSkill ? 'Saving...' : 'Save Draft'}
              </Button>
            </div>
          </div>

          {/* Approval State toggle */}
          <div className="space-y-2">
            <p className="text-sm font-heading font-semibold text-slate-900 uppercase">
              Approval State
            </p>
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => onSkillApprovalStateChange('draft')}
                className={`
                  px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
                  cursor-pointer transition-colors duration-200
                  focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
                  border-b-2 -mb-px
                  ${skillDraft?.approvalState === 'draft'
                    ? 'border-yellow-500 text-yellow-700 bg-yellow-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }
                `}
              >
                Draft
              </button>
              <button
                onClick={() => onSkillApprovalStateChange('approved')}
                className={`
                  px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
                  cursor-pointer transition-colors duration-200
                  focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
                  border-b-2 -mb-px
                  ${skillDraft?.approvalState === 'approved'
                    ? 'border-green-500 text-green-700 bg-green-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }
                `}
              >
                Approved
              </button>
            </div>
          </div>

          {/* Workflow Evidence display */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-heading font-semibold text-slate-600 uppercase mb-2">
              Workflow Evidence
            </p>
            <p className="font-body text-sm text-slate-700">
              {skillDraft?.workflowEvidenceRefs?.length || 0} references attached
            </p>
          </div>

          {/* Execution Safety checkbox */}
          <Checkbox
            label="Requires Confirmation"
            description="Skill execution must be explicitly confirmed by user"
            checked={skillDraft?.executionSafetyMetadata?.requiresConfirmation || true}
            onChange={(e) => onSkillRequiresConfirmationChange(e.target.checked)}
          />
        </div>
      </Card>
    )
  }

  // Detail mode (existing behavior)
  if (!candidate) {
    return (
      <Card className="h-full overflow-y-auto max-h-[540px]">
        <div className="text-center py-12">
          <p className="font-heading font-semibold text-base text-slate-600 mb-2">
            No candidate selected
          </p>
          <p className="font-body text-sm text-slate-500">
            Click a candidate from the list to view details
          </p>
        </div>
      </Card>
    )
  }

  const allUrls = (candidate.sourceRefs ?? [])
    .map((source) => source.url)
    .filter((url): url is string => typeof url === 'string')
  const uniqueUrls = Array.from(new Set(allUrls))

  const formationReasons = getCandidateFormationReasons(candidate)
  const discardReasons = getCandidateDiscardReasons(candidate)
  const discardedSourceRefs = candidate.discardedSourceRefs ?? []

  return (
    <Card className="h-full overflow-y-auto max-h-[540px]">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Title
          </p>
          <h3 className="font-heading font-bold text-lg text-slate-900">
            {candidate.title}
          </h3>
        </div>

        {/* Review State */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Review State
          </p>
          <div className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-heading font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">
            {candidate.reviewState}
          </div>
        </div>

        {/* Time Range */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Time Range
          </p>
          <p className="font-body text-sm text-slate-900">
            {formatTimestamp(candidate.timeRange.startAt)} to{' '}
            {formatTimestamp(candidate.timeRange.endAt)}
          </p>
          <p className="font-body text-xs text-slate-600 mt-1">
            Duration: {formatCandidateDuration(candidate.timeRange.startAt, candidate.timeRange.endAt)}
          </p>
        </div>

        {/* Summary */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Summary
          </p>
          <p className="font-body text-sm text-slate-700 leading-relaxed">
            {candidate.summary}
          </p>
        </div>

        {/* Formation Reasons */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Why This Candidate Exists
          </p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {formationReasons.map((reason) => (
              <p key={reason} className="font-body text-sm text-slate-700 leading-relaxed">
                {reason}
              </p>
            ))}
          </div>
        </div>

        {discardReasons.length > 0 && (
          <div>
            <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Excluded Nearby Noise
            </p>
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="space-y-2">
                {discardReasons.map((reason) => (
                  <p key={reason} className="font-body text-sm text-slate-700 leading-relaxed">
                    {reason}
                  </p>
                ))}
              </div>
              {discardedSourceRefs.length > 0 && (
                <div className="space-y-2">
                  {discardedSourceRefs.map((source) => (
                    <div
                      key={source.id}
                      className="rounded-lg border border-amber-200 bg-white/70 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-body text-sm font-medium text-slate-900">
                            {source.title ?? source.url ?? source.id}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {source.role && (
                              <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-1 text-[11px] font-heading font-semibold uppercase tracking-wide text-amber-700">
                                {source.role}
                              </span>
                            )}
                            {source.url && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block truncate text-xs text-blue-700 hover:text-blue-900 hover:underline"
                              >
                                {source.url}
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="shrink-0 text-xs text-slate-500">
                          {formatTimestamp(source.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Review Date */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Review Date
          </p>
          <p className="font-body text-sm text-slate-900">
            {formatTimestamp(candidate.reviewDate)}
          </p>
        </div>

        {/* Visited URLs */}
        <div>
          <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Visited URLs ({uniqueUrls.length} unique)
          </p>
          {uniqueUrls.length === 0 ? (
            <p className="font-body text-sm text-slate-500">
              No URLs recorded
            </p>
          ) : (
            <div className="space-y-2">
              {uniqueUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-blue-700 hover:text-blue-900 hover:underline truncate"
                >
                  {url}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
