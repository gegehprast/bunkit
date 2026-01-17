// Auto-generated WebSocket types
// Do not edit manually

/* eslint-disable */
/* prettier-ignore */

/**
 * WebSocket Type Definitions
 * 
 * This file contains auto-generated types for WebSocket communication.
 * Both client->server and server->client message types are generated from Zod schemas.
 * 
 * Usage:
 * ```typescript
 * import { WsChatWebSocket } from './websocket-types'
 * 
 * // Client->server messages (auto-generated from .on() handlers)
 * const clientMessage: WsChatWebSocket.ClientMessage = {
 *   type: 'join',
 *   data: { roomId: 'room-123' }
 * }
 * 
 * // Server->client messages (auto-generated from .serverMessages() schema)
 * ws.onmessage = (event) => {
 *   const serverMessage: WsChatWebSocket.ServerMessage = JSON.parse(event.data)
 *   // Handle message with full type safety
 * }
 * ```
 */

/**
 * WebSocket route: /ws/chat
 */
export namespace WsChatWebSocket {
  export type ClientMessage =
    | { type: "join"; data: {
    roomId: string
  } }
    | { type: "leave"; data: {
    roomId: string
  } }
    | { type: "message"; data: {
    roomId: string
    message: string
  } }
    | { type: "typing"; data: {
    roomId: string
    isTyping: boolean
  } }

  export type ServerMessage = {
  type: "room_joined"
  timestamp: number
  roomId: string
  userId: string
  userEmail: string
} | {
  type: "room_left"
  timestamp: number
  roomId: string
  userId: string
  userEmail: string
} | {
  type: "message"
  message: string
  timestamp: number
  roomId: string
  userId: string
  userEmail: string
} | {
  type: "typing"
  isTyping: boolean
  roomId: string
  userId: string
  userEmail: string
} | {
  type: "user_count"
  roomId: string
  count: number
} | {
  type: "error"
  message: string
  code?: string | undefined
}
}
