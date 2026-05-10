// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SyncActions from './SyncActions'

afterEach(() => {
  cleanup()
})

describe('SyncActions', () => {
  it('renders browser and shell sync buttons with the same visual treatment', () => {
    render(
      <SyncActions
        onSyncBrowser={vi.fn()}
        onSyncShell={vi.fn()}
        isSyncingBrowser={false}
        isSyncingShell={false}
      />
    )

    expect(screen.getByRole('button', { name: 'Sync Shell' }).className).toBe(
      screen.getByRole('button', { name: 'Sync Browser' }).className
    )
  })
})
