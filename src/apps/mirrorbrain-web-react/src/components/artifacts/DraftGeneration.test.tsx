import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DraftGeneration from './DraftGeneration'
import type { ReviewedMemory, KnowledgeArtifact, SkillArtifact } from '../../types/index'

describe('DraftGeneration', () => {
  const mockReviewedMemories: ReviewedMemory[] = [
    {
      id: 'reviewed-1',
      candidateMemoryId: 'candidate-1',
      candidateTitle: 'Test Work',
      candidateSummary: 'Test summary',
      candidateTheme: 'research',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-14',
      decision: 'keep',
      reviewedAt: '2026-04-15T10:00:00Z',
    },
  ]

  const mockKnowledgeDraft: KnowledgeArtifact = {
    id: 'knowledge-1',
    title: 'Test Knowledge',
    summary: 'Test knowledge summary',
    body: 'Test knowledge body',
    sourceMemoryIds: ['reviewed-1'],
    generatedAt: '2026-04-15T10:00:00Z',
    reviewStatus: 'draft',
  }

  const mockSkillDraft: SkillArtifact = {
    id: 'skill-1',
    approvalState: 'draft',
    workflowEvidenceRefs: ['reviewed-1'],
    executionSafetyMetadata: {
      requiresConfirmation: true,
    },
  }

  const defaultProps = {
    reviewedMemories: mockReviewedMemories,
    knowledgeDraft: null,
    skillDraft: null,
    onGenerateKnowledge: vi.fn(),
    onGenerateSkill: vi.fn(),
    onSaveKnowledge: vi.fn(),
    onSaveSkill: vi.fn(),
    isGeneratingKnowledge: false,
    isGeneratingSkill: false,
    isSavingKnowledge: false,
    isSavingSkill: false,
    onKnowledgeTitleChange: vi.fn(),
    onKnowledgeSummaryChange: vi.fn(),
    onKnowledgeBodyChange: vi.fn(),
    onSkillApprovalStateChange: vi.fn(),
    onSkillRequiresConfirmationChange: vi.fn(),
  }

  it('renders 3-column layout with Source Context, Knowledge Draft, and Skill Draft', () => {
    render(<DraftGeneration {...defaultProps} />)

    // Verify 3 column headers exist
    expect(screen.getByText('Source Context')).toBeInTheDocument()
    expect(screen.getByText('Knowledge Draft')).toBeInTheDocument()
    expect(screen.getByText('Skill Draft')).toBeInTheDocument()
  })

  it('renders Source Context column with reviewed memories', () => {
    render(<DraftGeneration {...defaultProps} />)

    // Verify CandidateContext shows reviewed memory title (appears multiple times, use getAllByText)
    const testWorkElements = screen.getAllByText('Test Work')
    expect(testWorkElements.length).toBeGreaterThan(0)
  })

  it('renders Knowledge Draft column with DraftEditor', () => {
    render(<DraftGeneration {...defaultProps} knowledgeDraft={mockKnowledgeDraft} />)

    // Verify Knowledge Draft Editor shows draft title
    expect(screen.getByDisplayValue('Test Knowledge')).toBeInTheDocument()
  })

  it('renders Skill Draft column with DraftEditor', () => {
    render(<DraftGeneration {...defaultProps} skillDraft={mockSkillDraft} />)

    // Verify Skill Draft Editor shows approval state
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('uses grid-cols-3 for equal column widths on large screens', () => {
    const { container } = render(<DraftGeneration {...defaultProps} />)

    // Verify grid layout class
    const gridContainer = container.querySelector('.grid-cols-1.lg\\:grid-cols-3')
    expect(gridContainer).toBeInTheDocument()
  })

  it('uses grid-cols-1 for vertical stacking on small screens', () => {
    const { container } = render(<DraftGeneration {...defaultProps} />)

    // Verify responsive grid classes
    const gridContainer = container.querySelector('.grid-cols-1')
    expect(gridContainer).toBeInTheDocument()
  })

  })