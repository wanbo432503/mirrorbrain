import { useMemo, useState } from 'react'
import AppShell from './components/layout/AppShell'
import TabNavigation from './components/layout/TabNavigation'
import FeedbackBanner from './components/layout/FeedbackBanner'
import MemoryPanel from './components/memory/MemoryPanel'
import ReviewPanel from './components/review/ReviewPanel'
import ArtifactsPanel from './components/artifacts/ArtifactsPanel'
import { createMirrorBrainBrowserApi } from './api/client'
import { MirrorBrainProvider } from './contexts/MirrorBrainContext'
import { useMirrorBrainState } from './hooks/useMirrorBrainState'

type TabType = 'memory' | 'review' | 'artifacts'
type FeedbackKind = 'success' | 'error' | 'info'

interface Feedback {
  kind: FeedbackKind
  message: string
}

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('memory')
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  return (
    <MirrorBrainProvider>
      <AppContent
        activeTab={activeTab}
        feedback={feedback}
        onTabChange={setActiveTab}
        onDismissFeedback={() => setFeedback(null)}
      />
    </MirrorBrainProvider>
  )
}

function AppContent({
  activeTab,
  feedback,
  onTabChange,
  onDismissFeedback,
}: {
  activeTab: TabType
  feedback: Feedback | null
  onTabChange: (tab: TabType) => void
  onDismissFeedback: () => void
}) {
  const api = useMemo(
    () => createMirrorBrainBrowserApi(window.location.origin),
    []
  )

  useMirrorBrainState(api)

  return (
    <AppShell>
      {feedback && <FeedbackBanner feedback={feedback} onDismiss={onDismissFeedback} />}

      <TabNavigation activeTab={activeTab} onTabChange={onTabChange} />

      <div role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`}>
        {activeTab === 'memory' && <MemoryPanel />}
        {activeTab === 'review' && <ReviewPanel />}
        {activeTab === 'artifacts' && <ArtifactsPanel />}
      </div>
    </AppShell>
  )
}

export default App
