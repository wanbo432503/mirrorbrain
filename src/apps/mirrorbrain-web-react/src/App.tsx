import { useEffect, useMemo, useState } from 'react'
import AppShell from './components/layout/AppShell'
import TabNavigation from './components/layout/TabNavigation'
import FeedbackBanner from './components/layout/FeedbackBanner'
import SkillTabPanel from './components/artifacts/SkillTabPanel'
import ConfigurePanel from './components/configure/ConfigurePanel'
import SourceManagementPanel from './components/sources/SourceManagementPanel'
import WorkSessionAnalysisPanel from './components/work-sessions/WorkSessionAnalysisPanel'
import { createMirrorBrainBrowserApi } from './api/client'
import { MirrorBrainProvider } from './contexts/MirrorBrainContext'
import { useMirrorBrainState } from './hooks/useMirrorBrainState'

type TabType = 'memory-sources' | 'preview' | 'published' | 'skill' | 'configure'
type FeedbackKind = 'success' | 'error' | 'info'
type VisitedTabs = Record<TabType, boolean>
type ThemeMode = 'light' | 'dark'

const TABS: TabType[] = ['memory-sources', 'preview', 'published', 'skill', 'configure']

interface Feedback {
  kind: FeedbackKind
  message: string
}

function getInitialTheme(): ThemeMode {
  return window.localStorage.getItem('mirrorbrain-theme') === 'dark' ? 'dark' : 'light'
}

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('memory-sources')
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
    'memory-sources': true,
    preview: false,
    published: false,
    skill: false,
    configure: false,
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
            {shouldRenderPanel && tab === 'preview' && (
              <WorkSessionAnalysisPanel api={api} mode="preview" active={isActive} />
            )}
            {shouldRenderPanel && tab === 'published' && (
              <WorkSessionAnalysisPanel api={api} mode="published" active={isActive} />
            )}
            {shouldRenderPanel && tab === 'skill' && <SkillTabPanel />}
            {shouldRenderPanel && tab === 'configure' && <ConfigurePanel api={api} />}
            {shouldRenderPanel && tab === 'memory-sources' && <SourceManagementPanel api={api} />}
          </div>
        )
      })}
    </AppShell>
  )
}

export default App
