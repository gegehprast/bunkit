import type React from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({
  label,
  error,
  className = "",
  id,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <input
        id={id}
        {...props}
        className={`rounded-md border px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 ${error ? "border-red-500" : "border-zinc-300"} ${className}`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
