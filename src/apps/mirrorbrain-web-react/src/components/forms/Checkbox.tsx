import { InputHTMLAttributes } from 'react'

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
}

export default function Checkbox({ label, description, className = '', ...props }: CheckboxProps) {
  const checkboxId = props.id || props.name

  return (
    <div className="flex items-start gap-3">
      {/* Checkbox */}
      <input
        type="checkbox"
        id={checkboxId}
        className={`
          w-5 h-5 rounded border-2 border-slate-300
          text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          transition-colors duration-200 cursor-pointer
          ${className}
        `}
        {...props}
      />

      {/* Label and Description */}
      <div className="space-y-1">
        <label
          htmlFor={checkboxId}
          className="text-sm font-heading font-semibold text-slate-900 cursor-pointer"
        >
          {label}
        </label>

        {description && (
          <p className="text-sm font-body text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}