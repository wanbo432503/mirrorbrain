import { describe, expect, it } from 'vitest'

import { getDefaultReviewDate, getLocalTimeZone } from './ReviewPanel'

describe('ReviewPanel helpers', () => {
  it('uses yesterday as the default review date', () => {
    expect(getDefaultReviewDate(new Date('2026-04-15T12:00:00+08:00'))).toBe('2026-04-14')
  })

  it('returns the local timezone for review requests', () => {
    expect(getLocalTimeZone()).toBeTruthy()
  })
})
