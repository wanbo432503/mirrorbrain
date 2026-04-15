import { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'default' | 'primary' | 'success' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  children: React.ReactNode
}

export default function Button({
  variant = 'default',
  loading = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = `
    px-3 py-1.5 rounded-lg font-heading font-semibold text-xs uppercase tracking-wide
    transition-all duration-200 cursor-pointer
    focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
    disabled:opacity-40 disabled:cursor-not-allowed
  `

  const variantClasses: Record<ButtonVariant, string> = {
    default: `
      bg-white text-slate-900 border border-slate-200
      hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm
    `,
    primary: `
      bg-blue-600 text-white border border-transparent
      hover:bg-blue-700 hover:shadow-md
    `,
    success: `
      bg-green-100 text-green-700 border border-green-300
      hover:bg-green-200 hover:border-green-400
    `,
    ghost: `
      bg-transparent text-slate-600 border border-slate-200
      hover:bg-slate-50 hover:text-slate-900
    `,
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⟳</span>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}