import { createHash } from "node:crypto"
import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { apiKeyRepository } from "@/db/repositories/api-key-repository"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

const AUTH_COOKIE = "auth_token"

/** Shared cookie options — httpOnly prevents JS access. */
const cookieOptions = {
  httpOnly: true,
  sameSite: "Lax" as const,
  path: "/",
  // secure: true should be set in production behind HTTPS
  ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
}

const LoginRequestSchema = z.object({
  key: z.string().min(1),
})

const MeResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    keyPrefix: z.string(),
    isAdmin: z.boolean(),
  })
  .meta({ id: "AuthMe" })

// ---------------------------------------------------------------------------
// POST /api/auth/login  — unauthenticated; validates key and sets cookie
// ---------------------------------------------------------------------------
createRoute("POST", "/api/auth/login")
  .openapi({
    operationId: "login",
    summary: "Validate an API key and set an auth cookie",
    tags: ["Auth"],
  })
  .body(LoginRequestSchema)
  .response(MeResponseSchema)
  .handler(({ body, res }) => {
    const keyHash = createHash("sha256").update(body.key).digest("hex")
    const result = apiKeyRepository.validate(keyHash)

    if (!result.isOk()) {
      return res.unauthorized(result.error.message, result.error.code)
    }

    const key = result.value

    if (!key.isAdmin) {
      return res.unauthorized(
        "Only admin keys can log into the dashboard",
        "API_KEY_INSUFFICIENT_ROLE",
      )
    }

    apiKeyRepository.updateLastUsed(key.id, new Date())

    return res
      .setCookie(AUTH_COOKIE, body.key, cookieOptions)
      .ok({ id: key.id, name: key.name, keyPrefix: key.keyPrefix, isAdmin: key.isAdmin })
  })

// ---------------------------------------------------------------------------
// POST /api/auth/logout  — clears the auth cookie
// ---------------------------------------------------------------------------
createRoute("POST", "/api/auth/logout")
  .openapi({
    operationId: "logout",
    summary: "Clear the auth cookie",
    tags: ["Auth"],
  })
  .response(z.object({ ok: z.boolean() }))
  .handler(({ res }) => {
    return res
      .setCookie(AUTH_COOKIE, "", { ...cookieOptions, maxAge: 0 })
      .ok({ ok: true })
  })

// ---------------------------------------------------------------------------
// GET /api/auth/me  — returns current key info; used to check auth status
// ---------------------------------------------------------------------------
createRoute("GET", "/api/auth/me")
  .openapi({
    operationId: "getMe",
    summary: "Return current authenticated key info",
    tags: ["Auth"],
  })
  .middlewares(apiKeyMiddleware())
  .response(MeResponseSchema)
  .handler(({ req, res }) => {
    // Re-derive the key from the request to look up its record
    const auth = req.headers.get("authorization")
    const cookieHeader = req.headers.get("cookie")
    let rawKey: string | null = null

    if (auth?.toLowerCase().startsWith("bearer ")) {
      rawKey = auth.slice(7).trim()
    } else if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/)
      if (match?.[1]) rawKey = decodeURIComponent(match[1])
    }

    if (!rawKey)
      return res.unauthorized("Not authenticated", "API_KEY_REQUIRED")

    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const result = apiKeyRepository.findByHash(keyHash)

    if (!result.isOk() || !result.value) {
      return res.unauthorized("Key not found", "API_KEY_INVALID")
    }

    const key = result.value
    return res.ok({ id: key.id, name: key.name, keyPrefix: key.keyPrefix, isAdmin: key.isAdmin })
  })
