import { TextareaHTMLAttributes } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  helpText?: string
}

export default function TextArea({ label, error, helpText, className = '', ...props }: TextAreaProps) {
  const textareaId = props.id || props.name

  return (
    <div className="space-y-2">
      {/* Label */}
      <label
        htmlFor={textareaId}
        className="block text-sm font-heading font-semibold text-slate-900 uppercase tracking-wide"
      >
        {label}
      </label>

      {/* TextArea */}
      <textarea
        id={textareaId}
        className={`
          w-full px-4 py-3 rounded-lg font-body text-sm
          bg-white border border-slate-200 text-slate-900
          focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none
          transition-colors duration-200 resize-y
          ${error ? 'border-red-300 focus:ring-red-500' : 'hover:border-slate-300'}
          ${className}
        `}
        rows={props.rows || 4}
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