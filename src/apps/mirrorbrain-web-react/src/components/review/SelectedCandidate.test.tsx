import { describe, expect, it } from 'vitest'

import {
  formatCandidateDuration,
  getCandidateDiscardReasons,
  getCandidateFormationReasons,
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

  it('returns explicit formation reasons and falls back to a default explanation', () => {
    expect(
      getCandidateFormationReasons({
        formationReasons: [
          'Started from docs evidence on Cache Invalidation.',
          'This candidate absorbed 1 low-evidence visit from Work on Search Results to stay within the 10-task daily review limit.',
        ],
      })
    ).toEqual([
      'Started from docs evidence on Cache Invalidation.',
      'This candidate absorbed 1 low-evidence visit from Work on Search Results to stay within the 10-task daily review limit.',
    ])

    expect(
      getCandidateFormationReasons({})
    ).toEqual([
      'This candidate was formed from related browser activity in the selected review window.',
    ])
  })

  it('returns explicit discard reasons and falls back to an empty list', () => {
    expect(
      getCandidateDiscardReasons({
        discardReasons: [
          'Excluded 2 low-evidence pages near this task because they did not share enough evidence to stand alone.',
        ],
      })
    ).toEqual([
      'Excluded 2 low-evidence pages near this task because they did not share enough evidence to stand alone.',
    ])

    expect(getCandidateDiscardReasons({})).toEqual([])
  })
})
