/**
 * WebSocket Authentication Utilities
 *
 * Provides helper functions for extracting authentication tokens from
 * WebSocket upgrade requests, supporting both Bearer token (header) and
 * query parameter authentication patterns.
 */

/**
 * Options for token extraction
 */
export interface TokenExtractionOptions {
  /** Header name for Bearer token (default: "authorization") */
  headerName?: string
  /** Query parameter name for token (default: "token") */
  queryParamName?: string
  /** Whether to check header (default: true) */
  checkHeader?: boolean
  /** Whether to check query params (default: true) */
  checkQuery?: boolean
}

/**
 * Result of token extraction
 */
export interface ExtractedToken {
  /** The extracted token value */
  token: string
  /** Where the token was found */
  source: "header" | "query"
}

/**
 * Extract a Bearer token from the Authorization header
 * @param req - The request object
 * @param headerName - Header name to check (default: "authorization")
 * @returns The token string or null if not found
 */
export function extractBearerToken(
  req: Request,
  headerName = "authorization",
): string | null {
  const authHeader = req.headers.get(headerName)
  if (!authHeader) {
    return null
  }

  // Support both "Bearer <token>" and raw token
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }

  // Also check for lowercase "bearer "
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7)
  }

  return null
}

/**
 * Extract a token from URL query parameters
 * @param req - The request object
 * @param paramName - Query parameter name (default: "token")
 * @returns The token string or null if not found
 */
export function extractQueryToken(
  req: Request,
  paramName = "token",
): string | null {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get(paramName)
    return token || null
  } catch {
    return null
  }
}

/**
 * Extract authentication token from request (checks header first, then query params)
 * @param req - The request object
 * @param options - Extraction options
 * @returns ExtractedToken with token and source, or null if not found
 *
 * @example
 * ```typescript
 * // Default behavior: check Authorization header, then ?token query param
 * const token = extractToken(req)
 *
 * // Custom query param name
 * const token = extractToken(req, { queryParamName: "auth" })
 *
 * // Only check query params (useful for WebSocket clients that can't set headers)
 * const token = extractToken(req, { checkHeader: false })
 * ```
 */
export function extractToken(
  req: Request,
  options: TokenExtractionOptions = {},
): ExtractedToken | null {
  const {
    headerName = "authorization",
    queryParamName = "token",
    checkHeader = true,
    checkQuery = true,
  } = options

  // Check header first (more secure)
  if (checkHeader) {
    const headerToken = extractBearerToken(req, headerName)
    if (headerToken) {
      return { token: headerToken, source: "header" }
    }
  }

  // Fall back to query parameter (useful for WebSocket which may not support custom headers)
  if (checkQuery) {
    const queryToken = extractQueryToken(req, queryParamName)
    if (queryToken) {
      return { token: queryToken, source: "query" }
    }
  }

  return null
}

/**
 * Create a WebSocket authentication function from a token verification function
 *
 * This helper makes it easy to create WebSocket auth from existing JWT/token
 * verification logic, with support for both header and query parameter tokens.
 *
 * @param verifyToken - Function that verifies a token and returns user data (or throws/returns null on failure)
 * @param options - Token extraction options
 * @returns WebSocketAuthFn that can be used with .authenticate()
 *
 * @example
 * ```typescript
 * // Using with existing JWT verification
 * import { verifyJWT } from "./auth"
 *
 * const wsAuth = createTokenAuth(async (token) => {
 *   const payload = await verifyJWT(token)
 *   return { id: payload.sub, email: payload.email }
 * })
 *
 * createWebSocketRoute("/api/chat")
 *   .authenticate(wsAuth)
 *   .onConnect((ws, ctx) => {
 *     console.log(`User ${ctx.user.id} connected`)
 *   })
 *   .build()
 * ```
 */
export function createTokenAuth<TUser>(
  verifyToken: (token: string) => Promise<TUser | null> | TUser | null,
  options: TokenExtractionOptions = {},
): (req: Request) => Promise<TUser | null> {
  return async (req: Request): Promise<TUser | null> => {
    const extracted = extractToken(req, options)
    if (!extracted) {
      return null
    }

    try {
      return await verifyToken(extracted.token)
    } catch {
      return null
    }
  }
}

/**
 * Create a WebSocket authentication function that accepts any connection
 * (no authentication required). The user property will be undefined.
 *
 * @returns WebSocketAuthFn that always succeeds
 *
 * @example
 * ```typescript
 * createWebSocketRoute("/public/notifications")
 *   .authenticate(noAuth())
 *   .onConnect((ws, ctx) => {
 *     // ctx.user is undefined
 *   })
 *   .build()
 * ```
 */
export function noAuth(): (req: Request) => null {
  return () => null
}

/**
 * Create a WebSocket authentication function that extracts request metadata
 * without requiring authentication. Useful for public WebSocket endpoints
 * that still want access to request information.
 *
 * @returns WebSocketAuthFn that returns request metadata
 *
 * @example
 * ```typescript
 * createWebSocketRoute("/public/stream")
 *   .authenticate(extractRequestInfo())
 *   .onConnect((ws, ctx) => {
 *     console.log(`IP: ${ctx.user.ip}, Origin: ${ctx.user.origin}`)
 *   })
 *   .build()
 * ```
 */
export function extractRequestInfo(): (req: Request) => {
  ip: string | null
  origin: string | null
  userAgent: string | null
} {
  return (req: Request) => ({
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip"),
    origin: req.headers.get("origin"),
    userAgent: req.headers.get("user-agent"),
  })
}
