import { useMirrorBrain } from '../contexts/MirrorBrainContext'
import type { MirrorBrainWebAppApi } from '../api/client'
import { MEMORY_PAGE_SIZE } from '../components/memory/memory-page-config'

export function useMemoryEvents(api: MirrorBrainWebAppApi) {
  const { state, dispatch } = useMirrorBrain()

  const syncBrowser = async (): Promise<{ kind: 'success' | 'error'; message: string }> => {
    try {
      const summary = await api.syncBrowser()
      dispatch({ type: 'SYNC_BROWSER', payload: summary })

      return {
        kind: 'success',
        message: `Browser sync completed: ${summary.importedCount} events imported`,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Browser sync failed'
      return { kind: 'error', message }
    }
  }

  const syncShell = async (): Promise<{ kind: 'success' | 'error'; message: string }> => {
    try {
      const summary = await api.syncShell()
      dispatch({ type: 'SYNC_SHELL', payload: summary })

      return {
        kind: 'success',
        message: `Shell sync completed: ${summary.importedCount} events imported`,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Shell sync failed'
      return { kind: 'error', message }
    }
  }

  const getMemoryPageCount = () => {
    return Math.max(1, Math.ceil(state.memoryEvents.length / MEMORY_PAGE_SIZE))
  }

  const getMemoryPage = (page: number) => {
    const totalPages = getMemoryPageCount()
    const clampedPage = Math.max(1, Math.min(page, totalPages))
    const startIndex = (clampedPage - 1) * MEMORY_PAGE_SIZE
    const endIndex = startIndex + MEMORY_PAGE_SIZE

    return state.memoryEvents.slice(startIndex, endIndex)
  }

  return {
    memoryEvents: state.memoryEvents,
    lastSyncSummary: state.lastSyncSummary,
    syncBrowser,
    syncShell,
    getMemoryPageCount,
    getMemoryPage,
  }
}
