import { useState, useEffect, useMemo } from 'react'
import SyncActions from './SyncActions'
import MemoryList from './MemoryList'
import Pagination from '../common/Pagination'
import LoadingSpinner from '../common/LoadingSpinner'
import { useMirrorBrain } from '../../contexts/MirrorBrainContext'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useSyncOperations } from '../../hooks/useSyncOperations'
import { usePagination } from '../../hooks/usePagination'
import type { MemoryEvent } from '../../types/index'

const MEMORY_PAGE_SIZE = 5

export function shouldLoadMemoryEvents(input: {
  hasLoadedMemoryEvents: boolean
}) {
  return !input.hasLoadedMemoryEvents
}

export function getVisibleMemoryEvents(input: {
  memoryEvents: MemoryEvent[]
  currentPage: number
  pageSize: number
}) {
  const sortedEvents = [...input.memoryEvents].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp)
  )
  const startIndex = (input.currentPage - 1) * input.pageSize
  const endIndex = startIndex + input.pageSize

  return sortedEvents.slice(startIndex, endIndex)
}

export default function MemoryPanel() {
  const { state, dispatch } = useMirrorBrain()
  const api: MirrorBrainWebAppApi = useMemo(
    () => createMirrorBrainBrowserApi(window.location.origin),
    []
  )

  const { feedback, isSyncingBrowser, isSyncingShell, syncBrowser, syncShell } =
    useSyncOperations(api)

  const totalPages = Math.max(1, Math.ceil(state.memoryEvents.length / MEMORY_PAGE_SIZE))
  const { currentPage, goToPage } = usePagination(totalPages)

  const [isLoading, setIsLoading] = useState(true)

  // Load initial memory events on mount
  useEffect(() => {
    if (!shouldLoadMemoryEvents({ hasLoadedMemoryEvents: state.hasLoadedMemoryEvents })) {
      setIsLoading(false)
      return
    }

    const loadMemory = async () => {
      try {
        const events = await api.listMemory()
        dispatch({ type: 'LOAD_MEMORY_EVENTS', payload: events })
      } catch (error) {
        console.error('Failed to load memory events:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadMemory()
  }, [api, dispatch, state.hasLoadedMemoryEvents])

  // Update sync operations to also dispatch to global state
  const handleSyncBrowser = async () => {
    try {
      const summary = await syncBrowser()
      dispatch({ type: 'SYNC_BROWSER', payload: summary })
    } catch (error) {
      // Error already handled by useSyncOperations
    }
  }

  const handleSyncShell = async () => {
    try {
      const summary = await syncShell()
      dispatch({ type: 'SYNC_SHELL', payload: summary })
    } catch (error) {
      // Error already handled by useSyncOperations
    }
  }

  // Get current page events
  const currentEvents = getVisibleMemoryEvents({
    memoryEvents: state.memoryEvents,
    currentPage,
    pageSize: MEMORY_PAGE_SIZE,
  })

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

      {/* Memory List */}
      <MemoryList events={currentEvents} />

      {/* Pagination */}
      {state.memoryEvents.length > MEMORY_PAGE_SIZE && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
      )}
    </div>
  )
}
