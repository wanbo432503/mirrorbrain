import { describe, expect, it } from 'vitest'

import { formatCandidateDuration } from './SelectedCandidate'

describe('SelectedCandidate helpers', () => {
  it('formats candidate duration from the candidate time range', () => {
    expect(
      formatCandidateDuration('2026-04-14T08:00:00.000Z', '2026-04-14T08:45:00.000Z')
    ).toBe('45 minutes')

    expect(
      formatCandidateDuration('2026-04-14T08:00:00.000Z', '2026-04-14T10:15:00.000Z')
    ).toBe('2h 15m')
  })
})
