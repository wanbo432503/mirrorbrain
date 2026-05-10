interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function getPaginationControlState(currentPage: number, totalPages: number) {
  return {
    canGoFirst: currentPage > 1,
    canGoPrevious: currentPage > 1,
    canGoNext: currentPage < totalPages,
    canGoLast: currentPage < totalPages,
  }
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { canGoFirst, canGoPrevious, canGoNext, canGoLast } =
    getPaginationControlState(currentPage, totalPages)

  return (
    <div className="flex items-center justify-between gap-4 mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={!canGoFirst}
          className={`
            px-4 py-2 rounded-md font-heading font-semibold text-sm uppercase tracking-wide
            transition-colors duration-200 cursor-pointer
            focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:outline-none
            ${canGoFirst
              ? 'bg-canvas text-ink border border-slate-300 hover:bg-slate-100 hover:border-slate-400'
              : 'bg-slate-100 text-slate-400 border border-hairline cursor-not-allowed opacity-50'
            }
          `}
          aria-label="First page"
        >
          « First
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          className={`
            px-4 py-2 rounded-md font-heading font-semibold text-sm uppercase tracking-wide
            transition-colors duration-200 cursor-pointer
            focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:outline-none
            ${canGoPrevious
              ? 'bg-canvas text-ink border border-slate-300 hover:bg-slate-100 hover:border-slate-400'
              : 'bg-slate-100 text-slate-400 border border-hairline cursor-not-allowed opacity-50'
            }
          `}
          aria-label="Previous page"
        >
          ← Previous
        </button>
      </div>

      <p className="font-body text-sm text-inkMuted-80">
        Page <span className="font-semibold text-ink">{currentPage}</span> of{' '}
        <span className="font-semibold text-ink">{totalPages}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className={`
            px-4 py-2 rounded-md font-heading font-semibold text-sm uppercase tracking-wide
            transition-colors duration-200 cursor-pointer
            focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:outline-none
            ${canGoNext
              ? 'bg-canvas text-ink border border-slate-300 hover:bg-slate-100 hover:border-slate-400'
              : 'bg-slate-100 text-slate-400 border border-hairline cursor-not-allowed opacity-50'
            }
          `}
          aria-label="Next page"
        >
          Next →
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoLast}
          className={`
            px-4 py-2 rounded-md font-heading font-semibold text-sm uppercase tracking-wide
            transition-colors duration-200 cursor-pointer
            focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:outline-none
            ${canGoLast
              ? 'bg-canvas text-ink border border-slate-300 hover:bg-slate-100 hover:border-slate-400'
              : 'bg-slate-100 text-slate-400 border border-hairline cursor-not-allowed opacity-50'
            }
          `}
          aria-label="Last page"
        >
          Last »
        </button>
      </div>
    </div>
  )
}
