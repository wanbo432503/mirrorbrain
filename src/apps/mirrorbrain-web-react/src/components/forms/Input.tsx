import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  helpText?: string
}

export default function Input({ label, error, helpText, className = '', ...props }: InputProps) {
  const inputId = props.id || props.name

  return (
    <div className="space-y-2">
      {/* Label */}
      <label
        htmlFor={inputId}
        className="block text-sm font-heading font-semibold text-slate-900 uppercase tracking-wide"
      >
        {label}
      </label>

      {/* Input */}
      <input
        id={inputId}
        className={`
          w-full px-4 py-3 rounded-lg font-body text-sm
          bg-white border border-slate-200 text-slate-900
          focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
          transition-colors duration-200
          ${error ? 'border-red-300 focus:ring-red-500' : 'hover:border-slate-300'}
          ${className}
        `}
        {...props}
      />

      {/* Error Message */}
      {error && (
        <p className="text-sm font-body text-red-700">
          {error}
        </p>
      )}

      {/* Help Text */}
      {helpText && !error && (
        <p className="text-sm font-body text-slate-500">
          {helpText}
        </p>
      )}
    </div>
  )
}