import { describe, expect, it } from 'vitest'

import {
  getDefaultReviewDate,
  getLocalTimeZone,
  shouldAutoLoadDailyCandidates,
} from './ReviewPanel'

describe('ReviewPanel helpers', () => {
  it('uses yesterday as the default review date', () => {
    expect(getDefaultReviewDate(new Date('2026-04-15T12:00:00+08:00'))).toBe('2026-04-14')
  })

  it('returns the local timezone for review requests', () => {
    expect(getLocalTimeZone()).toBeTruthy()
  })

  it('waits for the first memory load before auto-generating candidates', () => {
    expect(
      shouldAutoLoadDailyCandidates({
        hasAutoLoaded: false,
        candidateCount: 0,
        hasLoadedMemoryEvents: false,
      })
    ).toBe(false)

    expect(
      shouldAutoLoadDailyCandidates({
        hasAutoLoaded: false,
        candidateCount: 0,
        hasLoadedMemoryEvents: true,
      })
    ).toBe(true)

    expect(
      shouldAutoLoadDailyCandidates({
        hasAutoLoaded: true,
        candidateCount: 0,
        hasLoadedMemoryEvents: true,
      })
    ).toBe(false)

    expect(
      shouldAutoLoadDailyCandidates({
        hasAutoLoaded: false,
        candidateCount: 2,
        hasLoadedMemoryEvents: true,
      })
    ).toBe(false)
  })
})
