interface MetricTileProps {
  label: string
  value: string | number
  description?: string
}

export default function MetricTile({ label, value, description }: MetricTileProps) {
  return (
    <div className="bg-canvas border border-hairline rounded-lg p-2 shadow-sm">
      <p className="text-xs font-heading font-semibold text-inkMuted-80 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-lg font-heading font-bold text-ink mb-0.5">
        {value}
      </p>
      {description && (
        <p className="text-xs font-body text-inkMuted-48">
          {description}
        </p>
      )}
    </div>
  )
}