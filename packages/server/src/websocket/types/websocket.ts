import type { ServerWebSocket } from "bun"
import type { z } from "zod"

/**
 * Extract path parameters from a WebSocket route path string
 * Example: "/chat/:room" -> { room: string }
 */
export type ExtractWsParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractWsParams<`/${Rest}`>]: string }
    : T extends `${infer _Start}:${infer Param}`
      ? { [K in Param]: string }
      : Record<string, never>

/**
 * Context for WebSocket connections
 * Contains connection metadata and user-defined state
 */
export interface WebSocketContext<TUser = unknown> {
  /** Unique identifier for this connection */
  connectionId: string
  /** When the connection was established */
  connectedAt: Date
  /** User data from authentication middleware */
  user?: TUser
  /** Path parameters extracted from the route */
  params: Record<string, string>
  /** Custom state storage for this connection */
  data: Map<string, unknown>
}

/**
 * Data stored on each WebSocket connection
 * Used internally by Bun's ServerWebSocket.data
 */
export interface WebSocketData<TUser = unknown> {
  context: WebSocketContext<TUser>
  routePath: string
}

/**
 * Enhanced WebSocket with type-safe messaging
 * We use a wrapper pattern instead of extending ServerWebSocket
 * to provide type-safe send/publish methods
 */
export interface TypedWebSocket<TServerMsg = unknown, TUser = unknown> {
  /** The underlying Bun ServerWebSocket */
  readonly raw: ServerWebSocket<WebSocketData<TUser>>
  /** Connection data */
  readonly data: WebSocketData<TUser>
  /**
   * Send a type-safe message to this client
   */
  send(message: TServerMsg): void
  /**
   * Publish a type-safe message to all subscribers of a topic
   */
  publish(topic: string, message: TServerMsg): void
  /**
   * Subscribe to a topic
   */
  subscribe(topic: string): void
  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string): void
  /**
   * Check if subscribed to a topic
   */
  isSubscribed(topic: string): boolean
  /**
   * Get the buffered amount (for backpressure handling)
   */
  getBufferedAmount(): number
  /**
   * Close the connection
   */
  close(code?: number, reason?: string): void
  /**
   * Send binary data
   */
  sendBinary(data: Buffer): void
}

/**
 * Handler for incoming messages of a specific type
 */
export type MessageHandler<TData, TServerMsg = unknown, TUser = unknown> = (
  ws: TypedWebSocket<TServerMsg, TUser>,
  data: TData,
  ctx: WebSocketContext<TUser>,
) => Promise<void> | void

/**
 * Handler for binary messages
 */
export type BinaryMessageHandler<TServerMsg = unknown, TUser = unknown> = (
  ws: TypedWebSocket<TServerMsg, TUser>,
  buffer: Buffer,
  ctx: WebSocketContext<TUser>,
) => Promise<void> | void

/**
 * Handler for connection open event
 */
export type ConnectHandler<TServerMsg = unknown, TUser = unknown> = (
  ws: TypedWebSocket<TServerMsg, TUser>,
  ctx: WebSocketContext<TUser>,
) => Promise<void> | void

/**
 * Handler for connection close event
 */
export type CloseHandler<TServerMsg = unknown, TUser = unknown> = (
  ws: TypedWebSocket<TServerMsg, TUser>,
  code: number,
  reason: string,
  ctx: WebSocketContext<TUser>,
) => Promise<void> | void

/**
 * Handler for WebSocket errors
 */
export type ErrorHandler<TServerMsg = unknown, TUser = unknown> = (
  ws: TypedWebSocket<TServerMsg, TUser>,
  error: Error,
  ctx: WebSocketContext<TUser>,
) => Promise<void> | void

/**
 * Authentication function for WebSocket upgrade
 * Returns user data on success, or null/undefined to reject
 */
export type WebSocketAuthFn<TUser = unknown> = (
  req: Request,
) => Promise<TUser | null | undefined> | TUser | null | undefined

/**
 * Registered message handler with type and schema
 */
export interface RegisteredMessageHandler {
  type: string
  schema: z.ZodTypeAny
  handler: MessageHandler<unknown, unknown, unknown>
}

/**
 * WebSocket route definition stored in the registry
 */
export interface WebSocketRouteDefinition<
  TServerMsg = unknown,
  TUser = unknown,
> {
  path: string
  authFn?: WebSocketAuthFn<TUser>
  messageHandlers: RegisteredMessageHandler[]
  binaryHandler?: BinaryMessageHandler<TServerMsg, TUser>
  connectHandler?: ConnectHandler<TServerMsg, TUser>
  closeHandler?: CloseHandler<TServerMsg, TUser>
  errorHandler?: ErrorHandler<TServerMsg, TUser>
}

/**
 * Matched WebSocket route with extracted parameters
 */
export interface MatchedWebSocketRoute {
  definition: WebSocketRouteDefinition<unknown, unknown>
  params: Record<string, string>
}
