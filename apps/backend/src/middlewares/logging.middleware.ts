import type { MiddlewareArgs, MiddlewareFn } from "@bunkit/server"
import { logger } from "@/core/logger"

/**
 * Global logging middleware
 * Logs all HTTP requests with method, path, status, and duration
 */
export function loggingMiddleware(): MiddlewareFn {
  return async ({ req, next }: MiddlewareArgs) => {
    const startTime = performance.now()
    const method = req.method
    const url = new URL(req.url)
    const path = url.pathname

    // Get request ID from headers if provided (for tracing)
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID()

    try {
      // Call next middleware/handler
      const response = await next()

      // Calculate duration
      const duration = performance.now() - startTime
      const status = response.status

      // Determine log level based on status code
      if (status >= 500) {
        logger.error("HTTP Request", {
          requestId,
          method,
          path,
          status,
          durationMs: duration,
        })
      } else if (status >= 400) {
        logger.warn("HTTP Request", {
          requestId,
          method,
          path,
          status,
          durationMs: duration,
        })
      } else {
        logger.info("HTTP Request", {
          requestId,
          method,
          path,
          status,
          durationMs: duration,
        })
      }

      return response
    } catch (error) {
      // Log error and re-throw
      const duration = Math.round(performance.now() - startTime)
      logger.error("HTTP Request Error", {
        requestId,
        method,
        path,
        duration,
        error,
      })
      throw error
    }
  }
}
