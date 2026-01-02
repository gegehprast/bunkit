/**
 * WebSocket Chat Route
 *
 * Demonstrates real-time chat functionality with:
 * - Room-based messaging
 * - Bearer token authentication
 * - Type-safe message handling
 * - User presence tracking
 */

import { createTokenAuth, createWebSocketRoute } from "@bunkit/server"
import { z } from "zod"
import { verifyToken } from "@/auth/auth.service"
import { logger } from "@/core/logger"
import { server } from "@/core/server"

// Define client -> server message schemas
const JoinRoomSchema = z.object({
  roomId: z.string().min(1).max(50),
})

const LeaveRoomSchema = z.object({
  roomId: z.string().min(1).max(50),
})

const ChatMessageSchema = z.object({
  roomId: z.string().min(1).max(50),
  message: z.string().min(1).max(1000),
})

const TypingSchema = z.object({
  roomId: z.string().min(1).max(50),
  isTyping: z.boolean(),
})

// Define server -> client message types
type ServerMessage =
  | {
      type: "room_joined"
      roomId: string
      userId: string
      userEmail: string
      timestamp: number
    }
  | {
      type: "room_left"
      roomId: string
      userId: string
      userEmail: string
      timestamp: number
    }
  | {
      type: "message"
      roomId: string
      userId: string
      userEmail: string
      message: string
      timestamp: number
    }
  | {
      type: "typing"
      roomId: string
      userId: string
      userEmail: string
      isTyping: boolean
    }
  | {
      type: "user_count"
      roomId: string
      count: number
    }
  | {
      type: "error"
      message: string
      code?: string
    }

// Create WebSocket authentication using existing JWT verification
const wsAuth = createTokenAuth(async (token: string) => {
  const result = await verifyToken(token)
  if (result.isErr()) {
    logger.warn("WebSocket auth failed", { error: result.error })
    return null
  }

  const payload = result.value
  return {
    id: payload.userId,
    email: payload.email,
  }
})

// Create WebSocket chat route
createWebSocketRoute("/ws/chat", server)
  .serverMessages<ServerMessage>()
  .authenticate(wsAuth)
  .onConnect((_ws, ctx) => {
    if (!ctx.user) {
      logger.warn("WebSocket opened without user (should not happen)")
      return
    }

    logger.info("User connected to chat", {
      userId: ctx.user.id,
      email: ctx.user.email,
      connectionId: ctx.connectionId,
    })

    // Initialize user's room set in connection data
    ctx.data.set("rooms", new Set<string>())
  })
  .on("join", JoinRoomSchema, (ws, data, ctx) => {
    if (!ctx.user) return

    const { roomId } = data
    const rooms = ctx.data.get("rooms") as Set<string>

    // Subscribe to room topic
    ws.subscribe(`room:${roomId}`)
    rooms.add(roomId)

    logger.info("User joined room", {
      userId: ctx.user.id,
      roomId,
    })

    // Notify room about new user
    ws.publish(`room:${roomId}`, {
      type: "room_joined",
      roomId,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      timestamp: Date.now(),
    })

    // Send confirmation to the user
    ws.send({
      type: "room_joined",
      roomId,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      timestamp: Date.now(),
    })
  })
  .on("leave", LeaveRoomSchema, (ws, data, ctx) => {
    if (!ctx.user) return

    const { roomId } = data
    const rooms = ctx.data.get("rooms") as Set<string>

    logger.info("User leaving room", {
      userId: ctx.user.id,
      roomId,
    })

    // Notify room about user leaving BEFORE unsubscribing
    ws.publish(`room:${roomId}`, {
      type: "room_left",
      roomId,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      timestamp: Date.now(),
    })

    // Then unsubscribe from room topic
    ws.unsubscribe(`room:${roomId}`)
    rooms.delete(roomId)
  })
  .on("message", ChatMessageSchema, (ws, data, ctx) => {
    if (!ctx.user) return

    const { roomId, message } = data

    logger.debug("Chat message received", {
      userId: ctx.user.id,
      roomId,
      messageLength: message.length,
    })

    // Broadcast message to all users in the room
    ws.publish(`room:${roomId}`, {
      type: "message",
      roomId,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      message: message,
      timestamp: Date.now(),
    })
  })
  .on("typing", TypingSchema, (ws, data, ctx) => {
    if (!ctx.user) return

    const { roomId, isTyping } = data

    // Broadcast typing indicator to room (excluding sender would require filtering)
    ws.publish(`room:${roomId}`, {
      type: "typing",
      roomId,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      isTyping,
    })
  })
  .onClose((ws, code, reason, ctx) => {
    if (!ctx.user) return

    const rooms = ctx.data.get("rooms") as Set<string> | undefined

    if (rooms) {
      // Notify all rooms that user left
      for (const roomId of rooms) {
        ws.publish(`room:${roomId}`, {
          type: "room_left",
          roomId,
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          timestamp: Date.now(),
        })
      }
    }

    logger.info("User disconnected from chat", {
      userId: ctx.user.id,
      email: ctx.user.email,
      code,
      reason,
    })
  })
  .onError((ws, error, ctx) => {
    logger.error("WebSocket error", {
      userId: ctx.user?.id,
      error: error.message,
      stack: error.stack,
    })

    // Send error message to client
    ws.send({
      type: "error",
      message: "An error occurred",
      code: "WEBSOCKET_ERROR",
    })
  })
  .build()

logger.info("✅ Chat WebSocket route registered")
