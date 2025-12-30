import type { Result } from "@bunkit/result"
import type { SecuritySchemeObject } from "../openapi/security-schemes"
import type { CorsOptions } from "./cors"
import type { MiddlewareFn } from "./middleware"

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
  getOpenApiSpec(): Promise<OpenApiSpec>
  exportOpenApiSpec(path: string): Promise<Result<void, Error>>
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
