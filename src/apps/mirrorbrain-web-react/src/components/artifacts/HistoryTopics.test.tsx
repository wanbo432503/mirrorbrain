// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HistoryTopics from './HistoryTopics'
import type { KnowledgeArtifact, SkillArtifact } from '../../types/index'

describe('HistoryTopics', () => {
  afterEach(() => {
    cleanup()
  })

  const olderKnowledge: KnowledgeArtifact = {
    id: 'knowledge-old',
    draftState: 'published',
    artifactType: 'topic-knowledge',
    title: 'Older knowledge',
    summary: 'Older summary',
    body: 'Older body',
    sourceReviewedMemoryIds: ['reviewed:old'],
    updatedAt: '2026-04-20T10:00:00.000Z',
  }

  const newerKnowledge: KnowledgeArtifact = {
    id: 'knowledge-new',
    draftState: 'published',
    artifactType: 'topic-knowledge',
    title: 'Newer knowledge',
    summary: 'Newer summary',
    body: 'Newer body',
    sourceReviewedMemoryIds: ['reviewed:new'],
    updatedAt: '2026-04-29T10:00:00.000Z',
  }

  const olderSkill: SkillArtifact = {
    id: 'skill-old',
    approvalState: 'draft',
    workflowEvidenceRefs: ['reviewed:old'],
    executionSafetyMetadata: { requiresConfirmation: true },
    updatedAt: '2026-04-18T10:00:00.000Z',
  }

  const newerSkill: SkillArtifact = {
    id: 'skill-new',
    approvalState: 'approved',
    workflowEvidenceRefs: ['reviewed:new'],
    executionSafetyMetadata: { requiresConfirmation: true },
    updatedAt: '2026-04-28T10:00:00.000Z',
  }

  it('shows knowledge and skill subtabs with timeline items ordered newest first', async () => {
    const user = userEvent.setup()

    render(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[olderKnowledge, newerKnowledge]}
        skillArtifacts={[olderSkill, newerSkill]}
      />
    )

    expect(screen.getByRole('tab', { name: 'Knowledge' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: 'Skill' })).not.toBeNull()

    const knowledgeItems = screen.getAllByTestId('artifact-list-item')
    expect(knowledgeItems[0].textContent).toContain('Newer knowledge')
    expect(knowledgeItems[1].textContent).toContain('Older knowledge')
    expect(screen.getByText('Newer body')).not.toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Skill' }))

    const skillItems = screen.getAllByTestId('artifact-list-item')
    expect(skillItems[0].textContent).toContain('skill-new')
    expect(skillItems[1].textContent).toContain('skill-old')
    expect(screen.getAllByText('Approval: approved').length).toBeGreaterThan(0)
  })

  it('updates the single detail display and supports conversational local edits', async () => {
    const user = userEvent.setup()

    render(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[newerKnowledge, olderKnowledge]}
        skillArtifacts={[newerSkill]}
      />
    )

    await user.click(screen.getByRole('button', { name: /Older knowledge/ }))
    expect(screen.getByText('Older body')).not.toBeNull()

    await user.type(
      screen.getByLabelText('Artifact Edit Message'),
      'Add a note about provenance.'
    )
    await user.click(screen.getByRole('button', { name: 'Apply Message' }))

    expect(screen.getByText(/Add a note about provenance/)).not.toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Skill' }))
    await user.type(
      screen.getByLabelText('Artifact Edit Message'),
      'Clarify execution requires confirmation.'
    )
    await user.click(screen.getByRole('button', { name: 'Apply Message' }))

    expect(screen.getByText(/Clarify execution requires confirmation/)).not.toBeNull()
  })
})
