import { describe, expect, it } from 'vitest'

import { shouldLoadMemoryEvents } from './MemoryPanel'

describe('MemoryPanel', () => {
  it('loads memory only before the first successful memory fetch', () => {
    expect(
      shouldLoadMemoryEvents({
        hasLoadedMemoryEvents: false,
      })
    ).toBe(true)

    expect(
      shouldLoadMemoryEvents({
        hasLoadedMemoryEvents: true,
      })
    ).toBe(false)
  })
})
