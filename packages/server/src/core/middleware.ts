import type { Context } from "../http/types/context"
import type { ResponseHelpers } from "../http/types/response"
import type { MiddlewareArgs, MiddlewareFn } from "../types/middleware"

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
  ctx: Context,
  res: ResponseHelpers,
): MiddlewareArgs {
  return {
    req,
    params,
    query,
    body,
    ctx,
    res,

    // This `next` will never be called
    // and will be replaced by `executeMiddlewareChain`
    next: async () => {
      throw new Error("next() not implemented")
    },
  }
}
