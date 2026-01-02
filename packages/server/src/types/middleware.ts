import type { ResponseHelpers } from "../http/types/response.js"

/**
 * Arguments passed to middleware functions
 */
export interface MiddlewareArgs {
  req: Request
  params: Record<string, string>
  query: unknown
  body: unknown
  ctx: Record<string, unknown>
  res: ResponseHelpers
  next: () => Promise<Response>
}

/**
 * Middleware function type
 */
export type MiddlewareFn = (
  context: MiddlewareArgs,
) => Promise<Response> | Response
