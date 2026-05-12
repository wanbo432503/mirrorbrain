// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('App', () => {
  function stubInitialAppFetch() {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'running' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/memory')) {
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

      if (url.includes('/memory?page=1&pageSize=10')) {
        return new Response(
          JSON.stringify({
            items: [],
            pagination: {
              total: 25,
              page: 1,
              pageSize: 10,
              totalPages: 3,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (url.endsWith('/knowledge')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'topic-knowledge:refresh-test:v1',
                draftState: 'published',
                artifactType: 'topic-knowledge',
                topicKey: 'refresh-test',
                title: 'Refresh knowledge',
                summary: 'Reloaded from backend',
                body: 'Reloaded knowledge body',
                sourceReviewedMemoryIds: ['reviewed:refresh-test'],
                derivedFromKnowledgeIds: [],
                version: 1,
                isCurrentBest: true,
                supersedesKnowledgeId: null,
                updatedAt: '2026-04-29T10:00:00.000Z',
                reviewedAt: '2026-04-29T09:00:00.000Z',
                recencyLabel: '2026-04-29',
                provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed:refresh-test' }],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (url.endsWith('/knowledge/topics')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/knowledge/graph')) {
        return new Response(
          JSON.stringify({
            graph: {
              generatedAt: '2026-04-29T10:00:00.000Z',
              stats: {
                topics: 1,
                knowledgeArtifacts: 1,
                wikilinkReferences: 0,
                similarityRelations: 0,
              },
              nodes: [
                {
                  id: 'knowledge-artifact:topic-knowledge:refresh-test:v1',
                  type: 'knowledge-artifact',
                  label: 'Refresh knowledge',
                  topicKey: 'refresh-test',
                  properties: {
                    artifactId: 'topic-knowledge:refresh-test:v1',
                    title: 'Refresh knowledge',
                  },
                },
              ],
              edges: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (url.endsWith('/skills')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'skill-draft:refresh-test',
                approvalState: 'approved',
                workflowEvidenceRefs: ['reviewed:refresh-test'],
                executionSafetyMetadata: { requiresConfirmation: true },
                updatedAt: '2026-04-29T10:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (url.endsWith('/sources/status')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                sourceKind: 'browser',
                sourceInstanceId: 'chrome-main',
                lifecycleStatus: 'enabled',
                recorderStatus: 'unknown',
                importedCount: 1,
                skippedCount: 0,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (url.includes('/sources/audit')) {
        return new Response(
          JSON.stringify({
            items: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (url.includes('/candidate-memories/daily')) {
        return new Response(JSON.stringify({ candidates: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/candidate-reviews/suggestions')) {
        return new Response(JSON.stringify({ suggestions: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.includes('/candidate-memories?')) {
        return new Response(
          JSON.stringify({
            candidates: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
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

  it('keeps a visited review tab mounted when switching to knowledge', async () => {
    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=10`)
    })

    fireEvent.click(screen.getByRole('tab', { name: /review/i }))

    const reviewPanel = await waitFor(() => {
      const panel = document.getElementById('review-panel')
      expect(panel).not.toBeNull()
      expect(panel?.textContent).toContain('Candidates')
      return panel as HTMLElement
    })

    fireEvent.click(screen.getByRole('tab', { name: /knowledge/i }))

    expect(document.getElementById('review-panel')).toBe(reviewPanel)
    expect(reviewPanel.hidden).toBe(true)
    expect(reviewPanel.textContent).toContain('Candidates')
  }, 15_000)

  it('loads persisted knowledge data on refresh', async () => {
    const user = userEvent.setup()

    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=10`)
    })
    expect(
      fetchMock.mock.calls.map((call) => String(call[0]))
    ).not.toContain(`${window.location.origin}/memory`)

    await user.click(screen.getByRole('tab', { name: /knowledge/i }))

    const detailPanel = screen.getByTestId('knowledge-detail-panel')
    expect(within(detailPanel).getByText('Refresh knowledge')).not.toBeNull()
    expect(within(detailPanel).getByText('Reloaded from backend')).not.toBeNull()
    expect(within(detailPanel).getByText('Reloaded knowledge body')).not.toBeNull()
  })

  it('splits artifacts into top-level knowledge and skill tabs', async () => {
    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=10`)
    })

    expect(screen.queryByRole('tab', { name: /artifacts/i })).toBeNull()
    expect(screen.getByRole('tab', { name: /knowledge/i })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /skill/i })).not.toBeNull()
  })

  it('shows Phase 4 sources as a top-level tab', async () => {
    const user = userEvent.setup()
    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=10`)
    })

    await user.click(screen.getByRole('tab', { name: /sources/i }))

    expect(await screen.findAllByText('chrome-main')).toHaveLength(2)
    expect(document.getElementById('sources-panel')).not.toBeNull()
    expect(
      fetchMock.mock.calls.map((call) => String(call[0]))
    ).toContain(`${window.location.origin}/sources/status`)
  })

  it('creates a continuous flex height chain for tab panels', async () => {
    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=10`)
    })

    const mainClassName = screen.getByRole('main').className
    expect(mainClassName).toContain('flex')
    expect(mainClassName).toContain('min-h-0')
    expect(mainClassName).toContain('flex-1')
    expect(mainClassName).toContain('flex-col')

    const memoryPanel = document.getElementById('memory-panel')
    expect(memoryPanel).not.toBeNull()
    const memoryPanelClassName = memoryPanel?.className ?? ''
    expect(memoryPanelClassName).toContain('flex')
    expect(memoryPanelClassName).toContain('min-h-0')
    expect(memoryPanelClassName).toContain('flex-1')
    expect(memoryPanelClassName).toContain('flex-col')

    const scrollRegionClassName = screen.getByTestId('memory-list-scroll-region').className
    expect(scrollRegionClassName).toContain('min-h-0')
    expect(scrollRegionClassName).toContain('flex-1')
    expect(scrollRegionClassName).toContain('overflow-y-auto')

    const paginationFooterClassName = screen.getByTestId('memory-pagination-footer').className
    expect(paginationFooterClassName).toContain('shrink-0')
    expect(paginationFooterClassName).toContain('border-t')
  })

  it('aligns the header brand with the memory tab content and uses readable light-mode text', async () => {
    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=10`)
    })

    const headerContentClassName = screen.getByTestId('app-header-content').className
    expect(headerContentClassName).toContain('mx-auto')
    expect(headerContentClassName).toContain('w-full')
    expect(headerContentClassName).toContain('max-w-7xl')
    expect(headerContentClassName).toContain('px-lg')

    expect(screen.getByRole('heading', { name: 'MirrorBrain' }).className).toContain('text-ink')
    expect(screen.getByText('Personal Memory & Knowledge').className).toContain('text-ink')
  })

  it('lets the user switch between light and dark themes', async () => {
    const user = userEvent.setup()
    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=10`)
    })

    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('mirrorbrain-theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: /switch to light theme/i }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem('mirrorbrain-theme')).toBe('light')
  })
})
