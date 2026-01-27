import { err, ok, type Result } from "@bunkit/result"
import { createCorsMiddleware } from "./core/cors"
import { generateOpenApiSpec } from "./http/openapi/generator"
import { handleRequest } from "./http/request-handler"
import { type RouteRegistry, routeRegistry } from "./http/route-registry"
import type { MiddlewareFn } from "./types/middleware"
import {
  type Server as IServer,
  type OpenApiSpec,
  type RouteInfo,
  type ServerOptions,
  ServerStartError,
  ServerStopError,
  type WebSocketRouteInfo,
} from "./types/server"
import type { WebSocketData } from "./websocket/types/websocket"
import {
  createWebSocketHandlersWithRegistry,
  handleWebSocketUpgrade,
} from "./websocket/websocket-handler"
import {
  type WebSocketRouteRegistry,
  webSocketRouteRegistry,
} from "./websocket/websocket-registry"
import {
  type ExportWebSocketTypesOptions,
  type GenerateWebSocketTypesOptions,
  generateWebSocketTypes,
} from "./websocket/websocket-type-generator"

/**
 * HTTP server with optional WebSocket support
 */
export class Server implements IServer {
  private readonly port: number
  private readonly host: string
  private readonly development: boolean
  private readonly wsConfig: {
    maxPayloadLength: number
    idleTimeout: number
    perMessageDeflate: boolean
    backpressureLimit: number
  }
  private readonly middlewares: MiddlewareFn[]
  private readonly options: ServerOptions

  private server: ReturnType<typeof Bun.serve> | null = null
  private localRouteRegistry: RouteRegistry | undefined
  private localWsRouteRegistry: WebSocketRouteRegistry | undefined

  public constructor(options: ServerOptions = {}) {
    const {
      port = 3000,
      host = "0.0.0.0",
      development = false,
      cors,
      globalMiddlewares = [],
      websocket = {},
    } = options

    this.port = port
    this.host = host
    this.development = development
    this.options = options

    // WebSocket configuration with defaults
    this.wsConfig = {
      maxPayloadLength: websocket.maxPayloadLength ?? 16 * 1024 * 1024, // 16MB
      idleTimeout: websocket.idleTimeout ?? 120, // 2 minutes
      perMessageDeflate: websocket.compression ?? true,
      backpressureLimit: websocket.backpressureLimit ?? 16 * 1024 * 1024, // 16MB
    }

    // Build middleware chain with CORS if enabled
    this.middlewares = []

    if (cors) {
      const corsMiddleware = createCorsMiddleware(cors)
      this.middlewares.push(corsMiddleware)
    }

    this.middlewares.push(...globalMiddlewares)
  }

  // Expose the local registry for route registration
  public get _routeRegistry(): RouteRegistry | undefined {
    return this.localRouteRegistry
  }

  public set _routeRegistry(registry: RouteRegistry | undefined) {
    this.localRouteRegistry = registry
  }

  // Expose the local WebSocket registry for route registration
  public get _wsRouteRegistry(): WebSocketRouteRegistry | undefined {
    return this.localWsRouteRegistry
  }

  public set _wsRouteRegistry(registry: WebSocketRouteRegistry | undefined) {
    this.localWsRouteRegistry = registry
  }

