import type { Result } from "@bunkit/result"
import type { GenerateOpenApiSpecOptions } from "../http/openapi/generator"
import type { RouteRegistry } from "../http/route-registry"
import type { HttpMethod } from "../http/types/route"
import type { CorsOptions } from "../types/cors"
import type { MiddlewareFn } from "../types/middleware"
import type { WebSocketRouteRegistry } from "../websocket/websocket-registry"
import type { GenerateWebSocketTypesOptions } from "../websocket/websocket-type-generator"

/**
 * WebSocket server configuration
 */
export interface WebSocketOptions {
  /** Maximum payload length in bytes (default: 16MB) */
  maxPayloadLength?: number
  /** Idle timeout in seconds (default: 120) */
  idleTimeout?: number
  /** Enable per-message deflate compression (default: true) */
  compression?: boolean
  /** Backpressure limit in bytes (default: 16MB) */
  backpressureLimit?: number
}

/**
 * Server configuration options
 */
export interface ServerOptions {
  port?: number
  host?: string
  development?: boolean
  cors?: CorsOptions
  static?: Record<string, string>
  globalMiddlewares?: MiddlewareFn[]
  openapi?: Partial<GenerateOpenApiSpecOptions>
  /** WebSocket configuration */
  websocket?: WebSocketOptions
}

/**
 * OpenAPI operation object
 */
export interface OpenApiOperation {
  operationId?: string
  tags?: string[]
  summary?: string
  description?: string
  parameters?: Array<{
    name: string
    in: string
    required?: boolean
    schema?: unknown
  }>
  requestBody?: {
    required?: boolean
    content?: Record<string, { schema?: unknown }>
  }
  responses?: Record<string, unknown>
  security?: Array<Record<string, string[]>>
}

/**
 * OpenAPI path item object
 */
export interface OpenApiPathItem {
  get?: OpenApiOperation
  post?: OpenApiOperation
  put?: OpenApiOperation
  patch?: OpenApiOperation
  delete?: OpenApiOperation
  options?: OpenApiOperation
  head?: OpenApiOperation
}

/**
 * OpenAPI specification
 */
export interface OpenApiSpec {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  paths: Record<string, OpenApiPathItem>
  components?: Record<string, unknown>
}

/**
 * Route information for inspection
 */
export interface RouteInfo {
  /** HTTP method */
  method: HttpMethod
  /** Route path pattern (with :param syntax) */
  path: string
  /** Operation ID from OpenAPI metadata */
  operationId?: string
  /** Route tags */
  tags?: string[]
  /** Route summary */
  summary?: string
  /** Route description */
  description?: string
  /** Whether the route requires authentication */
  requiresAuth: boolean
  /** Whether the route has query parameters */
  hasQueryParams: boolean
  /** Whether the route has request body */
  hasRequestBody: boolean
}

/**
 * WebSocket route information for inspection
 */
export interface WebSocketRouteInfo {
  /** Route path pattern (with :param syntax) */
  path: string
  /** Message types handled by this route */
  messageTypes: string[]
  /** Whether the route requires authentication */
  requiresAuth: boolean
  /** Whether the route has binary message handler */
  hasBinaryHandler: boolean
  /** Whether the route has connection handler */
  hasConnectHandler: boolean
  /** Whether the route has close handler */
  hasCloseHandler: boolean
  /** Whether the route has error handler */
  hasErrorHandler: boolean
}

/**
 * HTTP-related methods for the server instance
 */
interface ServerHttpMethods {
  /**
   * Get the OpenAPI specification for this server
   */
  getOpenApiSpec(): Promise<Result<OpenApiSpec, Error>>
  /**
   * Export the OpenAPI specification to a JSON file
   */
  exportOpenApiSpec(path: string): Promise<Result<void, Error>>
  /**
   * Get all registered HTTP routes for inspection
   */
  getRoutes(): Result<RouteInfo[], Error>
}

/**
 * WebSocket-related methods for the server instance
 */
interface ServerWebSocketMethods {
  /**
   * Publish a message to all WebSocket subscribers of a topic
   */
  publish(topic: string, message: unknown): void
  /**
   * Publish binary data to all WebSocket subscribers of a topic
   */
  publishBinary(topic: string, data: Buffer): void
  /**
   * Get WebSocket types for this server
   */
  getWebSocketTypes(
    options: GenerateWebSocketTypesOptions,
  ): Promise<Result<void, Error>>
  /**
   * Get all registered WebSocket routes for inspection
   */
  getRoutes(): Result<WebSocketRouteInfo[], Error>
}

/**
 * Server instance interface
 */
export interface Server {
  /**
   * Start the server
   */
  start(): Promise<Result<void, ServerError>>
  /**
   * Stop the server
   */
  stop(): Promise<Result<void, ServerError>>
  /**
   * HTTP-related methods
   */
  http: ServerHttpMethods
  /**
   * WebSocket-related methods
   */
  ws: ServerWebSocketMethods
  /**
   * Internal: Local route registry for this server instance
   * Created lazily when a route is registered to this server
   * @internal
   */
  _routeRegistry?: RouteRegistry
  /**
   * Internal: Local WebSocket route registry for this server instance
   * Created lazily when a WebSocket route is registered to this server
   * @internal
   */
  _wsRouteRegistry?: WebSocketRouteRegistry
}

/**
 * Server error types
 */
export class ServerError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = "ServerError"
  }
}

export class ServerStartError extends ServerError {
  public constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(message, "SERVER_START_ERROR")
    this.name = "ServerStartError"
  }
}

export class ServerStopError extends ServerError {
  public constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(message, "SERVER_STOP_ERROR")
    this.name = "ServerStopError"
  }
}
