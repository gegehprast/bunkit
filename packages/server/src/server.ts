import { err, ok, type Result } from "@bunkit/result"
import { createCorsMiddleware } from "./core/cors"
import { generateOpenApiSpec } from "./http/openapi/generator"
import { handleRequest } from "./http/request-handler"
import type { RouteRegistry } from "./http/route-registry"
import type { MiddlewareFn } from "./types/middleware"
import type {
  OpenApiSpec,
  Server,
  ServerOptions,
  ServerStartError,
  ServerStopError,
} from "./types/server"
import type { WebSocketData } from "./websocket/types/websocket"
import {
  createWebSocketHandlersWithRegistry,
  handleWebSocketUpgrade,
} from "./websocket/websocket-handler"
import type { WebSocketRouteRegistry } from "./websocket/websocket-registry"
import { generateWebSocketTypes } from "./websocket/websocket-type-generator"

/**
 * Create a new HTTP server with optional WebSocket support
 */
export function createServer(options: ServerOptions = {}): Server {
  const {
    port = 3000,
    host = "0.0.0.0",
    development = false,
    cors,
    globalMiddlewares = [],
    openapi = {},
    websocket = {},
  } = options

  // WebSocket configuration with defaults
  const wsConfig = {
    maxPayloadLength: websocket.maxPayloadLength ?? 16 * 1024 * 1024, // 16MB
    idleTimeout: websocket.idleTimeout ?? 120, // 2 minutes
    perMessageDeflate: websocket.compression ?? true,
    backpressureLimit: websocket.backpressureLimit ?? 16 * 1024 * 1024, // 16MB
  }

  let server: ReturnType<typeof Bun.serve> | null = null

  // Local route registry - created lazily when routes are registered to this server
  let localRouteRegistry: RouteRegistry | undefined

  // Local WebSocket route registry - created lazily when WS routes are registered to this server
  let localWsRouteRegistry: WebSocketRouteRegistry | undefined

  // Build middleware chain with CORS if enabled
  const middlewares: MiddlewareFn[] = []

  if (cors) {
    const corsMiddleware = createCorsMiddleware(cors)
    middlewares.push(corsMiddleware)
  }

  middlewares.push(...globalMiddlewares)

  // WebSocket handlers will use the local registry if available
  // We need to create them as a factory that receives the registry getter
  const getWsRegistry = () => localWsRouteRegistry

  const serverInstance: Server = {
    // Expose the local registry for route registration
    get _routeRegistry(): RouteRegistry | undefined {
      return localRouteRegistry
    },
    set _routeRegistry(registry: RouteRegistry | undefined) {
      localRouteRegistry = registry
    },

    // Expose the local WebSocket registry for route registration
    get _wsRouteRegistry(): WebSocketRouteRegistry | undefined {
      return localWsRouteRegistry
    },
    set _wsRouteRegistry(registry: WebSocketRouteRegistry | undefined) {
      localWsRouteRegistry = registry
    },

    async start(): Promise<Result<void, ServerStartError>> {
      try {
        // Create WebSocket handlers with the current registry state
        const wsHandlers = createWebSocketHandlersWithRegistry(getWsRegistry())

        server = Bun.serve<WebSocketData<unknown>>({
          port,
          hostname: host,
          development,
          async fetch(request: Request, bunServer): Promise<Response> {
            // Check for WebSocket upgrade first, passing local WS registry
            const wsResponse = await handleWebSocketUpgrade(
              request,
              bunServer,
              getWsRegistry(),
            )
            if (wsResponse !== undefined) {
              return wsResponse
            }
            // Handle as regular HTTP request, passing local registry if available
            return handleRequest(
              request,
              middlewares,
              options,
              localRouteRegistry,
            )
          },
          websocket: {
            ...wsConfig,
            open: wsHandlers.open,
            message: wsHandlers.message,
            close: wsHandlers.close,
          },
          error(error: Error): Response {
            console.error("Server error:", error)
            return new Response(
              JSON.stringify({
                message: "Internal Server Error",
                code: "SERVER_ERROR",
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            )
          },
        })

        console.log(
          `Server started at http://${host}:${port}`,
          getWsRegistry()?.getAll()[0]?.path,
        )

        return ok(undefined)
      } catch (error) {
        return err({
          name: "ServerStartError",
          message: `Failed to start server: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "SERVER_START_ERROR",
          cause: error instanceof Error ? error : undefined,
        } as ServerStartError)
      }
    },

    async stop(): Promise<Result<void, ServerStopError>> {
      try {
        if (server) {
          server.stop()
          server = null
        }
        return ok(undefined)
      } catch (error) {
        return err({
          name: "ServerStopError",
          message: `Failed to stop server: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "SERVER_STOP_ERROR",
          cause: error instanceof Error ? error : undefined,
        } as ServerStopError)
      }
    },

    http: {
      async getOpenApiSpec(): Promise<Result<OpenApiSpec, Error>> {
        return generateOpenApiSpec(
          {
            title: openapi.title ?? "API",
            version: openapi.version ?? "1.0.0",
            description: openapi.description,
            securitySchemes: openapi.securitySchemes,
            servers: openapi.servers,
          },
          localRouteRegistry,
        )
      },

      async exportOpenApiSpec(path: string): Promise<Result<void, Error>> {
        try {
          const specResult = await serverInstance.http.getOpenApiSpec()
          if (specResult.isErr()) {
            return err(specResult.error)
          }
          await Bun.write(path, JSON.stringify(specResult.value, null, 2))
          return ok(undefined)
        } catch (error) {
          return err(
            error instanceof Error
              ? error
              : new Error("Failed to export OpenAPI spec"),
          )
        }
      },
    },

    ws: {
      publish(topic: string, message: unknown): void {
        if (!server) {
          console.warn("Cannot publish: server not started")
          return
        }
        const serialized =
          typeof message === "object"
            ? JSON.stringify(message)
            : String(message)
        server.publish(topic, serialized)
      },

      publishBinary(topic: string, data: Buffer): void {
        if (!server) {
          console.warn("Cannot publish: server not started")
          return
        }
        server.publish(topic, data)
      },

      async generateWebSocketTypes(options): Promise<Result<void, Error>> {
        return generateWebSocketTypes(options, localWsRouteRegistry)
      },
    },
  }

  return serverInstance
}
