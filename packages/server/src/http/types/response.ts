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
 * Response helper methods available in handlers
 * @template TResponse - The expected response data type from the route schema
 */
export interface ResponseHelpers<TResponse = unknown> {
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
   * Redirect response
   */
  redirect(url: string, status?: number): Response

  /**
   * Custom response
   */
  custom(
    body: string | null,
    options: ResponseInit & { status?: number },
  ): Response
}
