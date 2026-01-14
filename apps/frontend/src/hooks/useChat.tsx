/**
 * Chat WebSocket Hook
 *
 * React hook and context provider for managing WebSocket chat connection,
 * rooms, messages, and real-time state.
 */

import type { ReactNode } from "react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { WsChatWebSocket } from "../generated/websocket-types"
import { generateMessageId, getWebSocketUrl } from "../lib/chat-utils"
import type { ConnectionStatus } from "../lib/websocket-client"
import { WebSocketClient } from "../lib/websocket-client"
import { useAuth } from "./useAuth"

/**
 * Chat message with client-side metadata
 */
export interface ChatMessage {
  id: string
  roomId: string
  userId: string
  userEmail: string
  message: string
  timestamp: number
  isOwn: boolean
}

/**
 * Chat context interface
 */
interface ChatContextType {
  // Connection
  connectionStatus: ConnectionStatus
  error: string | null
  connect: () => void
  disconnect: () => void
  clearError: () => void

  // Room management
  currentRooms: string[]
  joinRoom: (roomId: string) => void
  leaveRoom: (roomId: string) => void
  isInRoom: (roomId: string) => boolean

  // Messaging
  sendMessage: (roomId: string, message: string) => void
  getMessages: (roomId: string) => ChatMessage[]
  clearMessages: (roomId: string) => void
  messages: Map<string, ChatMessage[]>

  // Typing indicators
  setTyping: (roomId: string, isTyping: boolean) => void
  sendTypingIndicator: (roomId: string, isTyping: boolean) => void
  getTypingUsers: (roomId: string) => string[]
  typingUsers: Map<string, Set<string>>

  // User presence
  roomUsers: Map<string, Set<string>>
  getRoomUserCount: (roomId: string) => number

  // Unread messages
  unreadCounts: Map<string, number>
  markRoomAsRead: (roomId: string) => void
}

const ChatContext = createContext<ChatContextType | null>(null)

/**
 * Chat Provider Props
 */
interface ChatProviderProps {
  children: ReactNode
  autoConnect?: boolean
  debug?: boolean
}

/**
 * Chat Provider Component
 */
