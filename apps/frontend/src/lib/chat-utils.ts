/**
 * Chat Utility Functions
 *
 * Helper functions for chat functionality including timestamp formatting,
 * ID generation, and URL construction.
 */

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Get initials from email address
 */
export function getInitials(email: string): string {
  const parts = email.split("@")[0].split(".")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

/**
 * Format timestamp for chat messages
 */
export function formatTimestamp(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  // Just now (< 1 minute)
  if (minutes < 1) {
    return "Just now"
  }

  // Minutes ago (< 1 hour)
  if (hours < 1) {
    return `${minutes}m ago`
  }

  // Hours ago (< 24 hours)
  if (days < 1) {
    return `${hours}h ago`
  }

  // Days ago (< 7 days)
  if (days < 7) {
    return `${days}d ago`
  }

  // Fallback to date
  const date = new Date(timestamp)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  })
}

/**
 * Format timestamp for message details (hover/full view)
 */
export function formatFullTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/**
 * Get WebSocket URL from environment or current location
 */
export function getWebSocketUrl(): string {
  // Check for environment variable first
  const envUrl = import.meta.env.VITE_WS_URL
  if (envUrl) {
    return envUrl
  }

  // Construct from current location
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = window.location.hostname
  const port = import.meta.env.DEV ? "3000" : window.location.port
  const portSuffix = port ? `:${port}` : ""

  return `${protocol}//${host}${portSuffix}/ws/chat`
}

/**
 * Truncate long messages for previews
 */
export function truncateMessage(message: string, maxLength = 100): string {
  if (message.length <= maxLength) {
    return message
  }
  return `${message.substring(0, maxLength)}...`
}

/**
 * Check if a message was sent recently (within last 5 seconds)
 */
export function isRecentMessage(timestamp: number): boolean {
  return Date.now() - timestamp < 5000
}

/**
 * Group messages by date for display
 */
export function groupMessagesByDate(
  messages: Array<{ timestamp: number }>,
): Map<string, typeof messages> {
  const groups = new Map<string, typeof messages>()

  for (const message of messages) {
    const date = new Date(message.timestamp)
    const dateKey = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const group = groups.get(dateKey) || []
    group.push(message)
    groups.set(dateKey, group)
  }

  return groups
}

/**
 * Sanitize message content to prevent XSS
 */
export function sanitizeMessage(message: string): string {
  return message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}

/**
 * Detect and linkify URLs in message text
 */
export function linkifyMessage(message: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return sanitizeMessage(message).replace(
    urlRegex,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>',
  )
}
