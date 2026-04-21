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
    transition-colors duration-200 cursor-pointer inline-flex items-center justify-center gap-2
    focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
  `

  const variantClasses: Record<ButtonVariant, string> = {
    default: `
      bg-white text-slate-900 border border-slate-300
      hover:bg-slate-100 hover:border-slate-400
    `,
    primary: `
      bg-teal-600 text-white border border-transparent
      hover:bg-teal-700
    `,
    success: `
      bg-green-600 text-white border border-transparent
      hover:bg-green-700
    `,
    ghost: `
      bg-transparent text-slate-600 border border-slate-300
      hover:bg-slate-100 hover:text-slate-900 hover:border-slate-400
    `,
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="animate-spin">⟳</span>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}