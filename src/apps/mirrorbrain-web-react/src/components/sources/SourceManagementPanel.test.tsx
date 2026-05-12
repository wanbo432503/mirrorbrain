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

  it('shows source overview, audit, settings tabs, and manual import now', async () => {
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
      listSourceAuditEvents: vi.fn(async () => [
        {
          id: 'source-audit:warning-1',
          eventType: 'schema-validation-failed',
          sourceKind: 'browser' as const,
          sourceInstanceId: 'chrome-main',
          ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
          lineNumber: 2,
          occurredAt: '2026-05-12T10:31:00.000Z',
          severity: 'warning' as const,
          message: 'Skipped invalid source ledger line.',
        },
      ]),
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
      listMemory: vi.fn(async () => ({
        items: [
          {
            id: 'ledger:browser:recent',
            sourceType: 'browser',
            sourceRef: 'browser:chrome-main:recent',
            timestamp: '2026-05-12T10:00:00.000Z',
            authorizationScopeId: 'scope-source-ledger',
            content: {
              title: 'Recent browser memory',
              summary: 'Imported browser page.',
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
          pageSize: 5,
          totalPages: 1,
        },
      })),
    } as unknown as MirrorBrainWebAppApi

    renderSourceManagementPanel(api)

    await userEvent.click(await screen.findByRole('button', { name: /chrome-main browser/i }))

    expect(screen.getAllByText('chrome-main')).toHaveLength(2)
    expect(screen.getByText('degraded')).not.toBeNull()
    expect(screen.getByText('Imported')).not.toBeNull()
    expect(screen.getByText('2')).not.toBeNull()
    expect(screen.getByText('Skipped')).not.toBeNull()
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('tab', { name: 'Recent Memory' }))
    await screen.findByText('Recent browser memory')
    expect(screen.getByText('Imported browser page.')).not.toBeNull()
    expect(api.listMemory).toHaveBeenCalledWith(1, 5, {
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }))
    await screen.findByText('schema-validation-failed')
    expect(screen.getByText('Skipped invalid source ledger line.')).not.toBeNull()

    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }))
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

    await userEvent.click(screen.getByRole('button', { name: 'Import Now' }))

    await waitFor(() => {
      expect(api.importSourceLedgers).toHaveBeenCalledTimes(1)
    })
    expect(
      await screen.findByText('Imported 1 source ledger event across 1 scanned ledger.')
    ).not.toBeNull()
    expect(api.listSourceStatuses).toHaveBeenCalledTimes(3)
    expect(api.listSourceAuditEvents).toHaveBeenCalledWith({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
    })
  })
})
