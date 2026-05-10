// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MirrorBrainProvider } from '../../contexts/MirrorBrainContext'
import MemoryPanel from './MemoryPanel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

function stubMemoryPanelFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (method === 'GET' && url.endsWith('/memory?page=1&pageSize=10')) {
      return new Response(
        JSON.stringify({
          items: [],
          pagination: {
            total: 0,
            page: 1,
            pageSize: 10,
            totalPages: 0,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (method === 'POST' && url.endsWith('/sync/shell')) {
      return new Response(
        JSON.stringify({
          message: 'Shell history sync is not configured for this MirrorBrain runtime',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
  return fetchMock
}

describe('MemoryPanel sync actions', () => {
  it('renders unsupported source sync buttons and shows info feedback when they are clicked', async () => {
    stubMemoryPanelFetch()
    const user = userEvent.setup()

    render(
      <MirrorBrainProvider>
        <MemoryPanel />
      </MirrorBrainProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sync Browser' })).not.toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'Sync Filesystems' }))

    const filesystemsAlert = await screen.findByRole('alert')
    expect(within(filesystemsAlert).getByText('Filesystem history sync is not configured for this MirrorBrain runtime')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Sync Screenshot' }))

    const screenshotAlert = await screen.findByRole('alert')
    expect(within(screenshotAlert).getByText('Screenshot history sync is not configured for this MirrorBrain runtime')).not.toBeNull()
  })

  it('treats shell sync not-configured responses as info instead of an error banner', async () => {
    stubMemoryPanelFetch()
    const user = userEvent.setup()

    render(
      <MirrorBrainProvider>
        <MemoryPanel />
      </MirrorBrainProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sync Shell' })).not.toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'Sync Shell' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Shell history sync is not configured for this MirrorBrain runtime')).not.toBeNull()
  })
})
