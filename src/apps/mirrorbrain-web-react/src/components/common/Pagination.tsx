interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  return (
    <div className="flex items-center justify-between gap-4 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrevious}
        className={`
          px-4 py-2 rounded-lg font-heading font-semibold text-sm uppercase tracking-wide
          transition-all duration-200 cursor-pointer
          focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
          ${canGoPrevious
            ? 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
          }
        `}
        aria-label="Previous page"
      >
        ← Previous
      </button>

      <p className="font-body text-sm text-slate-600">
        Page <span className="font-semibold text-slate-900">{currentPage}</span> of{' '}
        <span className="font-semibold text-slate-900">{totalPages}</span>
      </p>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        className={`
          px-4 py-2 rounded-lg font-heading font-semibold text-sm uppercase tracking-wide
          transition-all duration-200 cursor-pointer
          focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
          ${canGoNext
            ? 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
          }
        `}
        aria-label="Next page"
      >
        Next →
      </button>
    </div>
  )
}