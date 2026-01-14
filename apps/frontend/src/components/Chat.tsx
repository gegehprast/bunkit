import { useEffect, useRef, useState } from "react"
import { useChat } from "../hooks/useChat"
import { ChatMessageComponent } from "./ChatMessage"
import { ChatRoomSelector } from "./ChatRoomSelector"
import { MessageInput } from "./MessageInput"

export function Chat() {
  const {
    connectionStatus,
    currentRooms,
    messages,
    typingUsers,
    unreadCounts,
    error,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTypingIndicator,
    markRoomAsRead,
    clearError,
  } = useChat()

  const [selectedRoom, setSelectedRoom] = useState<string>("general")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      // Check if user is near bottom before auto-scrolling
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        })
      }
    }
  }, [messages.get(selectedRoom)])

  // Join selected room on mount and when room changes
  useEffect(() => {
    if (connectionStatus === "connected") {
      joinRoom(selectedRoom)
      markRoomAsRead(selectedRoom)
    }

    // Cleanup: leave room when switching or unmounting
    return () => {
      leaveRoom(selectedRoom)
    }
  }, [selectedRoom, connectionStatus])

  const roomMessages = messages.get(selectedRoom) || []
  const roomTyping = typingUsers.get(selectedRoom) || new Set()

  const handleSendMessage = (message: string) => {
    sendMessage(selectedRoom, message)
  }

  const handleTypingChange = (isTyping: boolean) => {
    sendTypingIndicator(selectedRoom, isTyping)
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-500"
      case "connecting":
        return "bg-yellow-500"
      case "disconnected":
        return "bg-red-500"
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected"
      case "connecting":
        return "Connecting..."
      case "disconnected":
        return "Disconnected"
    }
  }

  return (
    <div className="flex h-full bg-gray-950 rounded-lg shadow-sm overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Chat Rooms</h2>
          <div className="flex items-center gap-2 mt-2">
            <div
              className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}
            />
            <span className="text-sm text-gray-400">
              {getConnectionStatusText()}
            </span>
          </div>
        </div>

        {/* Room Selector */}
        <ChatRoomSelector
          selectedRoom={selectedRoom}
          onSelectRoom={setSelectedRoom}
          currentRooms={currentRooms}
          unreadCounts={unreadCounts}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-gray-900 shadow-sm border-b border-gray-800 p-4">
          <h3 className="text-lg font-semibold text-white capitalize">
            #{selectedRoom}
          </h3>
          {currentRooms.includes(selectedRoom) && (
            <p className="text-sm text-gray-400">Room joined</p>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-red-500 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="text-red-500 hover:text-red-700"
                aria-label="Close error"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/50"
        >
          {connectionStatus === "disconnected" && (
            <div className="text-center text-gray-400 py-8">
              <p>Not connected to chat server</p>
              <p className="text-sm mt-2">Please log in to start chatting</p>
            </div>
          )}

          {connectionStatus === "connected" && roomMessages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Be the first to send a message!</p>
            </div>
          )}

          {roomMessages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} />
          ))}

          {/* Typing Indicators */}
          {roomTyping.size > 0 && (
            <div className="text-sm text-gray-400 italic pl-4">
              {Array.from(roomTyping).join(", ")}{" "}
              {roomTyping.size === 1 ? "is" : "are"} typing...
            </div>
          )}

          <div ref={messagesEndRef} className="h-px" />
        </div>

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onTypingChange={handleTypingChange}
          disabled={
            connectionStatus !== "connected" ||
            !currentRooms.includes(selectedRoom)
          }
        />
      </div>
    </div>
  )
}
