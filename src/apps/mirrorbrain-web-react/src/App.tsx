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
type ThemeMode = 'light' | 'dark'

const TABS: TabType[] = ['memory', 'review', 'artifacts']

interface Feedback {
  kind: FeedbackKind
  message: string
}

function getInitialTheme(): ThemeMode {
  return window.localStorage.getItem('mirrorbrain-theme') === 'dark' ? 'dark' : 'light'
}

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('memory')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('mirrorbrain-theme', theme)
  }, [theme])

  return (
    <MirrorBrainProvider>
      <AppContent
        activeTab={activeTab}
        feedback={feedback}
        theme={theme}
        onTabChange={setActiveTab}
        onDismissFeedback={() => setFeedback(null)}
        onThemeToggle={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
      />
    </MirrorBrainProvider>
  )
}

function AppContent({
  activeTab,
  feedback,
  theme,
  onTabChange,
  onDismissFeedback,
  onThemeToggle,
}: {
  activeTab: TabType
  feedback: Feedback | null
  theme: ThemeMode
  onTabChange: (tab: TabType) => void
  onDismissFeedback: () => void
  onThemeToggle: () => void
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
    <AppShell theme={theme} onThemeToggle={onThemeToggle}>
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
