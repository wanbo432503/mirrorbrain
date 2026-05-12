import type { MemoryEvent } from '../../types/index'
import { formatUserDateTime } from '../../shared/user-time'

interface MemoryRecordProps {
  event: MemoryEvent
}

export default function MemoryRecord({ event }: MemoryRecordProps) {
  // Extract title from content based on sourceType
  const getTitle = () => {
    const content = event.content as {
      command?: string
      cwd?: string
      sourceSpecific?: { url?: string }
      title?: string
      url?: string
    }

    if (
      event.sourceType === 'activitywatch-browser' ||
      event.sourceType === 'browser'
    ) {
      return content.title || content.url || content.sourceSpecific?.url || 'Browser Event'
    } else if (
      event.sourceType === 'openviking-shell' ||
      event.sourceType === 'shell'
    ) {
      return content.title || content.command || content.cwd || 'Shell Event'
    }
    return content.title || 'Unknown Event'
  }

  return (
    <div className="bg-canvas border border-hairline rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-heading font-semibold text-base text-ink line-clamp-2">
            {getTitle()}
          </h3>
          <span className="text-xs font-body text-inkMuted-48 whitespace-nowrap">
            {formatUserDateTime(event.timestamp)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold bg-slate-100 text-inkMuted-80">
            {event.sourceType}
          </span>
        </div>
      </div>
    </div>
  )
}
