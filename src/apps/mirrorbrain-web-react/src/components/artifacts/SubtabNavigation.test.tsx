import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubtabNavigation from './SubtabNavigation'

describe('SubtabNavigation', () => {
  it('renders 2 subtabs: History Topics and Draft Generation', () => {
    const mockOnSubtabChange = vi.fn()
    render(<SubtabNavigation activeSubtab="history-topics" onSubtabChange={mockOnSubtabChange} />)

    // Verify only 2 tabs exist
    expect(screen.getByText('History Topics')).toBeInTheDocument()
    expect(screen.getByText('Draft Generation')).toBeInTheDocument()
  })

  it('does not render Generate Knowledge subtab', () => {
    const mockOnSubtabChange = vi.fn()
    render(<SubtabNavigation activeSubtab="history-topics" onSubtabChange={mockOnSubtabChange} />)

    // Verify old tabs no longer exist
    expect(screen.queryByText('Generate Knowledge')).not.toBeInTheDocument()
  })

  it('does not render Generate Skill subtab', () => {
    const mockOnSubtabChange = vi.fn()
    render(<SubtabNavigation activeSubtab="history-topics" onSubtabChange={mockOnSubtabChange} />)

    // Verify old tabs no longer exist
    expect(screen.queryByText('Generate Skill')).not.toBeInTheDocument()
  })

  it('highlights History Topics as active when selected', () => {
    const mockOnSubtabChange = vi.fn()
    render(<SubtabNavigation activeSubtab="history-topics" onSubtabChange={mockOnSubtabChange} />)

    // Verify at least one History Topics button is highlighted
    const historyTopicsButtons = screen.getAllByText('History Topics')
    const activeButton = historyTopicsButtons.find(btn => btn.className.includes('bg-blue-600'))
    expect(activeButton).toBeDefined()
  })

  it('highlights Draft Generation as active when selected', () => {
    const mockOnSubtabChange = vi.fn()
    render(<SubtabNavigation activeSubtab="draft-generation" onSubtabChange={mockOnSubtabChange} />)

    // Verify at least one Draft Generation button is highlighted
    const draftGenerationButtons = screen.getAllByText('Draft Generation')
    const activeButton = draftGenerationButtons.find(btn => btn.className.includes('bg-blue-600'))
    expect(activeButton).toBeDefined()
  })
})