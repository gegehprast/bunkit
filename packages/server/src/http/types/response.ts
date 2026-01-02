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
  // JSON responses - constrained to TResponse type
  ok(data: TResponse, status?: number): Response
  created(data: TResponse, location?: string): Response
  noContent(): Response

  // Error responses - all require message, code, and optional details
  badRequest(message: string, code?: string, details?: unknown): Response
  unauthorized(message: string, code?: string, details?: unknown): Response
  forbidden(message: string, code?: string, details?: unknown): Response
  notFound(message: string, code?: string, details?: unknown): Response
  internalError(message: string, code?: string, details?: unknown): Response

  // Other content types
  text(content: string, status?: number): Response
  html(content: string, status?: number): Response
  file(path: string, contentType?: string): Promise<Response>
  stream(readable: ReadableStream, contentType?: string): Response
  redirect(url: string, status?: number): Response

  // Custom response
  custom(
    body: string | null,
    options: ResponseInit & { status?: number },
  ): Response
}
