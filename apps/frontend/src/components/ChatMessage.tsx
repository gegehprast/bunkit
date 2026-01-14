import type { ChatMessage } from "../hooks/useChat"
import { formatTimestamp, getInitials, linkifyMessage } from "../lib/chat-utils"

interface ChatMessageComponentProps {
  message: ChatMessage
}

export function ChatMessageComponent({ message }: ChatMessageComponentProps) {
  const initials = getInitials(message.userEmail)
  const timestamp = formatTimestamp(message.timestamp)
  const messageHtml = linkifyMessage(message.message)

  return (
    <div
      className={`flex gap-3 ${
        message.isOwn ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
          message.isOwn ? "bg-blue-500" : "bg-gray-500"
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
          className={`text-sm text-gray-600 mb-1 ${
            message.isOwn ? "text-right" : "text-left"
          }`}
        >
          <span className="font-medium">{message.userEmail}</span>
          <span className="text-gray-400 ml-2">{timestamp}</span>
        </div>

        {/* Message Bubble */}
        <div
          className={`rounded-lg px-4 py-2 ${
            message.isOwn
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-800 border border-gray-200"
          }`}
        >
          <p
            className="wrap-break-word whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: messageHtml }}
          />
        </div>
      </div>
    </div>
  )
}
