import { useState } from 'react'
import type { MirrorBrainWebAppApi } from '../api/client'

type FeedbackKind = 'success' | 'error' | 'info'

interface Feedback {
  kind: FeedbackKind
  message: string
}

export function useSyncOperations(api: MirrorBrainWebAppApi) {
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isSyncingBrowser, setIsSyncingBrowser] = useState(false)
  const [isSyncingShell, setIsSyncingShell] = useState(false)

  const syncBrowser = async () => {
    setIsSyncingBrowser(true)
    setFeedback(null)

    try {
      const summary = await api.syncBrowser()

      setFeedback({
        kind: 'success',
        message: `Browser sync completed: ${summary.importedCount} events imported`,
      })

      return summary
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Browser sync failed'
      setFeedback({ kind: 'error', message })
      throw error
    } finally {
      setIsSyncingBrowser(false)
    }
  }

  const syncShell = async () => {
    setIsSyncingShell(true)
    setFeedback(null)

    try {
      const summary = await api.syncShell()

      setFeedback({
        kind: 'success',
        message: `Shell sync completed: ${summary.importedCount} events imported`,
      })

      return summary
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Shell sync failed'
      setFeedback({ kind: 'error', message })
      throw error
    } finally {
      setIsSyncingShell(false)
    }
  }

  const dismissFeedback = () => {
    setFeedback(null)
  }

  return {
    feedback,
    isSyncingBrowser,
    isSyncingShell,
    syncBrowser,
    syncShell,
    dismissFeedback,
  }
}