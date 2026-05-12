// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SyncActions from './SyncActions'

afterEach(() => {
  cleanup()
})

describe('SyncActions', () => {
  it('renders source import, shell, filesystem, and screenshot buttons with the same visual treatment', () => {
    render(
      <SyncActions
        onImportSources={vi.fn()}
        onSyncShell={vi.fn()}
        onSyncFilesystems={vi.fn()}
        onSyncScreenshot={vi.fn()}
        isImportingSources={false}
        isSyncingShell={false}
      />
    )

    const importClassName = screen.getByRole('button', { name: 'Import Sources' }).className
    expect(screen.getByRole('button', { name: 'Sync Shell' }).className).toBe(importClassName)
    expect(screen.getByRole('button', { name: 'Sync Filesystems' }).className).toBe(importClassName)
    expect(screen.getByRole('button', { name: 'Sync Screenshot' }).className).toBe(importClassName)
  })
})
