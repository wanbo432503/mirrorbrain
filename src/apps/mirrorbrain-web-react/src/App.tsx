import { useEffect, useMemo, useState } from 'react'
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
type VisitedTabs = Record<TabType, boolean>

const TABS: TabType[] = ['memory', 'review', 'artifacts']

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
  const [visitedTabs, setVisitedTabs] = useState<VisitedTabs>({
    memory: true,
    review: false,
    artifacts: false,
  })

  useMirrorBrainState(api)

  useEffect(() => {
    setVisitedTabs((previous) => {
      if (previous[activeTab]) {
        return previous
      }

      return {
        ...previous,
        [activeTab]: true,
      }
    })
  }, [activeTab])

  return (
    <AppShell>
      {feedback && <FeedbackBanner feedback={feedback} onDismiss={onDismissFeedback} />}

      <TabNavigation activeTab={activeTab} onTabChange={onTabChange} />

      {TABS.map((tab) => {
        const isActive = activeTab === tab
        const shouldRenderPanel = visitedTabs[tab] || isActive

        return (
          <div
            key={tab}
            role="tabpanel"
            id={`${tab}-panel`}
            aria-labelledby={`${tab}-tab`}
            className={`${isActive ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col overflow-y-auto pt-md lg:overflow-hidden`}
            hidden={!isActive}
          >
            {shouldRenderPanel && tab === 'memory' && <MemoryPanel />}
            {shouldRenderPanel && tab === 'review' && <ReviewPanel />}
            {shouldRenderPanel && tab === 'artifacts' && <ArtifactsPanel />}
          </div>
        )
      })}
    </AppShell>
  )
}

export default App
