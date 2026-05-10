// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SyncActions from './SyncActions'

afterEach(() => {
  cleanup()
})

describe('SyncActions', () => {
  it('renders browser, shell, filesystem, and screenshot sync buttons with the same visual treatment', () => {
    render(
      <SyncActions
        onSyncBrowser={vi.fn()}
        onSyncShell={vi.fn()}
        onSyncFilesystems={vi.fn()}
        onSyncScreenshot={vi.fn()}
        isSyncingBrowser={false}
        isSyncingShell={false}
      />
    )

    const browserClassName = screen.getByRole('button', { name: 'Sync Browser' }).className
    expect(screen.getByRole('button', { name: 'Sync Shell' }).className).toBe(browserClassName)
    expect(screen.getByRole('button', { name: 'Sync Filesystems' }).className).toBe(browserClassName)
    expect(screen.getByRole('button', { name: 'Sync Screenshot' }).className).toBe(browserClassName)
  })
})