  public async start(): Promise<Result<void, ServerStartError>> {
    try {
      // Create WebSocket handlers with the current registry state
      const wsHandlers = createWebSocketHandlersWithRegistry(
        this.localWsRouteRegistry,
      )

      this.server = Bun.serve<WebSocketData<unknown>>({
        port: this.port,
        hostname: this.host,
        development: this.development,
        fetch: async (request: Request, bunServer): Promise<Response> => {
          // Check for WebSocket upgrade first, passing local WS registry
          const wsResponse = await handleWebSocketUpgrade(
            request,
            bunServer,
            this.localWsRouteRegistry,
          )
          if (wsResponse !== undefined) {
            return wsResponse
          }
          // Handle as regular HTTP request, passing local registry if available
          return handleRequest(
            request,
            this.middlewares,
            this.options,
            this.localRouteRegistry,
          )
        },
        websocket: {
          ...this.wsConfig,
          open: wsHandlers.open,
          message: wsHandlers.message,
          close: wsHandlers.close,
        },
        error: (error: Error): Response => {
          console.error("Server error:", error)
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          }
          return new Response(
            JSON.stringify({
              message: "Internal Server Error",
              code: "SERVER_ERROR",
            }),
            {
              status: 500,
              headers,
            },
          )
        },
      })

      return ok(undefined)
    } catch (error) {
      return err(
        new ServerStartError(
          `Failed to start server: ${error instanceof Error ? error.message : "Unknown error"}`,
          error instanceof Error ? error : undefined,
        ),
      )
    }
  }

  public async stop(): Promise<Result<void, ServerStopError>> {
    try {
      if (this.server) {
        this.server.stop()
        this.server = null
      }
      return ok(undefined)
    } catch (error) {
      return err(
        new ServerStopError(
          `Failed to stop server: ${error instanceof Error ? error.message : "Unknown error"}`,
          error instanceof Error ? error : undefined,
        ),
      )
    }
  }

  public readonly http: IServer["http"] = {
    getOpenApiSpec: async (): Promise<Result<OpenApiSpec, Error>> => {
      return generateOpenApiSpec(
        {
          title: this.options.openapi?.title ?? "API",
          version: this.options.openapi?.version ?? "1.0.0",
          description: this.options.openapi?.description ?? "",
          securitySchemes: this.options.openapi?.securitySchemes ?? {},
          servers: this.options.openapi?.servers ?? [],
        },
        this.localRouteRegistry,
      )
    },

    exportOpenApiSpec: async (path: string): Promise<Result<void, Error>> => {
      try {
        const specResult = await this.http.getOpenApiSpec()
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

    getRoutes: (): Result<RouteInfo[], Error> => {
      try {
        // Get routes from local registry if available, otherwise global
        const registry = this.localRouteRegistry ?? routeRegistry
        const routes = registry.getAll()

        const routeInfos: RouteInfo[] = routes.map((route) => ({
          method: route.method,
          path: route.path,
          operationId: route.metadata?.operationId,
          tags: route.metadata?.tags,
          summary: route.metadata?.summary,
          description: route.metadata?.description,
          requiresAuth: Boolean(route.security && route.security.length > 0),
          hasQueryParams: Boolean(route.querySchema),
          hasRequestBody: Boolean(route.bodySchema),
        }))

        return ok(routeInfos)
      } catch (error) {
        return err(
          error instanceof Error ? error : new Error("Failed to get routes"),
        )
      }
    },
  }

  public readonly ws: IServer["ws"] = {
    publish: (topic: string, message: unknown): void => {
      if (!this.server) {
        console.warn("Cannot publish: server not started")
        return
      }
      const serialized =
        typeof message === "object" ? JSON.stringify(message) : String(message)
      this.server.publish(topic, serialized)
    },

    publishBinary: (topic: string, data: Buffer): void => {
      if (!this.server) {
        console.warn("Cannot publish: server not started")
        return
      }
      this.server.publish(topic, data)
    },

    getWebSocketTypes: async (
      options: GenerateWebSocketTypesOptions,
    ): Promise<Result<string, Error>> => {
      return generateWebSocketTypes(options, this.localWsRouteRegistry)
    },

    exportWebSocketTypes: async (
      options: ExportWebSocketTypesOptions,
    ): Promise<Result<void, Error>> => {
      try {
        const typesResult = await this.ws.getWebSocketTypes(options)
        if (typesResult.isErr()) {
          return err(typesResult.error)
        }
        await Bun.write(options.outputPath, typesResult.value)
        return ok(undefined)
      } catch (error) {
        return err(
          error instanceof Error
            ? error
            : new Error("Failed to export WebSocket types"),
        )
      }
    },

    getRoutes: (): Result<WebSocketRouteInfo[], Error> => {
      try {
        // Get routes from local registry if available, otherwise global
        const registry = this.localWsRouteRegistry ?? webSocketRouteRegistry
        const routes = registry.getAll()

        const routeInfos: WebSocketRouteInfo[] = routes.map((route) => ({
          path: route.path,
          messageTypes: route.messageHandlers.map((handler) => handler.type),
          requiresAuth: Boolean(route.authFn),
          hasBinaryHandler: Boolean(route.binaryHandler),
          hasConnectHandler: Boolean(route.connectHandler),
          hasCloseHandler: Boolean(route.closeHandler),
          hasErrorHandler: Boolean(route.errorHandler),
        }))

        return ok(routeInfos)
      } catch (error) {
        return err(
          error instanceof Error
            ? error
            : new Error("Failed to get WebSocket routes"),
        )
      }
    },
  }
}

/**
 * Create a new HTTP server with optional WebSocket support
 * @param options Server configuration options
 * @returns Server instance
 */
export function createServer(options: ServerOptions = {}): Server {
  return new Server(options)
}
