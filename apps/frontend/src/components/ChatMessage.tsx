import type { ChatMessage } from "../hooks/useChat"
import {
  formatTimestamp,
  getInitials,
  parseMessageParts,
} from "../lib/chat-utils"

interface ChatMessageComponentProps {
  message: ChatMessage
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  const initials = getInitials(message.userEmail)
  const timestamp = formatTimestamp(message.timestamp)
  const messageParts = parseMessageParts(message.message)

  return (
    <div
      className={`flex gap-3 ${
        message.isOwn ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
          message.isOwn ? "bg-[#ff73a8]" : "bg-gray-700"
        }`}
      >
        {initials}
      </div>

      {/* Message Content */}
      <div
        className={`flex flex-col max-w-md ${
          message.isOwn ? "items-end" : "items-start"
        }`}
      >
        {/* User Info */}
        <div
          className={`text-sm text-gray-400 mb-1 ${
            message.isOwn ? "text-right" : "text-left"
          }`}
        >
          <span className="font-medium text-gray-300">{message.userEmail}</span>
          <span className="text-gray-500 ml-2">{timestamp}</span>
        </div>

        {/* Message Bubble */}
        <div
          className={`rounded-lg px-4 py-2 ${
            message.isOwn
              ? "bg-[#ff73a8] text-white"
              : "bg-gray-800 text-gray-200 border border-gray-700"
          }`}
        >
          <p className="wrap-break-word whitespace-pre-wrap">
            {messageParts.map((part, index) =>
              part.type === "link" ? (
                <a
                  key={index}
                  href={part.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline hover:opacity-80 ${
                    message.isOwn ? "text-pink-100" : "text-[#ff73a8]"
                  }`}
                >
                  {part.content}
                </a>
              ) : (
                <span key={index}>{part.content}</span>
              ),
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
