import type { ReviewedMemory } from '../../types/index';

interface KeptCandidateCardProps {
  reviewedMemory: ReviewedMemory;
  onUndo: (reviewedMemoryId: string) => void;
}

export default function KeptCandidateCard({ reviewedMemory, onUndo }: KeptCandidateCardProps) {
  const eventCount = reviewedMemory.memoryEventIds.length;

  return (
    <div className="bg-canvas border border-green-200 rounded-lg p-3 shadow-sm">
      <div className="space-y-2">
        {/* Header: Title + Badge */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-heading font-semibold text-sm text-ink line-clamp-2 flex-1">
            {reviewedMemory.candidateTitle}
          </h4>

          {/* Kept badge */}
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-heading font-semibold bg-green-100 text-green-700 border border-green-300">
              Kept
            </span>
          </div>
        </div>

        {/* Source count */}
        <p className="text-xs font-body text-inkMuted-80">
          {eventCount} pages
        </p>

        {/* Undo Button */}
        <div className="pt-2 border-t border-hairline">
          <button
            onClick={() => onUndo(reviewedMemory.id)}
            className="inline-flex items-center justify-center w-full h-8 rounded-md bg-hairline text-inkMuted-80 hover:bg-red-100 hover:text-red-700 transition-colors duration-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 cursor-pointer text-xs font-heading font-semibold"
            aria-label="Undo keep"
            type="button"
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  );
}