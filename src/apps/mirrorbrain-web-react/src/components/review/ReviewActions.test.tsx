// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ReviewActions from './ReviewActions'

describe('ReviewActions', () => {
  it('renders daily-candidate feedback to the left of the create button', () => {
    const { container } = render(
      <ReviewActions
        onCreateCandidates={() => {}}
        isCreatingCandidates={false}
        isReviewing={false}
        feedback={{ kind: 'success', message: 'Created 3 daily candidates' }}
      />
    )

    const button = screen.getByRole('button', { name: 'Create Daily Candidates' })
    const alert = screen.getByRole('alert')

    expect(alert.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(alert.textContent ?? '').toContain('Created 3 daily candidates')
    expect(alert.className).toContain('p-3')
    expect(alert.className).toContain('rounded-lg')
    expect(alert.className).toContain('border')
    expect(alert.className).toContain('flex-1')
    expect(container.firstElementChild?.className ?? '').toContain('items-stretch')
  })
})
