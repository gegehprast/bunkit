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
 */
export interface ResponseHelpers {
  // JSON responses
  ok<T>(data: T, status?: number): Response
  created<T>(data: T, location?: string): Response
  noContent(): Response

  // Error responses
  badRequest(error: ErrorResponse | string, code?: string): Response
  unauthorized(error: ErrorResponse | string, code?: string): Response
  forbidden(error: ErrorResponse | string, code?: string): Response
  notFound(error: ErrorResponse | string, code?: string): Response
  internalError(error: ErrorResponse | string, code?: string): Response

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
