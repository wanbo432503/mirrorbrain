import Pagination from '../common/Pagination'
import EmptyState from '../common/EmptyState'

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
      <div className="mb-8">
        <h3 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide mb-3">
          {title}
        </h3>
        <EmptyState
          message="No items available"
          description="Items will appear here once generated"
        />
      </div>
    )
  }

  return (
    <div className="mb-8">
      {/* Title */}
      <h3 className="font-heading font-bold text-base text-slate-900 uppercase tracking-wide mb-3">
        {title}
      </h3>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide">
                Primary
              </th>
              <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide">
                Secondary
              </th>
              {items.some((item) => item.tertiary) && (
                <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-slate-600 uppercase tracking-wide">
                  Tertiary
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.slice(0, HISTORY_PAGE_SIZE).map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors duration-200">
                <td className="px-4 py-3 text-sm font-heading font-semibold text-slate-900">
                  {item.primary}
                </td>
                <td className="px-4 py-3 text-sm font-body text-slate-700">
                  {item.secondary}
                </td>
                {item.tertiary && (
                  <td className="px-4 py-3 text-sm font-body text-slate-600">
                    {item.tertiary}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      )}
    </div>
  )
}