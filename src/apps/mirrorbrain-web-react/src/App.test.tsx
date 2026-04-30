// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('loads persisted knowledge and skill data on refresh', async () => {
    const user = userEvent.setup()

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
    }) as unknown as typeof fetch

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await user.click(screen.getByRole('tab', { name: /artifacts/i }))

    const detailPanel = screen.getByTestId('artifact-detail-panel')
    expect(within(detailPanel).getByText('Refresh knowledge')).not.toBeNull()
    expect(within(detailPanel).getByText('Reloaded knowledge body')).not.toBeNull()
  })
})
