// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MirrorBrainWebAppApi } from '../../api/client'
import WorkSessionAnalysisPanel from './WorkSessionAnalysisPanel'

afterEach(() => {
  cleanup()
})

describe('WorkSessionAnalysisPanel', () => {
  it('runs a manual analysis window and renders pending work-session candidates', async () => {
    const api = {
      analyzeWorkSessions: vi.fn(async () => ({
        analysisWindow: {
          preset: 'last-6-hours' as const,
          startAt: '2026-05-12T06:00:00.000Z',
          endAt: '2026-05-12T12:00:00.000Z',
        },
        generatedAt: '2026-05-12T12:00:00.000Z',
        candidates: [
          {
            id: 'work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
            projectHint: 'mirrorbrain',
            title: 'mirrorbrain work session',
            summary: 'Imported source ledgers and ran source tests.',
            memoryEventIds: ['browser-1', 'shell-1'],
            sourceTypes: ['browser', 'shell'],
            timeRange: {
              startAt: '2026-05-12T10:00:00.000Z',
              endAt: '2026-05-12T10:30:00.000Z',
            },
            relationHints: ['Phase 4 design', 'Run tests'],
            reviewState: 'pending' as const,
          },
        ],
        excludedMemoryEventIds: ['old-1'],
      })),
    } as unknown as MirrorBrainWebAppApi

    render(<WorkSessionAnalysisPanel api={api} />)

    await userEvent.click(screen.getByRole('button', { name: 'Last 6h' }))

    await waitFor(() => {
      expect(api.analyzeWorkSessions).toHaveBeenCalledWith('last-6-hours')
    })
    expect(await screen.findByText('mirrorbrain work session')).not.toBeNull()
    expect(screen.getByText('mirrorbrain')).not.toBeNull()
    expect(screen.getByText('browser, shell')).not.toBeNull()
    expect(screen.getByText('2 memory events')).not.toBeNull()
    expect(screen.getByText('1 excluded')).not.toBeNull()
  })
})
