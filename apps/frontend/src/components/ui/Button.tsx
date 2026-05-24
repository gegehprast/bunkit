import type React from "react"

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
type ButtonSize = "sm" | "md" | "lg"

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 border-transparent",
  secondary: "bg-white text-zinc-700 hover:bg-zinc-50 border-zinc-300",
  danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 border-transparent",
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <title>Loading...</title>
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
