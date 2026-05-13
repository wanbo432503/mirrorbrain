// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MirrorBrainWebAppApi } from '../../api/client'
import { MirrorBrainProvider } from '../../contexts/MirrorBrainContext'
import SourceManagementPanel from './SourceManagementPanel'

afterEach(() => {
  cleanup()
})

describe('SourceManagementPanel', () => {
  function renderSourceManagementPanel(api: MirrorBrainWebAppApi) {
    render(
      <MirrorBrainProvider>
        <SourceManagementPanel api={api} />
      </MirrorBrainProvider>
    )
  }

  it('shows the all sources memory layout with import-only actions', async () => {
    const api = {
      listSourceStatuses: vi.fn(async () => [
        {
          sourceKind: 'browser' as const,
          sourceInstanceId: 'chrome-main',
          lifecycleStatus: 'enabled' as const,
          recorderStatus: 'unknown' as const,
          importedCount: 2,
          skippedCount: 0,
        },
      ]),
      listSourceAuditEvents: vi.fn(async () => []),
      importSourceLedgers: vi.fn(async () => ({
        importedCount: 1,
        skippedCount: 0,
        scannedLedgerCount: 1,
        changedLedgerCount: 1,
        ledgerResults: [],
      })),
      updateSourceConfig: vi.fn(),
      listMemory: vi.fn(async () => ({
        items: [
          {
            id: 'ledger:browser:global',
            sourceType: 'browser',
            sourceRef: 'browser:chrome-main:global',
            timestamp: '2026-05-12T10:00:00.000Z',
            authorizationScopeId: 'scope-source-ledger',
            content: {
              title: 'Global browser memory',
              summary: 'Visible from all main sources.',
              contentKind: 'browser-page',
            },
            captureMetadata: {
              upstreamSource: 'source-ledger:browser',
              checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
            },
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
    } as unknown as MirrorBrainWebAppApi

    renderSourceManagementPanel(api)

    expect(await screen.findByRole('button', { name: /all sources/i })).not.toBeNull()
    expect(screen.queryByRole('tab', { name: 'Memory Events' })).toBeNull()
    expect(await screen.findByRole('button', { name: 'Import Sources' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Sync Shell' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sync Filesystems' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sync Screenshot' })).toBeNull()
    expect(await screen.findByText('Global browser memory')).not.toBeNull()
    expect(api.listMemory).toHaveBeenCalledWith(1, 10)
    expect(api.listSourceAuditEvents).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Import Sources' }))

    await waitFor(() => {
      expect(api.importSourceLedgers).toHaveBeenCalledTimes(1)
    })
    expect(
      await screen.findByText('Source import completed: 1 events imported from 1 ledgers')
    ).not.toBeNull()
    const importActions = screen.getByTestId('memory-import-actions')
    expect(importActions.className).toContain('items-stretch')
    expect(within(importActions).getByRole('alert').className).toContain('flex-1')
    expect(within(importActions).getByRole('button', { name: 'Import Sources' })).not.toBeNull()
    expect(api.listMemory).toHaveBeenCalledWith(1, 10)
  })

  it('keeps all sources memory events in a flex right panel with scrollable list and reachable pagination', async () => {
    const memoryItems = Array.from({ length: 10 }, (_, index) => ({
      id: `ledger:browser:global-${index + 1}`,
      sourceType: 'browser' as const,
      sourceRef: `browser:chrome-main:global-${index + 1}`,
      timestamp: `2026-05-12T10:${String(index).padStart(2, '0')}:00.000Z`,
      authorizationScopeId: 'scope-source-ledger',
      content: {
        title: `Global browser memory ${index + 1}`,
        summary: 'Visible from all main sources.',
        contentKind: 'browser-page',
      },
      captureMetadata: {
        upstreamSource: 'source-ledger:browser',
        checkpoint: `ledgers/2026-05-12/browser.jsonl:${index + 1}`,
      },
    }))
    const api = {
      listSourceStatuses: vi.fn(async () => []),
      listSourceAuditEvents: vi.fn(async () => []),
      importSourceLedgers: vi.fn(),
      updateSourceConfig: vi.fn(),
      listMemory: vi.fn(async () => ({
        items: memoryItems,
        pagination: {
          total: 24,
          page: 1,
          pageSize: 10,
          totalPages: 3,
        },
      })),
    } as unknown as MirrorBrainWebAppApi

    renderSourceManagementPanel(api)

    expect(await screen.findByText('Global browser memory 1')).not.toBeNull()
    const detailPanel = screen.getByTestId('memory-sources-detail-panel')
    const allMainPanel = screen.getByTestId('all-main-memory-panel')
    const scrollRegion = screen.getByTestId('memory-list-scroll-region')
    const paginationFooter = screen.getByTestId('memory-pagination-footer')

    expect(detailPanel.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden']),
    )
    expect(allMainPanel.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden']),
    )
    expect(scrollRegion.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto']),
    )
    expect(paginationFooter.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['shrink-0', 'border-t']),
    )
    expect(screen.getByRole('button', { name: 'First page' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Last page' })).not.toBeNull()
  })

  it('keeps each selected source detail panel inside the flex viewport', async () => {
    const sourceSummaries = [
      {
        sourceKind: 'agent' as const,
        sourceInstanceId: 'agent-main',
        displayName: 'Agent',
        displayDescription: 'Sessions',
      },
      {
        sourceKind: 'browser' as const,
        sourceInstanceId: 'chrome-main',
        displayName: 'Chrome',
        displayDescription: 'browser',
      },
      {
        sourceKind: 'file-activity' as const,
        sourceInstanceId: 'filesystem-main',
        displayName: 'Files',
        displayDescription: 'file activity',
      },
      {
        sourceKind: 'screenshot' as const,
        sourceInstanceId: 'desktop-main',
        displayName: 'Screenshot',
        displayDescription: 'screen capture',
      },
      {
        sourceKind: 'shell' as const,
        sourceInstanceId: 'shell-main',
        displayName: 'Shell',
        displayDescription: 'terminal',
      },
      {
        sourceKind: 'audio-recording' as const,
        sourceInstanceId: 'recording-main',
        displayName: 'Recording',
        displayDescription: 'audio recording',
      },
    ].map((source) => ({
      ...source,
      lifecycleStatus: 'enabled' as const,
      recorderStatus: 'unknown' as const,
      importedCount: 18,
      skippedCount: 0,
      checkpointSummary: `${source.sourceInstanceId}.jsonl next line 19`,
    }))
    const api = {
      listSourceStatuses: vi.fn(async () => sourceSummaries),
      listSourceAuditEvents: vi.fn(async () => []),
      importSourceLedgers: vi.fn(),
      updateSourceConfig: vi.fn(),
      listMemory: vi.fn(async (_page?: number, _pageSize?: number, filter?: {
        sourceKind?: string
        sourceInstanceId?: string
      }) => ({
        items: Array.from({ length: 10 }, (_, index) => ({
          id: `ledger:${filter?.sourceInstanceId ?? 'unknown'}:${index + 1}`,
          sourceType: filter?.sourceKind ?? 'browser',
          sourceRef: `${filter?.sourceKind ?? 'unknown'}:${filter?.sourceInstanceId ?? 'unknown'}:record-${index + 1}`,
          timestamp: `2026-05-12T10:${String(index).padStart(2, '0')}:00.000Z`,
          authorizationScopeId: 'scope-source-ledger',
          content: {
            title: `History for ${filter?.sourceInstanceId ?? 'unknown'} ${index + 1}`,
            summary: 'A source-specific record kept inside the detail viewport.',
            contentKind: 'source-record',
          },
          captureMetadata: {
            upstreamSource: 'source-ledger:test',
            checkpoint: `${filter?.sourceInstanceId ?? 'unknown'}.jsonl:${index + 1}`,
          },
        })),
        pagination: {
          total: 18,
          page: 1,
          pageSize: 10,
          totalPages: 2,
        },
      })),
    } as unknown as MirrorBrainWebAppApi

    renderSourceManagementPanel(api)

    for (const source of sourceSummaries) {
      await userEvent.click(
        await screen.findByRole('button', {
          name: new RegExp(`${source.displayName} ${source.displayDescription}`, 'i'),
        }),
      )

      const sourceDetailLayout = screen.getByTestId('source-detail-layout')
      const sourceDetailHeader = screen.getByTestId('source-detail-header')
      const sourceDetailTabs = screen.getByTestId('source-detail-tabs')
      const sourceDetailBody = screen.getByTestId('source-detail-body')

      expect(sourceDetailLayout.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden']),
      )
      expect(sourceDetailHeader.className.split(/\s+/)).toContain('shrink-0')
      expect(sourceDetailTabs.className.split(/\s+/)).toContain('shrink-0')
      expect(sourceDetailBody.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden']),
      )
      expect(screen.queryByRole('tab', { name: 'Overview' })).toBeNull()
      expect(screen.getByRole('tab', { name: 'Sources' }).getAttribute('aria-selected')).toBe(
        'true',
      )
      expect(screen.getByRole('tab', { name: 'Settings' })).not.toBeNull()
      expect(screen.getByRole('heading', { name: source.displayName })).not.toBeNull()

      expect(await screen.findByText(`History for ${source.sourceInstanceId} 1`)).not.toBeNull()

      const sourceHistoryPanel = screen.getByTestId('source-history-panel')
      const sourceSummaryPanel = screen.getByTestId('source-summary-panel')
      const sourceHistoryScrollRegion = screen.getByTestId('source-history-scroll-region')
      const sourceHistoryPaginationFooter = screen.getByTestId(
        'source-history-pagination-footer',
      )

      expect(sourceHistoryPanel.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden']),
      )
      expect(within(sourceSummaryPanel).getByText('Imported')).not.toBeNull()
      expect(within(sourceSummaryPanel).getByText('18')).not.toBeNull()
      expect(
        sourceHistoryPanel.compareDocumentPosition(sourceSummaryPanel) &
          Node.DOCUMENT_POSITION_CONTAINED_BY,
      ).toBeTruthy()
      expect(
        sourceSummaryPanel.compareDocumentPosition(sourceHistoryScrollRegion) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(sourceHistoryScrollRegion.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto']),
      )
      expect(sourceHistoryPaginationFooter.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['shrink-0', 'border-t']),
      )
    }
  })

  it('shows source summary above paginated source history and settings without extra source tabs', async () => {
    const pageOneMemory = {
      items: [
        {
          id: 'ledger:browser:source-page-1',
          sourceType: 'browser',
          sourceRef: 'browser:chrome-main:source-page-1',
          timestamp: '2026-05-12T10:00:00.000Z',
          authorizationScopeId: 'scope-source-ledger',
          content: {
            title: 'Browser source history page 1',
            summary: 'Imported browser page from this source.',
            contentKind: 'browser-page',
          },
          captureMetadata: {
            upstreamSource: 'source-ledger:browser',
            checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
          },
        },
      ],
      pagination: {
        total: 11,
        page: 1,
        pageSize: 10,
        totalPages: 2,
      },
    }
    const pageTwoMemory = {
      items: [
        {
          id: 'ledger:browser:source-page-2',
          sourceType: 'browser',
          sourceRef: 'browser:chrome-main:source-page-2',
          timestamp: '2026-05-12T09:00:00.000Z',
          authorizationScopeId: 'scope-source-ledger',
          content: {
            title: 'Browser source history page 2',
            summary: 'Older browser page from this source.',
            contentKind: 'browser-page',
          },
          captureMetadata: {
            upstreamSource: 'source-ledger:browser',
            checkpoint: 'ledgers/2026-05-12/browser.jsonl:11',
          },
        },
      ],
      pagination: {
        total: 11,
        page: 2,
        pageSize: 10,
        totalPages: 2,
      },
    }
    const api = {
      listSourceStatuses: vi.fn(async () => [
        {
          sourceKind: 'browser' as const,
          sourceInstanceId: 'chrome-main',
          lifecycleStatus: 'degraded' as const,
          recorderStatus: 'unknown' as const,
          lastImporterScanAt: '2026-05-12T10:30:00.000Z',
          lastImportedAt: '2026-05-12T10:00:00.000Z',
          importedCount: 2,
          skippedCount: 1,
          latestWarning: 'Skipped invalid source ledger line.',
          checkpointSummary: 'ledgers/2026-05-12/browser.jsonl next line 4',
        },
      ]),
      listSourceAuditEvents: vi.fn(async () => []),
      importSourceLedgers: vi.fn(async () => ({
        importedCount: 1,
        skippedCount: 0,
        scannedLedgerCount: 1,
        changedLedgerCount: 1,
        ledgerResults: [],
      })),
      updateSourceConfig: vi.fn(async () => ({
        sourceKind: 'browser' as const,
        sourceInstanceId: 'chrome-main',
        enabled: false,
        updatedAt: '2026-05-12T11:00:00.000Z',
        updatedBy: 'mirrorbrain-web',
      })),
      listMemory: vi.fn(async (page?: number) =>
        page === 2 ? pageTwoMemory : pageOneMemory,
      ),
    } as unknown as MirrorBrainWebAppApi

    renderSourceManagementPanel(api)

    await userEvent.click(await screen.findByRole('button', { name: /chrome browser/i }))

    expect(screen.getAllByText('Chrome')).toHaveLength(2)
    expect(screen.getByText('degraded')).not.toBeNull()

    expect(screen.queryByRole('tab', { name: 'Overview' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Recent Memory' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Audit' })).toBeNull()

    await screen.findByText('Browser source history page 1')
    const sourceHistoryPanel = screen.getByTestId('source-history-panel')
    const sourceSummaryPanel = within(sourceHistoryPanel).getByTestId('source-summary-panel')
    const sourceHistoryScrollRegion = within(sourceHistoryPanel).getByTestId(
      'source-history-scroll-region',
    )
    expect(within(sourceSummaryPanel).getByText('Imported')).not.toBeNull()
    expect(within(sourceSummaryPanel).getByText('2')).not.toBeNull()
    expect(within(sourceSummaryPanel).getByText('Skipped')).not.toBeNull()
    expect(within(sourceSummaryPanel).getByText('1')).not.toBeNull()
    expect(within(sourceSummaryPanel).getByText('Recorder')).not.toBeNull()
    expect(within(sourceSummaryPanel).getByText('unknown')).not.toBeNull()
    expect(within(sourceSummaryPanel).getByText('Checkpoint')).not.toBeNull()
    expect(
      within(sourceSummaryPanel).getByText('ledgers/2026-05-12/browser.jsonl next line 4'),
    ).not.toBeNull()
    expect(
      sourceSummaryPanel.compareDocumentPosition(sourceHistoryScrollRegion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText('Imported browser page from this source.')).not.toBeNull()
    expect(screen.getByText('Showing 1 of 11 source records (page 1 of 2)')).not.toBeNull()
    expect(api.listMemory).toHaveBeenCalledWith(1, 10, {
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
    })

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('Browser source history page 2')
    expect(screen.getByText('Older browser page from this source.')).not.toBeNull()
    expect(api.listMemory).toHaveBeenCalledWith(2, 10, {
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.queryByRole('button', { name: 'Import Now' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Disable Source' }))

    await waitFor(() => {
      expect(api.updateSourceConfig).toHaveBeenCalledWith({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: false,
        updatedBy: 'mirrorbrain-web',
      })
    })
    expect(await screen.findByText('Source disabled.')).not.toBeNull()

    expect(api.importSourceLedgers).not.toHaveBeenCalled()
    expect(api.listSourceStatuses).toHaveBeenCalledTimes(2)
    expect(api.listSourceAuditEvents).not.toHaveBeenCalled()
  })
})
