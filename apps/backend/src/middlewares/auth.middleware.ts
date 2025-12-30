import type { Result } from "@bunkit/result"
import type { MiddlewareArgs, MiddlewareFn } from "@bunkit/server"

export interface AuthMiddlewareOptions {
  validate: (
    context: Omit<MiddlewareArgs, "res" | "next">,
  ) => Promise<Result<void, Error>> | Result<void, Error>
}
export function authMiddleware({
  validate,
}: AuthMiddlewareOptions): MiddlewareFn {
  return async ({
    req,
    params,
    query,
    body,
    ctx,
    res,
    next,
  }: MiddlewareArgs) => {
    const result = await validate({ req, params, query, body, ctx })

    if (result.isErr()) {
      return res.unauthorized("Authentication failed", "AUTHENTICATION_FAILED")
    }

    // Continue to next middleware/handler
    return next()
  }
}
