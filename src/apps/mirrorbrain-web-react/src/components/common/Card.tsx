import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
