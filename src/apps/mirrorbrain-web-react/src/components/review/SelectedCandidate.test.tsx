import { describe, expect, it } from 'vitest'

import {
  formatCandidateDuration,
  splitCandidateSourcesByContribution,
} from './SelectedCandidate'

describe('SelectedCandidate helpers', () => {
  it('formats candidate duration from the candidate time range', () => {
    expect(
      formatCandidateDuration('2026-04-14T08:00:00.000Z', '2026-04-14T08:45:00.000Z')
    ).toBe('45 minutes')

    expect(
      formatCandidateDuration('2026-04-14T08:00:00.000Z', '2026-04-14T10:15:00.000Z')
    ).toBe('2h 15m')
  })

  it('splits candidate sources into primary and supporting groups', () => {
    const groups = splitCandidateSourcesByContribution([
      {
        id: 'browser:docs',
        sourceType: 'activitywatch-browser',
        timestamp: '2026-04-14T09:00:00.000Z',
        title: 'Cache invalidation guide',
        url: 'https://docs.example.com/cache/invalidation',
        role: 'docs',
        contribution: 'primary',
      },
      {
        id: 'browser:search',
        sourceType: 'activitywatch-browser',
        timestamp: '2026-04-14T09:05:00.000Z',
        title: 'stale cache - Google Search',
        url: 'https://google.com/search?q=stale+cache',
        role: 'search',
        contribution: 'supporting',
      },
    ])

    expect(groups.primary).toEqual([
      expect.objectContaining({ id: 'browser:docs', contribution: 'primary' }),
    ])
    expect(groups.supporting).toEqual([
      expect.objectContaining({ id: 'browser:search', contribution: 'supporting' }),
    ])
  })
})
