import type { CorsOptions } from "../types/cors"
import type { MiddlewareFn } from "../types/middleware"

/**
 * Create CORS middleware
 */
export function createCorsMiddleware(options: CorsOptions): MiddlewareFn {
  return async (context) => {
    const { req } = context
    const origin = req.headers.get("origin")

    // Same-origin requests aren't cross-origin: never block them. Browsers
    // send an Origin header for e.g. <script type="module" crossorigin>, so
    // without this an app served from an address missing in the allow-list
    // (a LAN or VPN IP) can't load its own assets.
    if (origin && isSameOrigin(origin, req)) {
      return context.next()
    }

    // Check if origin is allowed
    if (origin && !isOriginAllowed(origin, options.origin)) {
      return new Response("CORS: Origin not allowed", { status: 403 })
    }

    // Handle OPTIONS preflight request
    if (req.method === "OPTIONS") {
      return createPreflightResponse(origin, options)
    }

    // Continue to next middleware/handler
    const response = await context.next()

    // Add CORS headers to response
    if (response && origin) {
      addCorsHeaders(response, origin, options)
    }

    return response
  }
}

/**
 * True when the Origin header points at the host the request was sent to.
 * Uses the Host header so it also holds behind proxies that preserve it.
 */
export function isSameOrigin(origin: string, req: Request): boolean {
  try {
    const host = req.headers.get("host") ?? new URL(req.url).host
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(
  origin: string,
  allowedOrigin?: string | string[] | ((origin: string) => boolean),
): boolean {
  if (!allowedOrigin) {
    return true // Allow all origins if not specified
  }

  if (typeof allowedOrigin === "function") {
    return allowedOrigin(origin)
  }

  if (typeof allowedOrigin === "string") {
    return allowedOrigin === "*" || allowedOrigin === origin
  }

  return allowedOrigin.includes(origin)
}

/**
 * Create preflight response for OPTIONS requests
 */
export function createPreflightResponse(
  origin: string | null,
  options: CorsOptions,
): Response {
  const headers: Record<string, string> = {}

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin
  }

  if (options.methods) {
    headers["Access-Control-Allow-Methods"] = options.methods.join(", ")
  } else {
    headers["Access-Control-Allow-Methods"] =
      "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS"
  }

  if (options.allowedHeaders) {
    headers["Access-Control-Allow-Headers"] = options.allowedHeaders.join(", ")
  } else {
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
  }

  if (options.credentials) {
    headers["Access-Control-Allow-Credentials"] = "true"
  }

  if (options.maxAge !== undefined) {
    headers["Access-Control-Max-Age"] = options.maxAge.toString()
  }

  return new Response(null, { status: 204, headers })
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(
  response: Response,
  origin: string,
  options: CorsOptions,
): void {
  response.headers.set("Access-Control-Allow-Origin", origin)

  if (options.exposedHeaders) {
    response.headers.set(
      "Access-Control-Expose-Headers",
      options.exposedHeaders.join(", "),
    )
  }

  if (options.credentials) {
    response.headers.set("Access-Control-Allow-Credentials", "true")
  }
}
