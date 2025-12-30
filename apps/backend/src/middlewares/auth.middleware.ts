import type { MiddlewareArgs, MiddlewareFn } from "@bunkit/server"
import { verifyToken } from "@/auth/auth.service"

export function authMiddleware(): MiddlewareFn {
  return async ({ req, ctx, next }: MiddlewareArgs) => {
    const authHeader = req.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          message: "No token",
          code: "no_token",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    const token = authHeader.slice(7)
    const tokenResult = await verifyToken(token)

    if (tokenResult.isErr()) {
      return new Response(
        JSON.stringify({
          message: "Invalid token",
          code: "invalid_token",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Store user data in context for handler
    ctx.userId = tokenResult.value.userId
    ctx.userEmail = tokenResult.value.email

    return next()
  }
}
