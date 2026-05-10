import MetricTile from '../common/MetricTile'

interface MetricGridProps {
  candidateCount: number
  reviewWindowDate: string | null
  reviewWindowEventCount: number
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
  }).format(date)
}

export default function MetricGrid({
  candidateCount,
  reviewWindowDate,
  reviewWindowEventCount,
}: MetricGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
      <MetricTile
        label="Review Window"
        value={formatDate(reviewWindowDate)}
        description={reviewWindowDate ? 'Selected date' : 'Select a date to review'}
      />
      <MetricTile
        label="URLs"
        value={reviewWindowEventCount}
        description="Unique URLs in window"
      />
      <MetricTile
        label="Candidates"
        value={candidateCount}
        description="Generated candidates"
      />
      <MetricTile
        label="Pending"
        value={candidateCount}
        description="Awaiting review"
      />
    </div>
  )
}