export const ChatProvider = ({
  children,
  autoConnect = true,
  debug = false,
}: ChatProviderProps) => {
  const { user, isAuthenticated, getAuthToken } = useAuth()
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected")
  const [error, setError] = useState<string | null>(null)
  const [currentRooms, setCurrentRooms] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Map<string, ChatMessage[]>>(() => {
    // Load messages from localStorage
    try {
      const stored = localStorage.getItem("chat-messages")
      if (stored) {
        const parsed = JSON.parse(stored)
        return new Map(Object.entries(parsed))
      }
    } catch (e) {
      console.error("Failed to load messages from localStorage:", e)
    }
    return new Map()
  })
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(
    new Map(),
  )
  const [roomUsers, _setRoomUsers] = useState<Map<string, Set<string>>>(
    new Map(),
  )
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(
    new Map(),
  )
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)

  const wsClient = useRef<WebSocketClient<
    WsChatWebSocket.ClientMessage,
    WsChatWebSocket.ServerMessage
  > | null>(null)

  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  /**
   * Initialize WebSocket client
   */
  useEffect(() => {
    wsClient.current = new WebSocketClient<
      WsChatWebSocket.ClientMessage,
      WsChatWebSocket.ServerMessage
    >({
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      debug,
    })

    // Subscribe to connection status changes
    const unsubscribeConnection = wsClient.current.onConnectionChange(
      (status) => {
        setConnectionStatus(status)
        if (status === "error") {
          setError("Connection failed. Retrying...")
        } else if (status === "connected") {
          setError(null)
        }
      },
    )

    // Subscribe to server messages
    const unsubscribeRoomJoined = wsClient.current.on("room_joined", (msg) => {
      if (debug) console.log("Room joined:", msg)
      // Room joined confirmation handled by join function
    })

    const unsubscribeRoomLeft = wsClient.current.on("room_left", (msg) => {
      if (debug) console.log("Room left:", msg)
      // Don't add system messages for other users leaving (optional)
    })

    const unsubscribeUserCount = wsClient.current.on("user_count", (msg) => {
      if (debug) console.log("User count:", msg)

      // Type guard for user_count type
      if (msg.type !== "user_count") return

      // Note: Backend only sends count, not individual users
      // For now we just log it, real presence would need backend changes
    })

    const unsubscribeMessage = wsClient.current.on("message", (msg) => {
      if (debug) console.log("Message received:", msg)

      // Type guard for message type
      if (msg.type !== "message") return

      // Skip if this is our own message (already added optimistically)
      // Server doesn't echo back, but this protects against future changes
      if (msg.userId === user?.id) {
        if (debug) console.log("Skipping own message from server")
        return
      }

      const chatMessage: ChatMessage = {
        id: generateMessageId(),
        roomId: msg.roomId,
        userId: msg.userId,
        userEmail: msg.userEmail,
        message: msg.message,
        timestamp: msg.timestamp,
        isOwn: false, // Server messages are never our own (we handle ours optimistically)
      }

      setMessages((prev) => {
        const newMessages = new Map(prev)
        const roomMessages = newMessages.get(msg.roomId) || []
        const updated = [...roomMessages, chatMessage]
        newMessages.set(msg.roomId, updated)

        // Save to localStorage (limit to last 50 messages per room)
        try {
          const toSave: Record<string, ChatMessage[]> = {}
          for (const [roomId, msgs] of newMessages.entries()) {
            toSave[roomId] = msgs.slice(-50)
          }
          localStorage.setItem("chat-messages", JSON.stringify(toSave))
        } catch (e) {
          console.error("Failed to save messages to localStorage:", e)
        }

        return newMessages
      })

      // Increment unread count if not active room
      if (msg.roomId !== activeRoomId && msg.userId !== user?.id) {
        setUnreadCounts((prev) => {
          const newCounts = new Map(prev)
          newCounts.set(msg.roomId, (newCounts.get(msg.roomId) || 0) + 1)
          return newCounts
        })
      }
    })

    const unsubscribeTyping = wsClient.current.on("typing", (msg) => {
      if (debug) console.log("Typing indicator:", msg)

      // Type guard for typing type
      if (msg.type !== "typing") return

      // Ignore own typing indicators
      if (msg.userId === user?.id) return

      setTypingUsers((prev) => {
        const newTyping = new Map(prev)
        const roomTyping = newTyping.get(msg.roomId) || new Set()

        if (msg.isTyping) {
          roomTyping.add(msg.userEmail)
        } else {
          roomTyping.delete(msg.userEmail)
        }

        if (roomTyping.size > 0) {
          newTyping.set(msg.roomId, roomTyping)
        } else {
          newTyping.delete(msg.roomId)
        }

        return newTyping
      })

      // Auto-clear typing indicator after 3 seconds
      if (msg.isTyping) {
        const timeoutKey = `${msg.roomId}:${msg.userEmail}`
        const existingTimeout = typingTimeouts.current.get(timeoutKey)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }

        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const newTyping = new Map(prev)
            const roomTyping = newTyping.get(msg.roomId)
            if (roomTyping) {
              roomTyping.delete(msg.userEmail)
              if (roomTyping.size === 0) {
                newTyping.delete(msg.roomId)
              }
            }
            return newTyping
          })
          typingTimeouts.current.delete(timeoutKey)
        }, 3000)

        typingTimeouts.current.set(timeoutKey, timeout)
      }
    })

    const unsubscribeError = wsClient.current.on("error", (msg) => {
      console.error("WebSocket error:", msg)

      // Type guard for error type
      if (msg.type !== "error") return

      setError(msg.message)
      setTimeout(() => setError(null), 5000)
    })

    // Cleanup
    return () => {
      unsubscribeConnection()
      unsubscribeRoomJoined()
      unsubscribeRoomLeft()
      unsubscribeMessage()
      unsubscribeTyping()
      unsubscribeUserCount()
      unsubscribeError()

      // Clear all typing timeouts
      for (const timeout of typingTimeouts.current.values()) {
        clearTimeout(timeout)
      }
      typingTimeouts.current.clear()

      if (wsClient.current) {
        wsClient.current.disconnect()
      }
    }
  }, [user?.id, debug])

  /**
   * Auto-connect when authenticated
   */
  useEffect(() => {
    if (autoConnect && isAuthenticated && wsClient.current) {
      const token = getAuthToken()
      if (token) {
        const wsUrl = getWebSocketUrl()
        wsClient.current.connect(wsUrl, token)
      }
    }
  }, [autoConnect, isAuthenticated, getAuthToken])

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!wsClient.current) return

    const token = getAuthToken()
    if (!token) {
      setError("No authentication token")
      return
    }

    const wsUrl = getWebSocketUrl()
    wsClient.current.connect(wsUrl, token)
  }, [getAuthToken])

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsClient.current) {
      wsClient.current.disconnect()
    }
    setCurrentRooms(new Set())
  }, [])

  /**
   * Join a chat room
   */
  const joinRoom = useCallback((roomId: string) => {
    if (!wsClient.current?.isConnected()) {
      setError("Not connected to chat server")
      return
    }

    wsClient.current.send({
      type: "join",
      data: { roomId },
    })

    setCurrentRooms((prev) => new Set(prev).add(roomId))
  }, [])

  /**
   * Leave a chat room
   */
  const leaveRoom = useCallback((roomId: string) => {
    if (!wsClient.current?.isConnected()) {
      return
    }

    wsClient.current.send({
      type: "leave",
      data: { roomId },
    })

    setCurrentRooms((prev) => {
      const newRooms = new Set(prev)
      newRooms.delete(roomId)
      return newRooms
    })
  }, [])

  /**
   * Check if in a room
   */
  const isInRoom = useCallback(
    (roomId: string): boolean => {
      return currentRooms.has(roomId)
    },
    [currentRooms],
  )

  /**
   * Send a message to a room
   */
  const sendMessage = useCallback(
    (roomId: string, message: string) => {
      if (!wsClient.current?.isConnected()) {
        setError("Not connected to chat server")
        return
      }

      if (!currentRooms.has(roomId)) {
        setError("Not in this room")
        return
      }

      // Optimistic UI update - add message immediately
      const chatMessage: ChatMessage = {
        id: generateMessageId(),
        roomId,
        userId: user?.id || "",
        userEmail: user?.email || "",
        message: message.trim(),
        timestamp: Date.now(),
        isOwn: true,
      }

      setMessages((prev) => {
        const newMessages = new Map(prev)
        const roomMessages = newMessages.get(roomId) || []
        const updated = [...roomMessages, chatMessage]
        newMessages.set(roomId, updated)

        // Save to localStorage
        try {
          const toSave: Record<string, ChatMessage[]> = {}
          for (const [rid, msgs] of newMessages.entries()) {
            toSave[rid] = msgs.slice(-50)
          }
          localStorage.setItem("chat-messages", JSON.stringify(toSave))
        } catch (e) {
          console.error("Failed to save messages to localStorage:", e)
        }

        return newMessages
      })

      // Send to server
      wsClient.current.send({
        type: "message",
        data: { roomId, message: message.trim() },
      })
    },
    [currentRooms, user],
  )

  /**
   * Get messages for a room
   */
  const getMessages = useCallback(
    (roomId: string): ChatMessage[] => {
      return messages.get(roomId) || []
    },
    [messages],
  )

  /**
   * Clear messages for a room
   */
  const clearMessages = useCallback((roomId: string) => {
    setMessages((prev) => {
      const newMessages = new Map(prev)
      newMessages.delete(roomId)
      return newMessages
    })
  }, [])

  /**
   * Set typing indicator
   */
  const setTyping = useCallback(
    (roomId: string, isTyping: boolean) => {
      if (!wsClient.current?.isConnected()) {
        return
      }

      if (!currentRooms.has(roomId)) {
        return
      }

      wsClient.current.send({
        type: "typing",
        data: { roomId, isTyping },
      })
    },
    [currentRooms],
  )

  /**
   * Get typing users in a room
   */
  const getTypingUsers = useCallback(
    (roomId: string): string[] => {
      const roomTyping = typingUsers.get(roomId)
      return roomTyping ? Array.from(roomTyping) : []
    },
    [typingUsers],
  )

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Get room user count
   */
  const getRoomUserCount = useCallback(
    (roomId: string): number => {
      const users = roomUsers.get(roomId)
      return users ? users.size : 0
    },
    [roomUsers],
  )

  /**
   * Mark room as read (clear unread count)
   */
  const markRoomAsRead = useCallback((roomId: string) => {
    setUnreadCounts((prev) => {
      const newCounts = new Map(prev)
      newCounts.delete(roomId)
      return newCounts
    })
    setActiveRoomId(roomId)
  }, [])

  const value: ChatContextType = {
    connectionStatus,
    error,
    connect,
    disconnect,
    clearError,
    currentRooms: Array.from(currentRooms),
    joinRoom,
    leaveRoom,
    isInRoom,
    sendMessage,
    getMessages,
    clearMessages,
    messages,
    setTyping,
    sendTypingIndicator: setTyping,
    getTypingUsers,
    typingUsers,
    roomUsers,
    getRoomUserCount,
    unreadCounts,
    markRoomAsRead,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

/**
 * Use chat hook
 */
export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}
