interface MetricTileProps {
  label: string
  value: string | number
  description?: string
}

export default function MetricTile({ label, value, description }: MetricTileProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
      <p className="text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-lg font-heading font-bold text-slate-900 mb-0.5">
        {value}
      </p>
      {description && (
        <p className="text-xs font-body text-slate-500">
          {description}
        </p>
      )}
    </div>
  )
}