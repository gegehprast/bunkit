import { err, ok, type Result } from "@bunkit/result"
import { createCorsMiddleware } from "./core/cors"
import { generateOpenApiSpec } from "./http/openapi/generator"
import { handleRequest } from "./http/request-handler"
import type { RouteRegistry } from "./http/route-registry"
import type { MiddlewareFn } from "./types/middleware"
import type {
  Server as IServer,
  OpenApiSpec,
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
import {
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
        `Server started at http://${this.host}:${this.port}`,
        this.localWsRouteRegistry?.getAll()[0]?.path,
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
  }

  public async stop(): Promise<Result<void, ServerStopError>> {
    try {
      if (this.server) {
        this.server.stop()
        this.server = null
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
  }

  public readonly http = {
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
  }

  public readonly ws = {
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

    generateWebSocketTypes: async (
      options: GenerateWebSocketTypesOptions,
    ): Promise<Result<void, Error>> => {
      return generateWebSocketTypes(options, this.localWsRouteRegistry)
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
