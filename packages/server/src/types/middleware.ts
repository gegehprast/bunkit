import type { Context } from "../http/types/context"
import type { ResponseHelpers } from "../http/types/response"

/**
 * Arguments passed to middleware functions
 */
export interface MiddlewareArgs {
  req: Request
  params: Record<string, string>
  query: unknown
  body: unknown
  ctx: Context
  res: ResponseHelpers
  next: () => Promise<Response>
}

/**
 * Middleware function type
 */
export type MiddlewareFn = (
  context: MiddlewareArgs,
) => Promise<Response> | Response
