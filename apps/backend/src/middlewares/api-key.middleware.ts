import { createHash } from "node:crypto"
import type { MiddlewareArgs, MiddlewareFn } from "@bunkit/server"
import { apiKeyRepository } from "@/db/repositories/api-key-repository"

/**
 * Extract the raw API key from the Authorization header or auth_token cookie.
 * Prefers the Authorization header; falls back to the cookie.
 */
function extractKey(req: Request): string | null {
  const auth = req.headers.get("authorization")
  if (auth) {
    if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim()
    return auth.trim()
  }
  // Fall back to httpOnly cookie
  const cookie = req.headers.get("cookie")
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)auth_token=([^;]+)/)
    if (match?.[1]) return decodeURIComponent(match[1])
  }
  return null
}

/**
 * Middleware that validates inbound requests carry a valid API key.
 *
 * The raw key is never stored — it is hashed with SHA-256 before
 * querying the database, matching how keys are persisted at creation time.
 *
 * Pass `{ adminOnly: true }` to restrict a route to admin keys only.
 */
export function apiKeyMiddleware(options?: { adminOnly?: boolean }): MiddlewareFn {
  return async ({ req, res, next }: MiddlewareArgs) => {
    const rawKey = extractKey(req)
    if (!rawKey) {
      return res.unauthorized("API key required", "API_KEY_REQUIRED")
    }

    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const result = apiKeyRepository.validate(keyHash)

    if (!result.isOk()) {
      return res.unauthorized(result.error.message, result.error.code)
    }

    if (options?.adminOnly && !result.value.isAdmin) {
      return res.forbidden("Admin key required", "API_KEY_INSUFFICIENT_ROLE")
    }

    // Touch lastUsedAt asynchronously — don't block the request
    apiKeyRepository.updateLastUsed(result.value.id, new Date())

    return next()
  }
}
