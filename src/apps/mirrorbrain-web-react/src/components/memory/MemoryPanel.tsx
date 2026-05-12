import { useState, useEffect, useMemo } from 'react'
import SyncActions from './SyncActions'
import MemoryList from './MemoryList'
import Pagination from '../common/Pagination'
import LoadingSpinner from '../common/LoadingSpinner'
import Button from '../common/Button'
import { useMirrorBrain } from '../../contexts/MirrorBrainContext'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useSyncOperations } from '../../hooks/useSyncOperations'
import type { MemoryEvent } from '../../types/index'
import { MEMORY_PAGE_SIZE } from './memory-page-config'

export { MEMORY_PAGE_SIZE } from './memory-page-config'

export function shouldLoadMemoryEvents(input: {
  hasLoadedMemoryEvents: boolean
}) {
  return !input.hasLoadedMemoryEvents
}

export function getVisibleMemoryEvents(input: {
  currentPage: number
  pageSize: number
  memoryEvents: MemoryEvent[]
}): MemoryEvent[] {
  const startIndex = (input.currentPage - 1) * input.pageSize

  return [...input.memoryEvents]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(startIndex, startIndex + input.pageSize)
}

interface MemoryPanelProps {
  api?: MirrorBrainWebAppApi
  actionMode?: 'full' | 'import-only'
}

export default function MemoryPanel({
  actionMode = 'full',
  api: providedApi,
}: MemoryPanelProps = {}) {
  const { state, dispatch } = useMirrorBrain()
  const defaultApi: MirrorBrainWebAppApi = useMemo(
    () => createMirrorBrainBrowserApi(window.location.origin),
    []
  )
  const api = providedApi ?? defaultApi

  const { feedback, isSyncingShell, syncShell } = useSyncOperations(api)

  const [isLoading, setIsLoading] = useState(true)
  const [isImportingSources, setIsImportingSources] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [localFeedback, setLocalFeedback] = useState<{
    kind: 'success' | 'error' | 'info'
    message: string
  } | null>(null)
  const totalPages = state.memoryPagination?.totalPages ?? 1
  const visibleFeedback = localFeedback ?? feedback

  // Load initial memory events on mount
  useEffect(() => {
    if (!shouldLoadMemoryEvents({ hasLoadedMemoryEvents: state.hasLoadedMemoryEvents })) {
      setIsLoading(false)
      return
    }

    const loadMemory = async () => {
      try {
        const result = await api.listMemory(1, MEMORY_PAGE_SIZE)
        dispatch({ type: 'LOAD_MEMORY_EVENTS', payload: result })
      } catch (error) {
        console.error('Failed to load memory events:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadMemory()
  }, [api, dispatch, state.hasLoadedMemoryEvents])

  // Handle page change - load new page from server
  const goToPage = async (page: number) => {
    setIsLoading(true)
    try {
      const result = await api.listMemory(page, MEMORY_PAGE_SIZE)
      dispatch({ type: 'LOAD_MEMORY_EVENTS', payload: result })
      setCurrentPage(page)
    } catch (error) {
      console.error('Failed to load page:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportSources = async () => {
    setLocalFeedback(null)
    setIsImportingSources(true)

    try {
      const importResult = await api.importSourceLedgers()

      const memoryResult = await api.listMemory(currentPage, MEMORY_PAGE_SIZE)
      dispatch({ type: 'LOAD_MEMORY_EVENTS', payload: memoryResult })
      setLocalFeedback({
        kind: 'success',
        message: `Source import completed: ${importResult.importedCount} events imported from ${importResult.scannedLedgerCount} ledgers`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Source import failed'
      setLocalFeedback({ kind: 'error', message })
    } finally {
      setIsImportingSources(false)
    }
  }

  const handleSyncShell = async () => {
    setLocalFeedback(null)
    try {
      const summary = await syncShell()
      dispatch({ type: 'SYNC_SHELL', payload: summary })

      // Reload memory events after successful sync
      const result = await api.listMemory(currentPage, MEMORY_PAGE_SIZE)
      dispatch({ type: 'LOAD_MEMORY_EVENTS', payload: result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Shell sync failed'
      if (message.includes('not configured for this MirrorBrain runtime')) {
        setLocalFeedback({
          kind: 'info',
          message,
        })
      }
    }
  }

  const handleSyncUnavailable = (sourceLabel: string) => {
    setLocalFeedback({
      kind: 'info',
      message: `${sourceLabel} history sync is not configured for this MirrorBrain runtime`,
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {actionMode === 'import-only' ? (
        <div data-testid="memory-import-actions" className="mb-3 flex items-stretch gap-2">
          {visibleFeedback ? (
            <div
              className={`flex min-w-0 flex-1 items-center rounded-lg border px-3 py-2 ${
                visibleFeedback.kind === 'success'
                  ? 'border-green-300 bg-green-100 text-green-700'
                  : visibleFeedback.kind === 'error'
                  ? 'border-red-300 bg-red-100 text-red-700'
                  : 'border-blue-300 bg-blue-100 text-blue-700'
              }`}
              role="alert"
            >
              <p className="truncate font-body text-sm font-medium">
                {visibleFeedback.message}
              </p>
            </div>
          ) : (
            <div className="min-w-0 flex-1" aria-hidden="true" />
          )}
          <Button
            variant="primary"
            className="h-full"
            onClick={handleImportSources}
            loading={isImportingSources}
          >
            Import Sources
          </Button>
        </div>
      ) : (
        <>
          {visibleFeedback && (
            <div
              className={`mb-3 rounded-lg border p-3 ${
                visibleFeedback.kind === 'success'
                  ? 'border-green-300 bg-green-100 text-green-700'
                  : visibleFeedback.kind === 'error'
                  ? 'border-red-300 bg-red-100 text-red-700'
                  : 'border-blue-300 bg-blue-100 text-blue-700'
              }`}
              role="alert"
            >
              <p className="font-body text-sm font-medium">{visibleFeedback.message}</p>
            </div>
          )}

          <SyncActions
            onImportSources={handleImportSources}
            onSyncShell={handleSyncShell}
            onSyncFilesystems={() => handleSyncUnavailable('Filesystem')}
            onSyncScreenshot={() => handleSyncUnavailable('Screenshot')}
            isImportingSources={isImportingSources}
            isSyncingShell={isSyncingShell}
          />
        </>
      )}

      {/* Last Sync Summary */}
      {state.lastSyncSummary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
          <p className="text-xs font-body text-blue-700">
            Last sync: {state.lastSyncSummary.sourceKey} ({state.lastSyncSummary.importedCount} events,
            {state.lastSyncSummary.strategy})
          </p>
        </div>
      )}

      {/* Total count indicator */}
      {state.memoryPagination && (
        <div className="text-xs text-gray-600 mb-2">
          Showing {state.memoryEvents.length} of {state.memoryPagination.total} unique URLs (page {currentPage} of {totalPages})
        </div>
      )}

      {/* Memory List */}
      <div
        data-testid="memory-list-scroll-region"
        className="min-h-0 flex-1 overflow-y-auto pr-2"
      >
        <MemoryList events={state.memoryEvents} />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          data-testid="memory-pagination-footer"
          className="shrink-0 border-t border-hairline bg-canvas-parchment pt-3"
        >
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
        </div>
      )}
    </div>
  )
}
