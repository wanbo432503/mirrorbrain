import { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'default' | 'pearl'

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
    inline-flex items-center justify-center gap-2
    transition-all duration-200 cursor-pointer
    focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.95]
  `

  const variantClasses: Record<ButtonVariant, string> = {
    // Primary: Action Blue pill - main CTAs
    primary: `
      bg-primary text-white
      rounded-pill px-5.5 py-2.75
      text-body font-normal
    `,
    // Secondary: Ghost pill - second CTA with primary
    secondary: `
      bg-transparent text-primary
      border border-primary
      rounded-pill px-5.5 py-2.75
      text-body font-normal
    `,
    // Default: Dark utility - nav/utility buttons
    default: `
      bg-ink text-bodyOnDark
      rounded-sm px-3.75 py-2
      text-button-utility font-normal
    `,
    // Pearl: Secondary in cards
    pearl: `
      bg-surfacePearl text-inkMuted-80
      border-2 border-dividerSoft
      rounded-md px-3.5 py-2
      text-caption font-normal
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