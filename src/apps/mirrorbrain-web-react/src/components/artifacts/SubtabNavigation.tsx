type ArtifactsSubtab = 'history-topics' | 'generate-knowledge' | 'generate-skill'

interface SubtabNavigationProps {
  activeSubtab: ArtifactsSubtab
  onSubtabChange: (subtab: ArtifactsSubtab) => void
}

const SUBTABS: { id: ArtifactsSubtab; label: string }[] = [
  { id: 'history-topics', label: 'History Topics' },
  { id: 'generate-knowledge', label: 'Generate Knowledge' },
  { id: 'generate-skill', label: 'Generate Skill' },
]

export default function SubtabNavigation({ activeSubtab, onSubtabChange }: SubtabNavigationProps) {
  return (
    <div className="flex gap-2 mb-3">
      {SUBTABS.map((subtab) => {
        const isActive = activeSubtab === subtab.id

        return (
          <button
            key={subtab.id}
            onClick={() => onSubtabChange(subtab.id)}
            className={`
              px-3 py-1.5 rounded-lg font-heading font-semibold text-xs uppercase tracking-wide
              cursor-pointer transition-all duration-200
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
              ${isActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
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