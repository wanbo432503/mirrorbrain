import { KeyboardEvent } from 'react'

type TabType = 'memory-sources' | 'review' | 'knowledge' | 'skill' | 'work-sessions'

interface TabNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const TABS: TabType[] = ['memory-sources', 'review', 'knowledge', 'skill', 'work-sessions']

const TAB_LABELS: Record<TabType, string> = {
  'memory-sources': 'memory sources',
  review: 'review',
  knowledge: 'knowledge',
  skill: 'skill',
  'work-sessions': 'work sessions',
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = TABS.indexOf(activeTab)

    if (event.key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % TABS.length
      onTabChange(TABS[nextIndex])
    } else if (event.key === 'ArrowLeft') {
      const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length
      onTabChange(TABS[prevIndex])
    }
  }

  return (
    <div
      role="tablist"
      className="flex shrink-0 border-b border-slate-200"
      aria-label="MirrorBrain main navigation"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab

        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab}-panel`}
            tabIndex={isActive ? 0 : -1}
            id={`${tab}-tab`}
            onClick={() => onTabChange(tab)}
            onKeyDown={handleKeyDown}
            className={`
              px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
              cursor-pointer transition-colors duration-200
              focus:ring-2 focus:ring-primary-focus focus:ring-inset focus:outline-none
              border-b-2 -mb-px
              ${isActive
                ? 'border-primary text-primary bg-canvas/50'
                : 'border-transparent text-inkMuted-80 hover:text-ink hover:border-slate-300'
              }
            `}
          >
            {TAB_LABELS[tab]}
          </button>
        )
      })}
    </div>
  )
}
