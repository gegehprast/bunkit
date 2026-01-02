import type { Server as BunServer, ServerWebSocket } from "bun"
import type {
  TypedWebSocket,
  WebSocketContext,
  WebSocketData,
} from "./types/websocket"
import {
  type WebSocketRouteRegistry,
  webSocketRouteRegistry,
} from "./websocket-registry"

/**
 * Generate a unique connection ID
 */
function generateConnectionId(): string {
  return crypto.randomUUID()
}

/**
 * Create a WebSocketContext for a new connection
 */
function createWebSocketContext<TUser>(
  params: Record<string, string>,
  user?: TUser,
): WebSocketContext<TUser> {
  return {
    connectionId: generateConnectionId(),
    connectedAt: new Date(),
    user,
    params,
    data: new Map(),
  }
}

/**
 * Parse incoming WebSocket message
 * Expected format: { type: string, data: unknown }
 */
function parseMessage(
  message: string | Buffer,
): { type: string; data: unknown } | null {
  if (typeof message !== "string") {
    return null // Binary message, handled separately
  }

  try {
    const parsed = JSON.parse(message) as unknown
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      typeof (parsed as { type: unknown }).type === "string"
    ) {
      return {
        type: (parsed as { type: string }).type,
        data: "data" in parsed ? (parsed as { data: unknown }).data : undefined,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Wrap a ServerWebSocket to provide type-safe send/publish
 */
function wrapWebSocket<TServerMsg, TUser>(
  ws: ServerWebSocket<WebSocketData<TUser>>,
): TypedWebSocket<TServerMsg, TUser> {
  return {
    raw: ws,
    data: ws.data,

    send(message: TServerMsg): void {
      if (typeof message === "object") {
        ws.send(JSON.stringify(message))
      } else {
        ws.send(message as unknown as string)
      }
    },

    publish(topic: string, message: TServerMsg): void {
      if (typeof message === "object") {
        ws.publish(topic, JSON.stringify(message))
      } else {
        ws.publish(topic, message as unknown as string)
      }
    },

    subscribe(topic: string): void {
      ws.subscribe(topic)
    },

    unsubscribe(topic: string): void {
      ws.unsubscribe(topic)
    },

    isSubscribed(topic: string): boolean {
      return ws.isSubscribed(topic)
    },

    getBufferedAmount(): number {
      return (ws.data.context.data.get("__bufferedAmount") as number) ?? 0
    },

    close(code?: number, reason?: string): void {
      ws.close(code, reason)
    },

    sendBinary(data: Buffer): void {
      ws.send(data)
    },
  }
}

/**
 * Handle WebSocket upgrade request
 * Returns a Response if upgrade failed or was rejected, undefined if upgrade succeeded
 * @param req - The incoming request
 * @param server - The Bun server instance
 * @param localRegistry - Optional local WebSocket route registry (uses global if not provided)
 */
export async function handleWebSocketUpgrade(
  req: Request,
  server: BunServer<WebSocketData<unknown>>,
  localRegistry?: WebSocketRouteRegistry,
): Promise<Response | undefined> {
  const url = new URL(req.url)
  const path = url.pathname

  // Use local registry if provided, otherwise fall back to global
  const registry = localRegistry ?? webSocketRouteRegistry

  // Find matching WebSocket route
  const matched = registry.match(path)
  if (!matched) {
    return undefined // No matching WebSocket route, let HTTP handle it
  }

  const { definition, params } = matched

  // Run authentication if configured
  let user: unknown
  if (definition.authFn) {
    try {
      user = await definition.authFn(req)
      if (user === null || user === undefined) {
        return new Response(
          JSON.stringify({
            message: "Unauthorized",
            code: "UNAUTHORIZED",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        )
      }
    } catch (error) {
      console.error("WebSocket auth error:", error)
      return new Response(
        JSON.stringify({
          message: "Authentication failed",
          code: "AUTH_ERROR",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  }

  // Create WebSocket context
  const context = createWebSocketContext(params, user)

  // Attempt upgrade - server.upgrade() returns true if successful
  // It also handles checking the upgrade header internally
  const success = server.upgrade(req, {
    data: {
      context,
      routePath: definition.path,
    } satisfies WebSocketData<unknown>,
  })

  if (!success) {
    return new Response(
      JSON.stringify({
        message: "WebSocket upgrade failed",
        code: "UPGRADE_FAILED",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    )
  }

  // Return undefined to indicate upgrade was handled
  return undefined
}

/**
 * Create Bun WebSocket handlers for the server
 * @param localRegistry - Optional local WebSocket route registry (uses global if not provided)
 */
export function createWebSocketHandlers(
  localRegistry?: WebSocketRouteRegistry,
): {
  open: (ws: ServerWebSocket<WebSocketData<unknown>>) => void
  message: (
    ws: ServerWebSocket<WebSocketData<unknown>>,
    message: string | Buffer,
  ) => void
  close: (
    ws: ServerWebSocket<WebSocketData<unknown>>,
    code: number,
    reason: string,
  ) => void
} {
  // Use local registry if provided, otherwise fall back to global
  const registry = localRegistry ?? webSocketRouteRegistry

  return {
    open(ws: ServerWebSocket<WebSocketData<unknown>>): void {
      const { context, routePath } = ws.data
      const matched = registry.match(routePath)
      if (!matched) return

      const { definition } = matched
      const typedWs = wrapWebSocket(ws)

      if (definition.connectHandler) {
        Promise.resolve(definition.connectHandler(typedWs, context)).catch(
          (error) => {
            console.error("WebSocket connect handler error:", error)
            if (definition.errorHandler) {
              definition.errorHandler(
                typedWs,
                error instanceof Error ? error : new Error(String(error)),
                context,
              )
            }
          },
        )
      }
    },

    message(
      ws: ServerWebSocket<WebSocketData<unknown>>,
      message: string | Buffer,
    ): void {
      const { context, routePath } = ws.data
      const matched = registry.match(routePath)
      if (!matched) return

      const { definition } = matched
      const typedWs = wrapWebSocket(ws)

      // Handle binary messages
      if (typeof message !== "string") {
        if (definition.binaryHandler) {
          Promise.resolve(
            definition.binaryHandler(typedWs, message as Buffer, context),
          ).catch((error) => {
            console.error("WebSocket binary handler error:", error)
            if (definition.errorHandler) {
              definition.errorHandler(
                typedWs,
                error instanceof Error ? error : new Error(String(error)),
                context,
              )
            }
          })
        }
        return
      }

      // Parse JSON message
      const parsed = parseMessage(message)
      if (!parsed) {
        if (definition.errorHandler) {
          definition.errorHandler(
            typedWs,
            new Error("Invalid message format. Expected: { type, data }"),
            context,
          )
        }
        return
      }

      // Find handler for this message type
      const handler = definition.messageHandlers.find(
        (h) => h.type === parsed.type,
      )
      if (!handler) {
        if (definition.errorHandler) {
          definition.errorHandler(
            typedWs,
            new Error(`Unknown message type: ${parsed.type}`),
            context,
          )
        }
        return
      }

      // Validate message data with Zod schema
      const validation = handler.schema.safeParse(parsed.data)
      if (!validation.success) {
        if (definition.errorHandler) {
          definition.errorHandler(
            typedWs,
            new Error(
              `Validation error for "${parsed.type}": ${validation.error.message}`,
            ),
            context,
          )
        }
        return
      }

      // Call the handler
      Promise.resolve(handler.handler(typedWs, validation.data, context)).catch(
        (error) => {
          console.error(`WebSocket handler error for "${parsed.type}":`, error)
          if (definition.errorHandler) {
            definition.errorHandler(
              typedWs,
              error instanceof Error ? error : new Error(String(error)),
              context,
            )
          }
        },
      )
    },

    close(
      ws: ServerWebSocket<WebSocketData<unknown>>,
      code: number,
      reason: string,
    ): void {
      const { context, routePath } = ws.data
      const matched = registry.match(routePath)
      if (!matched) return

      const { definition } = matched
      const typedWs = wrapWebSocket(ws)

      if (definition.closeHandler) {
        Promise.resolve(
          definition.closeHandler(typedWs, code, reason, context),
        ).catch((error) => {
          console.error("WebSocket close handler error:", error)
        })
      }
    },
  }
}

/**
 * Global WebSocket connection registry
 * Allows iterating and filtering all active connections
 */
class WebSocketConnectionRegistry {
  private connections: Set<ServerWebSocket<WebSocketData<unknown>>> = new Set()

  /**
   * Add a connection to the registry
   */
  public add(ws: ServerWebSocket<WebSocketData<unknown>>): void {
    this.connections.add(ws)
  }

  /**
   * Remove a connection from the registry
   */
  public remove(ws: ServerWebSocket<WebSocketData<unknown>>): void {
    this.connections.delete(ws)
  }

  /**
   * Get all active connections
   */
  public getAll(): ServerWebSocket<WebSocketData<unknown>>[] {
    return [...this.connections]
  }

  /**
   * Filter connections by predicate
   */
  public filter(
    predicate: (ws: ServerWebSocket<WebSocketData<unknown>>) => boolean,
  ): ServerWebSocket<WebSocketData<unknown>>[] {
    return this.getAll().filter(predicate)
  }

  /**
   * Broadcast a message to all connections
   */
  public broadcast(message: unknown): void {
    const serialized =
      typeof message === "object" ? JSON.stringify(message) : String(message)
    for (const ws of this.connections) {
      ws.send(serialized)
    }
  }

  /**
   * Broadcast binary data to all connections
   */
  public broadcastBinary(data: Buffer): void {
    for (const ws of this.connections) {
      ws.send(data)
    }
  }

  /**
   * Get the number of active connections
   */
  public get size(): number {
    return this.connections.size
  }

  /**
   * Clear all connections (useful for testing)
   */
  public clear(): void {
    this.connections.clear()
  }
}

// Global singleton instance
export const webSocketRegistry = new WebSocketConnectionRegistry()

/**
 * Create Bun WebSocket handlers with connection tracking
 * @param localRegistry - Optional local WebSocket route registry (uses global if not provided)
 */
export function createWebSocketHandlersWithRegistry(
  localRegistry?: WebSocketRouteRegistry,
): {
  open: (ws: ServerWebSocket<WebSocketData<unknown>>) => void
  message: (
    ws: ServerWebSocket<WebSocketData<unknown>>,
    message: string | Buffer,
  ) => void
  close: (
    ws: ServerWebSocket<WebSocketData<unknown>>,
    code: number,
    reason: string,
  ) => void
} {
  const baseHandlers = createWebSocketHandlers(localRegistry)

  return {
    open(ws: ServerWebSocket<WebSocketData<unknown>>): void {
      webSocketRegistry.add(ws)
      baseHandlers.open(ws)
    },

    message: baseHandlers.message,

    close(
      ws: ServerWebSocket<WebSocketData<unknown>>,
      code: number,
      reason: string,
    ): void {
      webSocketRegistry.remove(ws)
      baseHandlers.close(ws, code, reason)
    },
  }
}
