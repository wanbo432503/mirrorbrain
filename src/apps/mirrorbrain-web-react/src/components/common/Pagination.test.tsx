import { describe, expect, it } from 'vitest'

import { getPaginationControlState } from './Pagination'

describe('Pagination helpers', () => {
  it('enables first and previous only after page 1, and next and last before final page', () => {
    expect(getPaginationControlState(1, 4)).toEqual({
      canGoFirst: false,
      canGoPrevious: false,
      canGoNext: true,
      canGoLast: true,
    })

    expect(getPaginationControlState(3, 4)).toEqual({
      canGoFirst: true,
      canGoPrevious: true,
      canGoNext: true,
      canGoLast: true,
    })

    expect(getPaginationControlState(4, 4)).toEqual({
      canGoFirst: true,
      canGoPrevious: true,
      canGoNext: false,
      canGoLast: false,
    })
  })
})
