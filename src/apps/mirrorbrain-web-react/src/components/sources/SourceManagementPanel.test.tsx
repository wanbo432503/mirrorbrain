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

  it('shows the all-main sources memory layout with import-only actions', async () => {
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

    expect(await screen.findByRole('button', { name: /all-main sources/i })).not.toBeNull()
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

  it('keeps all-main memory events in a flex right panel with scrollable list and reachable pagination', async () => {
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
        sourceKind: 'agent-transcript' as const,
        sourceInstanceId: 'openclaw-main',
      },
      {
        sourceKind: 'browser' as const,
        sourceInstanceId: 'chrome-main',
      },
      {
        sourceKind: 'file-activity' as const,
        sourceInstanceId: 'filesystem-main',
      },
      {
        sourceKind: 'screenshot' as const,
        sourceInstanceId: 'desktop-main',
      },
      {
        sourceKind: 'shell' as const,
        sourceInstanceId: 'shell-main',
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
        sourceInstanceId?: string
      }) => ({
        items: Array.from({ length: 10 }, (_, index) => ({
          id: `ledger:${filter?.sourceInstanceId ?? 'unknown'}:${index + 1}`,
          sourceType: 'browser',
          sourceRef: `${filter?.sourceInstanceId ?? 'unknown'}:record-${index + 1}`,
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
          name: new RegExp(`${source.sourceInstanceId} ${source.sourceKind}`, 'i'),
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

      await userEvent.click(screen.getByRole('tab', { name: 'Sources' }))
      expect(await screen.findByText(`History for ${source.sourceInstanceId} 1`)).not.toBeNull()

      const sourceHistoryPanel = screen.getByTestId('source-history-panel')
      const sourceHistoryScrollRegion = screen.getByTestId('source-history-scroll-region')
      const sourceHistoryPaginationFooter = screen.getByTestId(
        'source-history-pagination-footer',
      )

      expect(sourceHistoryPanel.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden']),
      )
      expect(sourceHistoryScrollRegion.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto']),
      )
      expect(sourceHistoryPaginationFooter.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['shrink-0', 'border-t']),
      )
    }
  })

  it('shows source overview, paginated source history, and settings without audit or manual import', async () => {
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

    await userEvent.click(await screen.findByRole('button', { name: /chrome-main browser/i }))

    expect(screen.getAllByText('chrome-main')).toHaveLength(2)
    expect(screen.getByText('degraded')).not.toBeNull()
    expect(screen.getByText('Imported')).not.toBeNull()
    expect(screen.getByText('2')).not.toBeNull()
    expect(screen.getByText('Skipped')).not.toBeNull()
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)

    expect(screen.queryByRole('tab', { name: 'Recent Memory' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Audit' })).toBeNull()

    await userEvent.click(screen.getByRole('tab', { name: 'Sources' }))
    await screen.findByText('Browser source history page 1')
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
