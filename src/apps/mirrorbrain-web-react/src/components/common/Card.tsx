import type { HTMLAttributes } from 'react'

type CardVariant = 'utility' | 'tileLight' | 'tileParchment' | 'tileDark'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  children: React.ReactNode
  className?: string
}

export default function Card({
  variant = 'utility',
  children,
  className = '',
  ...props
}: CardProps) {
  const variantClasses: Record<CardVariant, string> = {
    // Utility: Store/accessories grid - hairline border, no shadow
    utility: 'bg-canvas border border-hairline rounded-lg p-lg',
    // Tile light: Full-bleed white product tile
    tileLight: 'bg-canvas rounded-none py-section px-lg',
    // Tile parchment: Alternating light tile
    tileParchment: 'bg-canvas-parchment rounded-none py-section px-lg',
    // Tile dark: Dark product tile with white text
    tileDark: 'bg-surfaceTile-1 rounded-none py-section px-lg text-bodyOnDark',
  }

  return (
    <div
      className={`${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}