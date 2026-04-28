import { describe, expect, it, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SelectedCandidate, {
  formatCandidateDuration,
  getCandidateDiscardReasons,
  getCandidateFormationReasons,
  splitCandidateSourcesByContribution,
} from './SelectedCandidate'
import type { CandidateMemory, ReviewedMemory, KnowledgeArtifact, SkillArtifact } from '../../types/index'

describe('SelectedCandidate helpers', () => {
  it('formats candidate duration from the candidate time range', () => {
    expect(
      formatCandidateDuration('2026-04-14T08:00:00.000Z', '2026-04-14T08:45:00.000Z')
    ).toBe('45 minutes')

    expect(
      formatCandidateDuration('2026-04-14T08:00:00.000Z', '2026-04-14T10:15:00.000Z')
    ).toBe('2h 15m')
  })

  it('splits candidate sources into primary and supporting groups', () => {
    const groups = splitCandidateSourcesByContribution([
      {
        id: 'browser:docs',
        sourceType: 'activitywatch-browser',
        timestamp: '2026-04-14T09:00:00.000Z',
        title: 'Cache invalidation guide',
        url: 'https://docs.example.com/cache/invalidation',
        role: 'docs',
        contribution: 'primary',
      },
      {
        id: 'browser:search',
        sourceType: 'activitywatch-browser',
        timestamp: '2026-04-14T09:05:00.000Z',
        title: 'stale cache - Google Search',
        url: 'https://google.com/search?q=stale+cache',
        role: 'search',
        contribution: 'supporting',
      },
    ])

    expect(groups.primary).toEqual([
      expect.objectContaining({ id: 'browser:docs', contribution: 'primary' }),
    ])
    expect(groups.supporting).toEqual([
      expect.objectContaining({ id: 'browser:search', contribution: 'supporting' }),
    ])
  })

  it('returns explicit formation reasons and falls back to a default explanation', () => {
    expect(
      getCandidateFormationReasons({
        formationReasons: [
          'Started from docs evidence on Cache Invalidation.',
          'This candidate absorbed 1 low-evidence visit from Work on Search Results to stay within the 10-task daily review limit.',
        ],
      })
    ).toEqual([
      'Started from docs evidence on Cache Invalidation.',
      'This candidate absorbed 1 low-evidence visit from Work on Search Results to stay within the 10-task daily review limit.',
    ])

    expect(
      getCandidateFormationReasons({})
    ).toEqual([
      'This candidate was formed from related browser activity in the selected review window.',
    ])
  })

  it('returns explicit discard reasons and falls back to an empty list', () => {
    expect(
      getCandidateDiscardReasons({
        discardReasons: [
          'Excluded 2 low-evidence pages near this task because they did not share enough evidence to stand alone.',
        ],
      })
    ).toEqual([
      'Excluded 2 low-evidence pages near this task because they did not share enough evidence to stand alone.',
    ])

    expect(getCandidateDiscardReasons({})).toEqual([])
  })
})

describe('SelectedCandidate component rendering', () => {
  const mockCandidate: CandidateMemory = {
    id: 'candidate:test-1',
    memoryEventIds: ['event-1'],
    title: 'Test Candidate',
    summary: 'Test summary',
    theme: 'test',
    reviewDate: '2026-04-28',
    timeRange: {
      startAt: '2026-04-28T10:00:00Z',
      endAt: '2026-04-28T11:00:00Z',
    },
    reviewState: 'pending',
  }

  const mockKeptCandidates: ReviewedMemory[] = [
    {
      id: 'reviewed:candidate:test-1',
      candidateMemoryId: 'candidate:test-1',
      candidateTitle: 'Kept Candidate 1',
      candidateSummary: 'Summary',
      candidateTheme: 'test',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-28',
      decision: 'keep',
      reviewedAt: '2026-04-28T10:00:00Z',
    },
    {
      id: 'reviewed:candidate:test-2',
      candidateMemoryId: 'candidate:test-2',
      candidateTitle: 'Kept Candidate 2',
      candidateSummary: 'Summary 2',
      candidateTheme: 'test',
      memoryEventIds: ['event-2'],
      reviewDate: '2026-04-28',
      decision: 'keep',
      reviewedAt: '2026-04-28T11:00:00Z',
    },
  ]

  afterEach(() => {
    cleanup()
  })

  it('should render detail view when viewingMode is detail', () => {
    render(
      <SelectedCandidate
        candidate={mockCandidate}
        viewingMode="detail"
        keptCandidates={[]}
        onUndoKeep={() => {}}
        knowledgeDraft={null}
        skillDraft={null}
        onGenerateKnowledge={() => {}}
        onGenerateSkill={() => {}}
        onRegenerateKnowledge={() => {}}
        onApproveKnowledge={() => {}}
        onSaveKnowledge={() => {}}
        onSaveSkill={() => {}}
        isGeneratingKnowledge={false}
        isGeneratingSkill={false}
        isRegeneratingKnowledge={false}
        isApprovingKnowledge={false}
        isSavingKnowledge={false}
        isSavingSkill={false}
        onKnowledgeTitleChange={() => {}}
        onKnowledgeSummaryChange={() => {}}
        onKnowledgeBodyChange={() => {}}
        onSkillApprovalStateChange={() => {}}
        onSkillRequiresConfirmationChange={() => {}}
      />
    )

    expect(screen.getByText('Test Candidate')).toBeInTheDocument()
    expect(screen.getByText('Test summary')).toBeInTheDocument()
  })

  it('should render kept list view when viewingMode is kept-list', () => {
    render(
      <SelectedCandidate
        candidate={undefined}
        viewingMode="kept-list"
        keptCandidates={mockKeptCandidates}
        onUndoKeep={() => {}}
        knowledgeDraft={null}
        skillDraft={null}
        onGenerateKnowledge={() => {}}
        onGenerateSkill={() => {}}
        onRegenerateKnowledge={() => {}}
        onApproveKnowledge={() => {}}
        onSaveKnowledge={() => {}}
        onSaveSkill={() => {}}
        isGeneratingKnowledge={false}
        isGeneratingSkill={false}
        isRegeneratingKnowledge={false}
        isApprovingKnowledge={false}
        isSavingKnowledge={false}
        isSavingSkill={false}
        onKnowledgeTitleChange={() => {}}
        onKnowledgeSummaryChange={() => {}}
        onKnowledgeBodyChange={() => {}}
        onSkillApprovalStateChange={() => {}}
        onSkillRequiresConfirmationChange={() => {}}
      />
    )

    expect(screen.getByText('Kept Candidate 1')).toBeInTheDocument()
    expect(screen.getByText('Kept Candidate 2')).toBeInTheDocument()
    expect(screen.getAllByText('Kept')).toHaveLength(2)
  })

  it('should call onUndoKeep when undo button clicked in kept list', async () => {
    const user = userEvent.setup()
    const onUndoKeep = vi.fn()

    render(
      <SelectedCandidate
        candidate={undefined}
        viewingMode="kept-list"
        keptCandidates={mockKeptCandidates}
        onUndoKeep={onUndoKeep}
        knowledgeDraft={null}
        skillDraft={null}
        onGenerateKnowledge={() => {}}
        onGenerateSkill={() => {}}
        onRegenerateKnowledge={() => {}}
        onApproveKnowledge={() => {}}
        onSaveKnowledge={() => {}}
        onSaveSkill={() => {}}
        isGeneratingKnowledge={false}
        isGeneratingSkill={false}
        isRegeneratingKnowledge={false}
        isApprovingKnowledge={false}
        isSavingKnowledge={false}
        isSavingSkill={false}
        onKnowledgeTitleChange={() => {}}
        onKnowledgeSummaryChange={() => {}}
        onKnowledgeBodyChange={() => {}}
        onSkillApprovalStateChange={() => {}}
        onSkillRequiresConfirmationChange={() => {}}
      />
    )

    const undoButtons = screen.getAllByRole('button', { name: 'Undo keep' })
    await user.click(undoButtons[0])

    expect(onUndoKeep).toHaveBeenCalledWith('reviewed:candidate:test-1')
  })

  it('should render Generate Knowledge/Generate Skill buttons in kept-list mode', () => {
    render(
      <SelectedCandidate
        viewingMode="kept-list"
        keptCandidates={mockKeptCandidates}
        knowledgeDraft={null}
        skillDraft={null}
        onGenerateKnowledge={() => {}}
        onGenerateSkill={() => {}}
        onRegenerateKnowledge={() => {}}
        onApproveKnowledge={() => {}}
        onSaveKnowledge={() => {}}
        onSaveSkill={() => {}}
        isGeneratingKnowledge={false}
        isGeneratingSkill={false}
        isRegeneratingKnowledge={false}
        isApprovingKnowledge={false}
        isSavingKnowledge={false}
        isSavingSkill={false}
        onUndoKeep={() => {}}
        onKnowledgeTitleChange={() => {}}
        onKnowledgeSummaryChange={() => {}}
        onKnowledgeBodyChange={() => {}}
        onSkillApprovalStateChange={() => {}}
        onSkillRequiresConfirmationChange={() => {}}
        candidate={undefined}
      />
    )

    expect(screen.getByText('Generate Knowledge')).toBeInTheDocument()
    expect(screen.getByText('Generate Skill')).toBeInTheDocument()
  })

  it('should call onGenerateKnowledge when Generate Knowledge button clicked', async () => {
    const user = userEvent.setup()
    const onGenerateKnowledge = vi.fn()

    render(
      <SelectedCandidate
        viewingMode="kept-list"
        keptCandidates={mockKeptCandidates}
        knowledgeDraft={null}
        skillDraft={null}
        onGenerateKnowledge={onGenerateKnowledge}
        onGenerateSkill={() => {}}
        onRegenerateKnowledge={() => {}}
        onApproveKnowledge={() => {}}
        onSaveKnowledge={() => {}}
        onSaveSkill={() => {}}
        isGeneratingKnowledge={false}
        isGeneratingSkill={false}
        isRegeneratingKnowledge={false}
        isApprovingKnowledge={false}
        isSavingKnowledge={false}
        isSavingSkill={false}
        onUndoKeep={() => {}}
        onKnowledgeTitleChange={() => {}}
        onKnowledgeSummaryChange={() => {}}
        onKnowledgeBodyChange={() => {}}
        onSkillApprovalStateChange={() => {}}
        onSkillRequiresConfirmationChange={() => {}}
        candidate={undefined}
      />
    )

    await user.click(screen.getByText('Generate Knowledge'))

    expect(onGenerateKnowledge).toHaveBeenCalled()
  })

  it('should show loading state in knowledge-draft mode', () => {
    render(
      <SelectedCandidate
        viewingMode="knowledge-draft"
        knowledgeDraft={null}
        skillDraft={null}
        onGenerateKnowledge={() => {}}
        onGenerateSkill={() => {}}
        onRegenerateKnowledge={() => {}}
        onApproveKnowledge={() => {}}
        onSaveKnowledge={() => {}}
        onSaveSkill={() => {}}
        isGeneratingKnowledge={true}
        isGeneratingSkill={false}
        isRegeneratingKnowledge={false}
        isApprovingKnowledge={false}
        isSavingKnowledge={false}
        isSavingSkill={false}
        onUndoKeep={() => {}}
        onKnowledgeTitleChange={() => {}}
        onKnowledgeSummaryChange={() => {}}
        onKnowledgeBodyChange={() => {}}
        onSkillApprovalStateChange={() => {}}
        onSkillRequiresConfirmationChange={() => {}}
        candidate={undefined}
        keptCandidates={[]}
      />
    )

    expect(screen.getByText('Generating knowledge draft...')).toBeInTheDocument()
  })

  it('should show draft editing interface in knowledge-draft mode', () => {
    const mockKnowledgeDraft: KnowledgeArtifact = {
      artifactType: 'daily-review-draft',
      id: 'knowledge:test',
      draftState: 'draft',
      topicKey: null,
      title: 'Test Knowledge',
      summary: 'Test summary',
      body: 'Test body content',
      sourceReviewedMemoryIds: [],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-28T10:00:00Z',
      reviewedAt: null,
      recencyLabel: 'recent',
      provenanceRefs: [],
    }

    render(
      <SelectedCandidate
        viewingMode="knowledge-draft"
        knowledgeDraft={mockKnowledgeDraft}
        skillDraft={null}
        onGenerateKnowledge={() => {}}
        onGenerateSkill={() => {}}
        onRegenerateKnowledge={() => {}}
        onApproveKnowledge={() => {}}
        onSaveKnowledge={() => {}}
        onSaveSkill={() => {}}
        isGeneratingKnowledge={false}
        isGeneratingSkill={false}
        isRegeneratingKnowledge={false}
        isApprovingKnowledge={false}
        isSavingKnowledge={false}
        isSavingSkill={false}
        onUndoKeep={() => {}}
        onKnowledgeTitleChange={() => {}}
        onKnowledgeSummaryChange={() => {}}
        onKnowledgeBodyChange={() => {}}
        onSkillApprovalStateChange={() => {}}
        onSkillRequiresConfirmationChange={() => {}}
        candidate={undefined}
        keptCandidates={[]}
      />
    )

    expect(screen.getByText('Knowledge Draft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
  })
})
