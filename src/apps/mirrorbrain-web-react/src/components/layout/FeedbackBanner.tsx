import { useEffect } from 'react'

type FeedbackKind = 'success' | 'error' | 'info'

interface Feedback {
  kind: FeedbackKind
  message: string
}

interface FeedbackBannerProps {
  feedback: Feedback | null
  onDismiss: () => void
}

export default function FeedbackBanner({ feedback, onDismiss }: FeedbackBannerProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        onDismiss()
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [feedback, onDismiss])

  if (!feedback) return null

  const bgColorClasses: Record<FeedbackKind, string> = {
    success: 'bg-green-50 border-green-300',
    error: 'bg-red-50 border-red-300',
    info: 'bg-primary/10 border-blue-300',
  }

  const textColorClasses: Record<FeedbackKind, string> = {
    success: 'text-green-700',
    error: 'text-red-700',
    info: 'text-blue-700',
  }

  const iconClasses: Record<FeedbackKind, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }

  return (
    <div
      className={`${bgColorClasses[feedback.kind]} ${textColorClasses[feedback.kind]}
                 border rounded-lg px-4 py-3 mb-6 shadow-sm animate-slide-down
                 flex items-center gap-3 justify-between`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg" aria-hidden="true">
          {iconClasses[feedback.kind]}
        </span>
        <p className="font-body font-medium text-sm">
          {feedback.message}
        </p>
      </div>

      <button
        onClick={onDismiss}
        className="text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Dismiss message"
      >
        <span className="text-xl">×</span>
      </button>
    </div>
  )
}