import type { Result } from "@bunkit/result"
import type { RouteRegistry } from "../http/route-registry"
import type { SecuritySchemeObject } from "../openapi/security-schemes"
import type { WebSocketRouteRegistry } from "../websocket/websocket-registry"
import type { GenerateWebSocketTypesOptions } from "../websocket/websocket-type-generator"
import type { CorsOptions } from "./cors"
import type { MiddlewareFn } from "./middleware"

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
  openapi?: {
    title?: string
    version?: string
    description?: string
    securitySchemes?: Record<string, SecuritySchemeObject>
  }
  /** WebSocket configuration */
  websocket?: WebSocketOptions
}

/**
 * OpenAPI specification
 */
export interface OpenApiSpec {
  openapi: string
  info: {
    title: string
    version: string
  }
  paths: Record<string, unknown>
  components?: Record<string, unknown>
}

/**
 * Server instance interface
 */
export interface Server {
  start(): Promise<Result<void, ServerError>>
  stop(): Promise<Result<void, ServerError>>
  getOpenApiSpec(): Promise<Result<OpenApiSpec, Error>>
  exportOpenApiSpec(path: string): Promise<Result<void, Error>>
  /** Publish a message to all WebSocket subscribers of a topic */
  publish(topic: string, message: unknown): void
  /** Publish binary data to all WebSocket subscribers of a topic */
  publishBinary(topic: string, data: Buffer): void
  /** Generate TypeScript types for WebSocket routes */
  generateWebSocketTypes(
    options: GenerateWebSocketTypesOptions,
  ): Promise<Result<void, Error>>
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
