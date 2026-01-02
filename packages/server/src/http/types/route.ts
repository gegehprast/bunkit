import type { MakeRequired } from "node_modules/zod/v4/core/util"
import type { z } from "zod"
import type { MiddlewareFn } from "../../types/middleware"
import type { RouteContext } from "./context"

/**
 * Extract path parameters from a route path string
 * Example: "/users/:userId/posts/:postId" -> { userId: string, postId: string }
 */
export type ExtractParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParams<`/${Rest}`>]: string }
    : T extends `${infer _Start}:${infer Param}`
      ? { [K in Param]: string }
      : Record<string, never>

/**
 * HTTP methods supported by the server
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"

/**
 * Route metadata for OpenAPI generation
 */
export interface RouteMetadata {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
}

/**
 * Response configuration for a route
 */
export interface ResponseConfig {
  status: number
  description?: string
  content?: Record<string, { schema?: z.ZodType }>
}

/**
 * Error Response configuration for a route
 */
export type ErrorResponseConfig = Record<
  number,
  {
    description?: string
    content?: Record<string, { schema?: z.ZodType }>
  }
>

/**
 * Internal route definition stored in the registry
 */
export interface RouteDefinition {
  method: HttpMethod
  path: string
  metadata?: RouteMetadata
  querySchema?: z.ZodType
  bodySchema?: z.ZodType
  response?: MakeRequired<ResponseConfig, "content">
  errorResponses?: ErrorResponseConfig
  middlewares?: MiddlewareFn[]
  security?: Array<Record<string, string[]>>
  handler: (
    context: RouteContext<Record<string, string>, unknown, unknown, unknown>,
  ) => Promise<Response> | Response
}

/**
 * Matched route with extracted parameters
 */
export interface MatchedRoute {
  definition: RouteDefinition
  params: Record<string, string>
}
