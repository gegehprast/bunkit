type BadgeVariant = "default" | "success" | "warning" | "danger" | "info"

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-zinc-100 text-zinc-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
}

export function Badge({ variant = "default", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
