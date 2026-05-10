// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SkillPanel from './SkillPanel'
import type { SkillArtifact } from '../../types/index'

afterEach(() => {
  cleanup()
})

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

describe('SkillPanel', () => {
  it('shows generated skills newest first and defaults the detail to the newest skill', () => {
    render(
      <SkillPanel
        skillArtifacts={[olderSkill, newerSkill]}
        onDeleteSkillArtifact={vi.fn()}
      />
    )

    const historyPanel = screen.getByTestId('skill-history-panel')
    const items = within(historyPanel).getAllByTestId('skill-list-item')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('skill-new')
    expect(items[1].textContent).toContain('skill-old')

    const detailPanel = screen.getByTestId('skill-detail-panel')
    expect(within(detailPanel).getAllByText('Approval: approved').length).toBeGreaterThan(0)
    expect(within(detailPanel).getByText('reviewed:new')).not.toBeNull()
  })
})
