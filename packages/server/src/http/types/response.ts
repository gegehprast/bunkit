/**
 * Cookie options for Set-Cookie header
 */
export interface CookieOptions {
  domain?: string
  path?: string
  expires?: Date
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "Strict" | "Lax" | "None"
}

/**
 * Cookie to be set in response
 */
export interface Cookie {
  name: string
  value: string
  options?: CookieOptions
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  message: string
  code?: string
  details?: unknown
}

/**
 * Registry of all application routes for type-safe internal redirects.
 * This interface is auto-generated or manually extended via declaration merging.
 *
 * @example Auto-generated (recommended):
 * // Run: bun run generate-route-types
 * // This creates a routes.d.ts file with all registered routes
 *
 * @example Manual declaration merging:
 * declare module "@bunkit/server" {
 *   interface RegisteredRoutes {
 *     "/": Record<string, never>
 *     "/users/:id": { id: string }
 *   }
 * }
 */
// biome-ignore lint/suspicious/noEmptyInterface: Empty interface is intentional for declaration merging
export interface RegisteredRoutes {}

/**
 * Helper type to build route paths with parameters
 */
export type BuildRoutePath<TPath extends keyof RegisteredRoutes> =
  RegisteredRoutes[TPath] extends Record<string, never>
    ? TPath // No parameters required
    : {
        path: TPath
        params: RegisteredRoutes[TPath]
      }

/**
 * Response builder interface with type-safe methods for constructing HTTP responses in route handlers.
 * @template TResponse - The expected response data type from the route schema
 */
export interface ResponseBuilder<TResponse = unknown> {
  /**
   * Set a cookie in the response. This may throw an Error.
   * @throws Error if name is string and value is missing
   */
  setCookie(name: string, value: string, options?: CookieOptions): this
  /**
   * Set a cookie in the response. This may throw an Error.
   * @throws Error if name is string and value is missing
   */
  setCookie(cookie: Cookie): this

  /**
   * 200 OK response - constrained to TResponse type
   */
  ok(data: TResponse, status?: number): Response
  /**
   * 201 Created response - constrained to TResponse type
   */
  created(data: TResponse, location?: string): Response
  /**
   * 202 Accepted response - constrained to TResponse type
   */
  accepted(data: TResponse): Response
  /**
   * 204 No Content response
   */
  noContent(): Response

  /**
   * 4xx Client Error responses
   */
  badRequest(message: string, code?: string, details?: unknown): Response
  /**
   * 401 Unauthorized response
   */
  unauthorized(message: string, code?: string, details?: unknown): Response
  /**
   * 403 Forbidden response
   */
  forbidden(message: string, code?: string, details?: unknown): Response
  /**
   * 404 Not Found response
   */
  notFound(message: string, code?: string, details?: unknown): Response
  /**
   * 409 Conflict response
   */
  conflict(message: string, code?: string, details?: unknown): Response
  /**
   * 500 Internal Server Error response
   */
  internalError(message: string, code?: string, details?: unknown): Response

  /**
   * Text response
   */
  text(content: string, status?: number): Response
  /**
   * HTML response
   */
  html(content: string, status?: number): Response
  /**
   * File response
   */
  file(path: string, contentType?: string): Promise<Response>
  /**
   * Stream response
   */
  stream(readable: ReadableStream, contentType?: string): Response
  /**
   * Redirect to an external URL
   */
  redirect(url: string, status?: number): Response
  /**
   * Redirect to an internal route with type safety.
   * Routes must be registered in the RegisteredRoutes interface.
   *
   * @example
   * // For routes without parameters
   * res.redirectTo("/")
   * res.redirectTo("/users")
   *
   * // For routes with parameters
   * res.redirectTo({ path: "/users/:id", params: { id: "123" } })
   */
  redirectTo<TPath extends keyof RegisteredRoutes>(
    route: BuildRoutePath<TPath>,
    status?: number,
  ): Response

  /**
   * Custom response status. Chainable.
   */
  status(status: number): ResponseBuilder<TResponse>

  /**
   * Custom response header. Chainable.
   */
  header(name: string, value: string): ResponseBuilder<TResponse>

  /**
   * Custom response headers. Chainable.
   */
  headers(headers: Record<string, string>): ResponseBuilder<TResponse>

  /**
   * Custom response cookie. Chainable.
   */
  cookie(
    name: string,
    value: string,
    options?: CookieOptions,
  ): ResponseBuilder<TResponse>
  /**
   * Custom response cookie. Chainable.
   */
  cookie(cookie: Cookie): ResponseBuilder<TResponse>

  /**
   * Send a JSON response with the given body and status code.
   */
  json(body: unknown, status?: number): Response
  /**
   * Send a JSON response with the given body and status code.
   */
  json<T>(body: T, status?: number): Response
  /**
   * Send a JSON response with the given body and status code.
   */
  json<T>(
    body: T,
    options: { status?: number; headers?: Record<string, string> },
  ): Response

  /**
   * Custom response
   */
  custom(
    body: string | null,
    options: ResponseInit & { status?: number },
  ): Response
}
