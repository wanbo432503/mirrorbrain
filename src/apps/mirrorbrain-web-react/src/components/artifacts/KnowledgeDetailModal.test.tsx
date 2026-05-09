// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import KnowledgeDetailModal from './KnowledgeDetailModal'
import type { KnowledgeArtifact } from '../../types/index'

describe('KnowledgeDetailModal', () => {
  afterEach(() => {
    cleanup()
  })

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
    expect(screen.queryByText('Test Knowledge Title')).toBeNull()
  })

  it('renders knowledge title when provided', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Test Knowledge Title')).not.toBeNull()
  })

  it('renders knowledge summary', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Test knowledge summary')).not.toBeNull()
  })

  it('renders knowledge body content', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Test knowledge body content')).not.toBeNull()
  })

  it('renders metadata section with version', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('1')).not.toBeNull()
  })

  it('renders source count', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('2 reviewed memories')).not.toBeNull()
  })

  it('renders Published badge for published knowledge', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Published')).not.toBeNull()
  })

  it('renders Draft badge for draft knowledge', () => {
    const draftKnowledge = { ...mockKnowledge, draftState: 'draft' as const }
    render(<KnowledgeDetailModal knowledge={draftKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Draft')).not.toBeNull()
  })

  it('renders Current Best badge when isCurrentBest is true', () => {
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Current Best')).not.toBeNull()
  })

  it('does not render Current Best badge when isCurrentBest is false', () => {
    const nonCurrentKnowledge = { ...mockKnowledge, isCurrentBest: false }
    render(<KnowledgeDetailModal knowledge={nonCurrentKnowledge} onClose={vi.fn()} />)
    expect(screen.queryByText('Current Best')).toBeNull()
  })

  it('renders Untitled Knowledge when title is missing', () => {
    const untitledKnowledge = { ...mockKnowledge, title: undefined }
    render(<KnowledgeDetailModal knowledge={untitledKnowledge} onClose={vi.fn()} />)
    expect(screen.getByText('Untitled Knowledge')).not.toBeNull()
  })

  it('renders Close button', () => {
    const onClose = vi.fn()
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={onClose} />)
    expect(screen.getByText('Close')).not.toBeNull()
  })

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn()
    render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={onClose} />)
    const closeButton = screen.getByText('Close')
    closeButton.click()
    expect(onClose).toHaveBeenCalled()
  })

  describe('wiki-link integration', () => {
    it('renders wiki-links in body', () => {
      const knowledgeWithWikiLinks = {
        ...mockKnowledge,
        body: 'Focus on [[react]] with [[hooks]]',
      }

      render(<KnowledgeDetailModal knowledge={knowledgeWithWikiLinks} onClose={vi.fn()} />)

      expect(screen.getByText('react')).toBeDefined()
      expect(screen.getByText('hooks')).toBeDefined()
    })

    it('calls onWikiLinkClick when wiki-link is clicked', () => {
      const knowledgeWithWikiLinks = {
        ...mockKnowledge,
        body: 'Check [[authentication]] guide',
      }

      const onWikiLinkClick = vi.fn()
      render(
        <KnowledgeDetailModal
          knowledge={knowledgeWithWikiLinks}
          onClose={vi.fn()}
          onWikiLinkClick={onWikiLinkClick}
        />,
      )

      const wikiLink = screen.getByText('authentication')
      fireEvent.click(wikiLink)

      expect(onWikiLinkClick).toHaveBeenCalledWith('authentication')
    })
  })

  describe('tags display', () => {
    it('renders tags section when tags exist', () => {
      const knowledgeWithTags = {
        ...mockKnowledge,
        tags: ['react', 'hooks', 'state'],
      }

      render(<KnowledgeDetailModal knowledge={knowledgeWithTags} onClose={vi.fn()} />)

      expect(screen.getByText('Tags')).toBeDefined()
      expect(screen.getByText('react')).toBeDefined()
      expect(screen.getByText('hooks')).toBeDefined()
      expect(screen.getByText('state')).toBeDefined()
    })

    it('does not render tags section when tags are empty', () => {
      render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)

      expect(screen.queryByText('Tags')).toBeNull()
    })
  })

  describe('related knowledge display', () => {
    it('renders related knowledge section when relations exist', () => {
      const knowledgeWithRelations = {
        ...mockKnowledge,
        relatedKnowledgeIds: ['knowledge-2', 'knowledge-3'],
      }

      render(<KnowledgeDetailModal knowledge={knowledgeWithRelations} onClose={vi.fn()} />)

      expect(screen.getByText('Related Knowledge (2)')).toBeDefined()
    })

    it('renders related knowledge links', () => {
      const knowledgeWithRelations = {
        ...mockKnowledge,
        relatedKnowledgeIds: ['knowledge-2', 'knowledge-3'],
      }

      render(<KnowledgeDetailModal knowledge={knowledgeWithRelations} onClose={vi.fn()} />)

      expect(screen.getByText('knowledge-2')).toBeDefined()
      expect(screen.getByText('knowledge-3')).toBeDefined()
    })

    it('calls onWikiLinkClick when related knowledge link is clicked', () => {
      const knowledgeWithRelations = {
        ...mockKnowledge,
        relatedKnowledgeIds: ['knowledge-2'],
      }

      const onWikiLinkClick = vi.fn()
      render(
        <KnowledgeDetailModal
          knowledge={knowledgeWithRelations}
          onClose={vi.fn()}
          onWikiLinkClick={onWikiLinkClick}
        />,
      )

      const relatedLink = screen.getByText('knowledge-2')
      fireEvent.click(relatedLink)

      expect(onWikiLinkClick).toHaveBeenCalledWith('knowledge-2')
    })

    it('does not render related knowledge section when no relations', () => {
      render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)

      expect(screen.queryByText('Related Knowledge')).toBeNull()
    })

    it('limits display to 5 related knowledge items', () => {
      const knowledgeWithManyRelations = {
        ...mockKnowledge,
        relatedKnowledgeIds: [
          'k1',
          'k2',
          'k3',
          'k4',
          'k5',
          'k6',
          'k7',
        ],
      }

      render(<KnowledgeDetailModal knowledge={knowledgeWithManyRelations} onClose={vi.fn()} />)

      // Should show count of 7 but only render 5 links
      expect(screen.getByText('Related Knowledge (7)')).toBeDefined()
      expect(screen.getByText('k1')).toBeDefined()
      expect(screen.getByText('k5')).toBeDefined()
      expect(screen.queryByText('k6')).toBeNull()
      expect(screen.queryByText('k7')).toBeNull()
    })
  })

  describe('compilation metadata', () => {
    it('renders compilation indicator when metadata exists', () => {
      const knowledgeWithCompilation = {
        ...mockKnowledge,
        compilationMetadata: {
          discoveryInsights: ['Primary focus: testing'],
          generationMethod: 'two-stage-compilation' as const,
          executeStageCompletedAt: '2026-01-01T12:00:00Z',
        },
      }

      render(<KnowledgeDetailModal knowledge={knowledgeWithCompilation} onClose={vi.fn()} />)

      expect(screen.getByText('Compilation')).toBeDefined()
      expect(screen.getByText('Two-stage compilation')).toBeDefined()
    })

    it('does not render compilation indicator when metadata missing', () => {
      render(<KnowledgeDetailModal knowledge={mockKnowledge} onClose={vi.fn()} />)

      expect(screen.queryByText('Compilation')).toBeNull()
    })
  })
})
