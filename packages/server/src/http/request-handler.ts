import { createPreflightResponse } from "../core/cors"
import {
  createMiddlewareArgs,
  executeMiddlewareChain,
} from "../core/middleware"
import { ErrorCode } from "../core/standard-errors"
import { parseBody, parseQueryParams, validateSchema } from "../core/validation"
import type { MiddlewareFn } from "../types/middleware"
import type { ServerOptions } from "../types/server"
import { badRequest, createResponseHelpers, notFound } from "./response-helpers"
import { type RouteRegistry, routeRegistry } from "./route-registry"
import type { HttpMethod } from "./types/route"

/**
 * Handle incoming HTTP requests
 * @param request - The incoming request
 * @param globalMiddlewares - Global middleware functions
 * @param serverOptions - Server configuration options
 * @param localRegistry - Optional local route registry (uses global if not provided)
 */
export async function handleRequest(
  request: Request,
  globalMiddlewares: MiddlewareFn[],
  serverOptions: ServerOptions,
  localRegistry?: RouteRegistry,
): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method as HttpMethod

  // Handle OPTIONS requests (CORS preflight) before route matching
  // This allows CORS middleware to respond even if no route is defined
  if (method === "OPTIONS" && serverOptions.cors) {
    const origin = request.headers.get("origin")
    return createPreflightResponse(origin, serverOptions.cors)
  }

  // Use local registry if provided, otherwise fall back to global
  const registry = localRegistry ?? routeRegistry

  // Find matching route
  const match = registry.match(method, url.pathname)

  if (!match) {
    return notFound("Route not found", ErrorCode.NOT_FOUND)
  }

  const { definition, params } = match

  // Parse query parameters
  const queryParams = parseQueryParams(url)

  // Parse request body
  const bodyResult = await parseBody(request)
  if (bodyResult.isErr()) {
    return badRequest(
      "Failed to parse request body",
      ErrorCode.BAD_REQUEST,
      bodyResult.error.message,
    )
  }

  let query: unknown = queryParams
  let body: unknown = bodyResult.value

  // Validate query if schema is defined
  if (definition.querySchema) {
    const queryResult = validateSchema(definition.querySchema, queryParams)
    if (queryResult.isErr()) {
      return badRequest(
        "Query validation failed",
        ErrorCode.BAD_REQUEST,
        queryResult.error.issues,
      )
    }
    query = queryResult.value
  }

  // Validate body if schema is defined
  if (definition.bodySchema) {
    const bodyValidationResult = validateSchema(definition.bodySchema, body)
    if (bodyValidationResult.isErr()) {
      return badRequest(
        "Body validation failed",
        ErrorCode.BAD_REQUEST,
        bodyValidationResult.error.issues,
      )
    }
    body = bodyValidationResult.value
  }

  // Create response helpers
  const res = createResponseHelpers()

  // Create context object
  const ctx: Record<string, unknown> = {}

  // Combine global and route middlewares
  const allMiddlewares = [
    ...globalMiddlewares,
    ...(definition.middlewares ?? []),
  ]

  // Create the handler wrapper that will be the final step in the chain
  const handlerFn = async (): Promise<Response> => {
    try {
      const response = await definition.handler({
        req: request,
        res,
        params,
        query,
        body,
        ctx,
      })
      return response
    } catch (error) {
      console.error("Handler error:", error)
      return res.internalError(
        "Internal Server Error",
        ErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Unknown error",
      )
    }
  }

  // Execute middleware chain with handler
  if (allMiddlewares.length > 0) {
    const middlewareArgs = createMiddlewareArgs(
      request,
      params,
      query,
      body,
      ctx,
      res,
    )

    const response = await executeMiddlewareChain(
      allMiddlewares,
      middlewareArgs,
      handlerFn,
    )

    return response
  }

  // No middlewares, execute handler directly
  return handlerFn()
}
