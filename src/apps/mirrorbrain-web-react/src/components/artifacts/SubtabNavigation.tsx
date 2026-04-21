type ArtifactsSubtab = 'history-topics' | 'draft-generation'

interface SubtabNavigationProps {
  activeSubtab: ArtifactsSubtab
  onSubtabChange: (subtab: ArtifactsSubtab) => void
}

const SUBTABS: { id: ArtifactsSubtab; label: string }[] = [
  { id: 'history-topics', label: 'History Topics' },
  { id: 'draft-generation', label: 'Draft Generation' },
]

export default function SubtabNavigation({ activeSubtab, onSubtabChange }: SubtabNavigationProps) {
  return (
    <div className="flex border-b border-slate-200 mb-3">
      {SUBTABS.map((subtab) => {
        const isActive = activeSubtab === subtab.id

        return (
          <button
            key={subtab.id}
            onClick={() => onSubtabChange(subtab.id)}
            className={`
              px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wide
              cursor-pointer transition-colors duration-200
              focus:ring-2 focus:ring-teal-500 focus:ring-inset focus:outline-none
              border-b-2 -mb-px
              ${isActive
                ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }
            `}
          >
            {subtab.label}
          </button>
        )
      })}
    </div>
  )
}