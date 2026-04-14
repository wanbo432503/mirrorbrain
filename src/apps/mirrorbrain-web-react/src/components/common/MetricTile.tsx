interface MetricTileProps {
  label: string
  value: string | number
  description?: string
}

export default function MetricTile({ label, value, description }: MetricTileProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-heading font-bold text-slate-900 mb-1">
        {value}
      </p>
      {description && (
        <p className="text-sm font-body text-slate-500">
          {description}
        </p>
      )}
    </div>
  )
}