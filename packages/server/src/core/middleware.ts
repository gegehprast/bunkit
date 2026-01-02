import type { MiddlewareArgs, MiddlewareFn } from "../types/middleware"
import type { ResponseHelpers } from "../http/types/response"

/**
 * Execute middleware chain
 * Returns Response from handler or middleware that short-circuits
 */
export async function executeMiddlewareChain(
  middlewares: MiddlewareFn[],
  args: MiddlewareArgs,
  handler: () => Promise<Response>,
): Promise<Response> {
  let index = 0

  async function next(): Promise<Response> {
    if (index >= middlewares.length) {
      // End of middleware chain, execute handler
      return handler()
    }

    const middleware = middlewares[index]

    // No middleware or end of chain, execute handler
    if (!middleware) {
      return handler()
    }

    index++

    const result = await middleware({
      ...args,
      next,
    })

    return result
  }

  const result = await next()
  return result
}

/**
 * Create middleware execution arguments
 */
export function createMiddlewareArgs(
  req: Request,
  params: Record<string, string>,
  query: unknown,
  body: unknown,
  ctx: Record<string, unknown>,
  res: ResponseHelpers,
): MiddlewareArgs {
  return {
    req,
    params,
    query,
    body,
    ctx,
    res,
    next: async () => {
      throw new Error("next() not implemented")
    }, // Will be replaced by executeMiddlewareChain
  }
}
