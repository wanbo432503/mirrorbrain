// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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

      if (url.includes('/memory?page=1&pageSize=5')) {
        return new Response(
          JSON.stringify({
            items: [],
            pagination: {
              total: 0,
              page: 1,
              pageSize: 5,
              totalPages: 0,
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

  it('keeps a visited review tab mounted when switching to artifacts', async () => {
    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=5`)
    })

    fireEvent.click(screen.getByRole('tab', { name: /review/i }))

    const reviewPanel = await waitFor(() => {
      const panel = document.getElementById('review-panel')
      expect(panel).not.toBeNull()
      expect(panel?.textContent).toContain('Candidates')
      return panel as HTMLElement
    })

    fireEvent.click(screen.getByRole('tab', { name: /artifacts/i }))

    expect(document.getElementById('review-panel')).toBe(reviewPanel)
    expect(reviewPanel.hidden).toBe(true)
    expect(reviewPanel.textContent).toContain('Candidates')
  }, 15_000)

  it('loads persisted knowledge and skill data on refresh', async () => {
    const user = userEvent.setup()

    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=5`)
    })
    expect(
      fetchMock.mock.calls.map((call) => String(call[0]))
    ).not.toContain(`${window.location.origin}/memory`)

    await user.click(screen.getByRole('tab', { name: /artifacts/i }))

    const detailPanel = screen.getByTestId('artifact-detail-panel')
    expect(within(detailPanel).getByText('Refresh knowledge')).not.toBeNull()
    expect(within(detailPanel).getByText('Reloaded from backend')).not.toBeNull()
    expect(within(detailPanel).getByText('Reloaded knowledge body')).not.toBeNull()
  })

  it('creates a continuous flex height chain for tab panels', async () => {
    const fetchMock = stubInitialAppFetch()

    render(<App />)

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.map((call) => String(call[0]))
      ).toContain(`${window.location.origin}/memory?page=1&pageSize=5`)
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
  })
})
