import { describe, expect, it } from 'vitest'

import { buildCandidateEvidenceSummary } from './ReviewGuidance'

describe('ReviewGuidance helpers', () => {
  it('summarizes primary and supporting evidence counts for guidance copy', () => {
    expect(
      buildCandidateEvidenceSummary([
        {
          contribution: 'primary',
        },
        {
          contribution: 'primary',
        },
        {
          contribution: 'supporting',
        },
      ])
    ).toBe('Built from 2 primary pages and 1 supporting page.')
  })
})
