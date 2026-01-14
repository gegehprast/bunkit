import { useEffect, useRef, useState } from "react"

interface MessageInputProps {
  onSendMessage: (message: string) => void
  onTypingChange: (isTyping: boolean) => void
  disabled?: boolean
}

export function MessageInput({
  onSendMessage,
  onTypingChange,
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus input when component mounts and is not disabled
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  useEffect(() => {
    // Clear timeout on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessage(value)

    if (disabled) return

    // Send typing indicator when user starts typing
    if (value && !isTyping) {
      setIsTyping(true)
      onTypingChange(true)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing indicator after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      onTypingChange(false)
    }, 1000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = message.trim()
    if (!trimmed || disabled) return

    onSendMessage(trimmed)
    setMessage("")

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false)
      onTypingChange(false)
    }

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Refocus input
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="bg-gray-900 border-t border-gray-800 p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled ? "Join a room to send messages" : "Type a message..."
          }
          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff73a8] focus:border-transparent disabled:bg-gray-950 disabled:cursor-not-allowed"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="px-6 py-2 bg-[#ff73a8] text-white rounded-lg hover:bg-[#ff5a93] focus:outline-none focus:ring-2 focus:ring-[#ff73a8] focus:ring-offset-2 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
