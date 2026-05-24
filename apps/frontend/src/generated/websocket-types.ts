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
 * WebSocket route: /ws/events
 */
export namespace WsEventsWebSocket {
  export type ClientMessage =
    | { type: "ping"; data: {
    type: "ping"
  } }

  export type ServerMessage = {
  type: "event"
  data: {
    id: string
    endpointId: string
    method: string
    sourceIp: string | null
    signingScheme: string
    signatureVerified: boolean
    receivedAt: string
  }
} | {
  type: "pong"
}
}
