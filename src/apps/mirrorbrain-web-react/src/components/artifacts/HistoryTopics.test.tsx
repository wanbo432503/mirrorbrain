// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
    render(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[newerKnowledge, olderKnowledge]}
        skillArtifacts={[newerSkill]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Older knowledge/ }))
    expect(screen.getByText('Older body')).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Artifact Edit Message'), {
      target: { value: 'Add a note about provenance.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByText(/Add a note about provenance/)).not.toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Skill' }))
    fireEvent.change(screen.getByLabelText('Artifact Edit Message'), {
      target: { value: 'Clarify execution requires confirmation.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByText(/Clarify execution requires confirmation/)).not.toBeNull()
  })

  it('keeps the detail display the same height as the artifact history panel', () => {
    render(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[newerKnowledge]}
        skillArtifacts={[newerSkill]}
      />
    )

    expect(screen.getByTestId('artifact-history-panel').className).toContain('h-[680px]')
    expect(screen.getByTestId('artifact-detail-panel').className).toContain('h-[680px]')
  })

  it('renders artifact edit message as a one-line full-width input row with send action', () => {
    render(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[newerKnowledge]}
        skillArtifacts={[newerSkill]}
      />
    )

    expect(screen.getByTestId('artifact-edit-message-row').className).toContain('flex')
    expect(screen.getByTestId('artifact-edit-message-row').className).toContain('w-full')
    expect(screen.getByTestId('artifact-edit-message-field').className).toContain('flex-1')

    const editMessage = screen.getByLabelText('Artifact Edit Message')
    expect(editMessage.tagName.toLowerCase()).toBe('input')
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeNull()
  })

  it('shows only the published knowledge item for an approved draft lineage and renders all knowledge fields', async () => {
    const user = userEvent.setup()

    const knowledgeDraft: KnowledgeArtifact = {
      id: 'knowledge-draft:shared-lineage',
      draftState: 'draft',
      artifactType: 'daily-review-draft',
      title: 'Shared lineage knowledge',
      summary: 'Draft summary',
      body: 'Draft body',
      sourceReviewedMemoryIds: ['reviewed:shared-1'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-28T10:00:00.000Z',
      reviewedAt: '2026-04-28T09:00:00.000Z',
      recencyLabel: '2026-04-28',
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed:shared-1' }],
    }
    const publishedKnowledge: KnowledgeArtifact = {
      ...knowledgeDraft,
      id: 'topic-knowledge:shared-lineage:v1',
      draftState: 'published',
      artifactType: 'topic-knowledge',
      topicKey: 'shared-lineage',
      title: 'Shared lineage knowledge',
      summary: 'Published summary',
      body: 'Published body',
      isCurrentBest: true,
      updatedAt: '2026-04-29T10:00:00.000Z',
      reviewedAt: '2026-04-29T09:00:00.000Z',
      recencyLabel: '2026-04-29',
      supersedesKnowledgeId: null,
      derivedFromKnowledgeIds: ['knowledge-draft:shared-lineage'],
    }
    const skillDraft: SkillArtifact = {
      id: 'skill-draft:shared-lineage',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed:shared-2'],
      executionSafetyMetadata: { requiresConfirmation: true },
      updatedAt: '2026-04-28T10:00:00.000Z',
    }
    const publishedSkill: SkillArtifact = {
      ...skillDraft,
      id: 'skill-draft:shared-lineage:approved',
      approvalState: 'approved',
      updatedAt: '2026-04-29T10:00:00.000Z',
    }

    render(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[knowledgeDraft, publishedKnowledge]}
        skillArtifacts={[skillDraft, publishedSkill]}
      />
    )

    expect(screen.getAllByTestId('artifact-list-item')).toHaveLength(1)
    expect(screen.getAllByTestId('artifact-list-item')[0].textContent).toContain('Shared lineage knowledge')
    expect(screen.getAllByTestId('artifact-list-item')[0].textContent).toContain('Published summary')
    expect(screen.getByText('Published body')).not.toBeNull()
    expect(screen.getByText('Topic: shared-lineage')).not.toBeNull()
    expect(screen.getByText('Version: 1')).not.toBeNull()
    expect(screen.getByText('Current best: yes')).not.toBeNull()
    expect(screen.getByText('Recency: 2026-04-29')).not.toBeNull()
    expect(screen.getByText('reviewed:shared-1')).not.toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Skill' }))

    expect(screen.getAllByTestId('artifact-list-item')).toHaveLength(2)
    expect(screen.getAllByTestId('artifact-list-item')[0].textContent).toContain('skill-draft:shared-lineage:approved')
  })

  it('does not reveal draft knowledge when its published artifact is removed from the list', () => {
    const knowledgeDraft: KnowledgeArtifact = {
      id: 'knowledge-draft:shared-lineage',
      draftState: 'draft',
      artifactType: 'daily-review-draft',
      title: 'Shared lineage knowledge',
      summary: 'Draft summary',
      body: 'Draft body',
      sourceReviewedMemoryIds: ['reviewed:shared-1'],
      derivedFromKnowledgeIds: [],
      updatedAt: '2026-04-28T10:00:00.000Z',
    }
    const publishedKnowledge: KnowledgeArtifact = {
      ...knowledgeDraft,
      id: 'topic-knowledge:shared-lineage:v1',
      draftState: 'published',
      artifactType: 'topic-knowledge',
      summary: 'Published summary',
      body: 'Published body',
      derivedFromKnowledgeIds: ['knowledge-draft:shared-lineage'],
      updatedAt: '2026-04-29T10:00:00.000Z',
    }

    const { rerender } = render(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[knowledgeDraft, publishedKnowledge]}
        skillArtifacts={[]}
      />
    )

    expect(screen.getAllByTestId('artifact-list-item')).toHaveLength(1)
    expect(screen.getByText('Published body')).not.toBeNull()

    rerender(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[knowledgeDraft]}
        skillArtifacts={[]}
      />
    )

    expect(screen.queryByTestId('artifact-list-item')).toBeNull()
    expect(screen.getByText('No knowledge yet')).not.toBeNull()
  })

  it('shows delete actions for generated knowledge and skills and forwards the selected id', async () => {
    const user = userEvent.setup()
    const deleteKnowledge = vi.fn(async () => undefined)
    const deleteSkill = vi.fn(async () => undefined)

    render(
      <HistoryTopics
        knowledgeTopics={[]}
        knowledgeArtifacts={[newerKnowledge]}
        skillArtifacts={[newerSkill]}
        onDeleteKnowledgeArtifact={deleteKnowledge}
        onDeleteSkillArtifact={deleteSkill}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Delete Knowledge' }))
    expect(deleteKnowledge).toHaveBeenCalledWith('knowledge-new')

    await user.click(screen.getByRole('tab', { name: 'Skill' }))
    await user.click(screen.getByRole('button', { name: 'Delete Skill' }))
    expect(deleteSkill).toHaveBeenCalledWith('skill-new')
  })
})
