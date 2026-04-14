import MemoryRecord from './MemoryRecord'
import EmptyState from '../common/EmptyState'
import type { MemoryEvent } from '../../types/index'

interface MemoryListProps {
  events: MemoryEvent[]
}

export default function MemoryList({ events }: MemoryListProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        message="No memory events imported yet"
        description="Sync browser or shell memory to populate the system"
      />
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <MemoryRecord key={event.id} event={event} />
      ))}
    </div>
  )
}