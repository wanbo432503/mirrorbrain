interface EmptyStateProps {
  message: string
  description?: string
}

export default function EmptyState({ message, description }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-6">
      <p className="font-heading font-semibold text-lg text-inkMuted-80 mb-2">
        {message}
      </p>
      {description && (
        <p className="font-body text-sm text-inkMuted-48">
          {description}
        </p>
      )}
    </div>
  )
}