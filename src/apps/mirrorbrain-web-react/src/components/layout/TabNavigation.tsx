import { KeyboardEvent } from 'react'

type TabType = 'memory' | 'review' | 'artifacts'

interface TabNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const TABS: TabType[] = ['memory', 'review', 'artifacts']

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
      className="flex gap-4 mb-8"
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
              px-6 py-3 rounded-lg font-heading font-semibold text-sm uppercase tracking-wide
              cursor-pointer transition-all duration-200
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
              ${isActive
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }
            `}
          >
            {tab}
          </button>
        )
      })}
    </div>
  )
}