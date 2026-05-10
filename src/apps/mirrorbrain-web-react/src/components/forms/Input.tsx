import { InputHTMLAttributes } from 'react'

type InputVariant = 'default' | 'search'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  variant?: InputVariant
  error?: string
  helpText?: string
}

export default function Input({
  label,
  variant = 'default',
  error,
  helpText,
  className = '',
  ...props
}: InputProps) {
  const inputId = props.id || props.name

  const baseClasses = `
    w-full font-body transition-colors duration-200
    focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:outline-none
  `

  const variantClasses: Record<InputVariant, string> = {
    // Default form input
    default: `
      px-4 py-3 rounded-lg text-body
      bg-canvas border border-hairline text-ink
      hover:border-dividerSoft
      ${error ? 'border-red-400 focus:ring-red-500' : ''}
    `,
    // Search: Pill-shaped matching CTA grammar
    search: `
      px-sm py-xs rounded-pill h-11
      bg-canvas border border-dividerSoft text-ink
      placeholder:text-inkMuted-48
    `,
  }

  const labelClasses = 'block text-caption-strong text-ink uppercase tracking-wide'
  const errorClasses = 'text-caption text-red-600'
  const helpClasses = 'text-caption text-inkMuted-48'

  return (
    <div className="space-y-xxs">
      {label && (
        <label htmlFor={inputId} className={labelClasses}>
          {label}
        </label>
      )}

      <input
        id={inputId}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        {...props}
      />

      {error && <p className={errorClasses}>{error}</p>}
      {helpText && !error && <p className={helpClasses}>{helpText}</p>}
    </div>
  )
}