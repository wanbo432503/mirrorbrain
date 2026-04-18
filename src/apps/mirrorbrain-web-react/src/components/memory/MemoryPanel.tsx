import { useState, useEffect, useMemo } from 'react'
import SyncActions from './SyncActions'
import MemoryList from './MemoryList'
import Pagination from '../common/Pagination'
import LoadingSpinner from '../common/LoadingSpinner'
import { useMirrorBrain } from '../../contexts/MirrorBrainContext'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useSyncOperations } from '../../hooks/useSyncOperations'

const MEMORY_PAGE_SIZE = 5

export function shouldLoadMemoryEvents(input: {
  hasLoadedMemoryEvents: boolean
}) {
  return !input.hasLoadedMemoryEvents
}

export default function MemoryPanel() {
  const { state, dispatch } = useMirrorBrain()
  const api: MirrorBrainWebAppApi = useMemo(
    () => createMirrorBrainBrowserApi(window.location.origin),
    []
  )

  const { feedback, isSyncingBrowser, isSyncingShell, syncBrowser, syncShell } =
    useSyncOperations(api)

  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = state.memoryPagination?.totalPages ?? 1

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

  // Update sync operations to also dispatch to global state
  const handleSyncBrowser = async () => {
    try {
      const summary = await syncBrowser()
      dispatch({ type: 'SYNC_BROWSER', payload: summary })

      // Reload memory events after successful sync
      const result = await api.listMemory(currentPage, MEMORY_PAGE_SIZE)
      dispatch({ type: 'LOAD_MEMORY_EVENTS', payload: result })
    } catch (error) {
      // Error already handled by useSyncOperations
    }
  }

  const handleSyncShell = async () => {
    try {
      const summary = await syncShell()
      dispatch({ type: 'SYNC_SHELL', payload: summary })

      // Reload memory events after successful sync
      const result = await api.listMemory(currentPage, MEMORY_PAGE_SIZE)
      dispatch({ type: 'LOAD_MEMORY_EVENTS', payload: result })
    } catch (error) {
      // Error already handled by useSyncOperations
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div>
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-3 p-3 rounded-lg border ${
            feedback.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-700'
              : 'bg-red-100 border-red-300 text-red-700'
          }`}
          role="alert"
        >
          <p className="font-body font-medium text-sm">{feedback.message}</p>
        </div>
      )}

      {/* Sync Actions */}
      <SyncActions
        onSyncBrowser={handleSyncBrowser}
        onSyncShell={handleSyncShell}
        isSyncingBrowser={isSyncingBrowser}
        isSyncingShell={isSyncingShell}
      />

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
      <MemoryList events={state.memoryEvents} />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
      )}
    </div>
  )
}