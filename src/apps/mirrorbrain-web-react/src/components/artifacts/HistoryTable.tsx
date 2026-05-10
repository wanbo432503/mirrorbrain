import Pagination from '../common/Pagination'
import EmptyState from '../common/EmptyState'
import Card from '../common/Card'

interface HistoryItem {
  id: string
  primary: string
  secondary: string
  tertiary?: string
}

interface HistoryTableProps {
  title: string
  items: HistoryItem[]
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const HISTORY_PAGE_SIZE = 5

export default function HistoryTable({
  title,
  items,
  currentPage,
  totalPages,
  onPageChange,
}: HistoryTableProps) {
  if (items.length === 0) {
    return (
      <Card className="max-h-[540px] overflow-y-auto">
        <div>
          <p className="text-xs font-heading font-semibold text-inkMuted-80 uppercase tracking-wide mb-3">
            {title}
          </p>
          <EmptyState
            message="No items available"
            description="Items will appear here once generated"
          />
        </div>
      </Card>
    )
  }

  return (
    <Card className="max-h-[540px] overflow-y-auto">
      <div className="space-y-3">
        {/* Title */}
        <p className="text-xs font-heading font-semibold text-inkMuted-80 uppercase tracking-wide">
          {title}
        </p>

        {/* Items */}
        <div className="space-y-2">
          {items.slice(0, HISTORY_PAGE_SIZE).map((item) => (
            <div key={item.id} className="rounded-lg border border-hairline bg-slate-50 p-3">
              <p className="font-body text-sm font-medium text-ink">
                {item.primary}
              </p>
              <p className="font-body text-sm text-slate-700 mt-1">
                {item.secondary}
              </p>
              {item.tertiary && (
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-md bg-hairline px-2 py-1 text-[11px] font-heading font-semibold uppercase tracking-wide text-slate-700">
                    {item.tertiary}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        )}
      </div>
    </Card>
  )
}