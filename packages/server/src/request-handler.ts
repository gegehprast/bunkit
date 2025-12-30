import { createPreflightResponse } from "./cors"
import { createMiddlewareArgs, executeMiddlewareChain } from "./middleware"
import { createResponseHelpers } from "./response-helpers"
import { routeRegistry } from "./route-registry"
import type { MiddlewareFn } from "./types/middleware"
import type { HttpMethod } from "./types/route"
import type { ServerOptions } from "./types/server"
import { parseBody, parseQueryParams, validateSchema } from "./validation"

/**
 * Handle incoming HTTP requests
 */
export async function handleRequest(
  request: Request,
  globalMiddlewares: MiddlewareFn[],
  serverOptions: ServerOptions,
): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method as HttpMethod

  // Handle OPTIONS requests (CORS preflight) before route matching
  // This allows CORS middleware to respond even if no route is defined
  if (method === "OPTIONS" && serverOptions.cors) {
    const origin = request.headers.get("origin")
    return createPreflightResponse(origin, serverOptions.cors)
  }

  // Find matching route
  const match = routeRegistry.match(method, url.pathname)

  if (!match) {
    return new Response(
      JSON.stringify({ message: "Not Found", code: "ROUTE_NOT_FOUND" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    )
  }

  const { definition, params } = match

  // Parse query parameters
  const queryParams = parseQueryParams(url)

  // Parse request body
  const bodyResult = await parseBody(request)
  if (bodyResult.isErr()) {
    return new Response(
      JSON.stringify({
        message: "Failed to parse request body",
        code: "BODY_PARSE_ERROR",
        details: bodyResult.error.message,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    )
  }

  let query: unknown = queryParams
  let body: unknown = bodyResult.value

  // Validate query if schema is defined
  if (definition.querySchema) {
    const queryResult = validateSchema(definition.querySchema, queryParams)
    if (queryResult.isErr()) {
      return new Response(
        JSON.stringify({
          message: "Query validation failed",
          code: "QUERY_VALIDATION_ERROR",
          details: queryResult.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
    query = queryResult.value
  }

  // Validate body if schema is defined
  if (definition.bodySchema) {
    const bodyValidationResult = validateSchema(definition.bodySchema, body)
    if (bodyValidationResult.isErr()) {
      return new Response(
        JSON.stringify({
          message: "Body validation failed",
          code: "BODY_VALIDATION_ERROR",
          details: bodyValidationResult.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
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
      return new Response(
        JSON.stringify({
          message: "Internal Server Error",
          code: "HANDLER_ERROR",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
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
