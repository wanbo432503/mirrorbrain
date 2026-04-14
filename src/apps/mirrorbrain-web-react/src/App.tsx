import { useState } from 'react'
import AppShell from './components/layout/AppShell'
import TabNavigation from './components/layout/TabNavigation'
import FeedbackBanner from './components/layout/FeedbackBanner'
import MemoryPanel from './components/memory/MemoryPanel'
import ReviewPanel from './components/review/ReviewPanel'
import ArtifactsPanel from './components/artifacts/ArtifactsPanel'
import { MirrorBrainProvider } from './contexts/MirrorBrainContext'

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
      <AppShell>
        {feedback && <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />}

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Panels */}
        <div role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`}>
          {activeTab === 'memory' && <MemoryPanel />}
          {activeTab === 'review' && <ReviewPanel />}
          {activeTab === 'artifacts' && <ArtifactsPanel />}
        </div>
      </AppShell>
    </MirrorBrainProvider>
  )
}

export default App