import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import KnowledgeDetailModal from './KnowledgeDetailModal'
import type { KnowledgeArtifact } from '../../types/index'

describe('KnowledgeDetailModal', () => {
  const mockKnowledge: KnowledgeArtifact = {
    id: 'knowledge-1',
    artifactType: 'topic-knowledge',
    draftState: 'published',
    topicKey: 'test-topic',
    title: 'Test Knowledge Title',
    summary: 'Test knowledge summary',
    body: 'Test knowledge body content',
    version: 1,
    isCurrentBest: true,
    sourceReviewedMemoryIds: ['memory-1', 'memory-2'],
    updatedAt: '2026-04-21T12:00:00Z',
    provenanceRefs: [],
    supersedesKnowledgeId: undefined,
  }

  it('renders nothing when knowledge is null', () => {
    render(<KnowledgeDetailModal knowledge={null} onClose={vi.fn()} />)
    expect(screen.queryByText('Test Knowledge Title')).not.toBeInTheDocument()
  })

  it('renders knowledge title when provided', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Test Knowledge Title')).toBeInTheDocument()
  })

  it('renders knowledge summary', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Test knowledge summary')).toBeInTheDocument()
  })

  it('renders knowledge body content', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Test knowledge body content')).toBeInTheDocument()
  })

  it('renders metadata section with version', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders source count', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('2 reviewed memories')).toBeInTheDocument()
  })

  it('renders Published badge for published knowledge', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('renders Draft badge for draft knowledge', () => {
    const draftKnowledge = { ...mockKnowledge, draftState: 'draft' as const }
    render(<KnowledgeDetailModal knowledge={draftKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('renders Current Best badge when isCurrentBest is true', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Current Best')).toBeInTheDocument()
  })

  it('does not render Current Best badge when isCurrentBest is false', () => {
    const nonCurrentKnowledge = { ...mockKnowledge, isCurrentBest: false }
    render(<KnowledgeDetailModal knowledge={nonCurrentKnowledge} onClose={vi.fn()} />)
    expect(screen.queryByText('Current Best')).not.toBeInTheDocument()
  })

  it('renders Untitled Knowledge when title is missing', () => {
    const untitledKnowledge = { ...mockKnowledge, title: undefined }
    render(<KnowledgeDetailModal knowledge={untitledKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Untitled Knowledge')).toBeInTheDocument()
  })

  it('renders Close button', () => {
    const onClose = vi.fn()
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={onClose} />)
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn()
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={onClose} />)
    const closeButton = screen.getByText('Close')
    closeButton.click()
    expect(onClose).toHaveBeenCalled()
  })
})