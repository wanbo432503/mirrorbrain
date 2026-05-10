import { describe, expect, it, vi } from 'vitest'

import {
  FALLBACK_USER_TIME_ZONE,
  formatUserDateTime,
  getUserTimeZone,
} from './user-time'

describe('user time formatting', () => {
  it('formats UTC timestamps in the requested user timezone', () => {
    expect(formatUserDateTime('2026-05-10T16:30:00.000Z', 'Asia/Shanghai')).toBe(
      '2026-05-11 00:30'
    )
    expect(formatUserDateTime('2026-05-10T16:30:00.000Z', 'UTC')).toBe(
      '2026-05-10 16:30'
    )
  })

  it('keeps invalid timestamps visible instead of throwing', () => {
    expect(formatUserDateTime('not-a-timestamp', 'Asia/Shanghai')).toBe('not-a-timestamp')
  })

  it('falls back to Shanghai when the browser does not expose an IANA timezone', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({}),
    } as Intl.DateTimeFormat)

    expect(getUserTimeZone()).toBe(FALLBACK_USER_TIME_ZONE)

    spy.mockRestore()
  })
})
