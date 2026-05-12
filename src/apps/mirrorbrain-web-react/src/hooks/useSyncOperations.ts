import { useState } from 'react'
import type { MirrorBrainWebAppApi } from '../api/client'

type FeedbackKind = 'success' | 'error' | 'info'

interface Feedback {
  kind: FeedbackKind
  message: string
}

export function useSyncOperations(api: MirrorBrainWebAppApi) {
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isSyncingShell, setIsSyncingShell] = useState(false)

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
    isSyncingShell,
    syncShell,
    dismissFeedback,
  }
}
