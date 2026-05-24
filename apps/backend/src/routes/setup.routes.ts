import { createHash, randomBytes } from "node:crypto"
import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { apiKeyRepository } from "@/db/repositories/api-key-repository"

const AUTH_COOKIE = "auth_token"

const cookieOptions = {
  httpOnly: true,
  sameSite: "Lax" as const,
  path: "/",
  ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
}

const SetupStatusSchema = z
  .object({ needsSetup: z.boolean() })
  .meta({ id: "SetupStatus" })

const SetupRequestSchema = z.object({
  name: z.string().min(1).max(100).default("Admin"),
})

const SetupResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    keyPrefix: z.string(),
    /** The raw key — only returned once. */
    key: z.string(),
  })
  .meta({ id: "SetupResponse" })

// ---------------------------------------------------------------------------
// GET /api/setup/status  — unauthenticated
// ---------------------------------------------------------------------------
createRoute("GET", "/api/setup/status")
  .openapi({
    operationId: "getSetupStatus",
    summary: "Check whether initial setup is required",
    tags: ["Setup"],
  })
  .response(SetupStatusSchema)
  .handler(({ res }) => {
    const result = apiKeyRepository.listAll()
    if (!result.isOk()) return res.internalError(result.error.message)
    return res.ok({ needsSetup: result.value.length === 0 })
  })

// ---------------------------------------------------------------------------
// POST /api/setup  — unauthenticated, but only works once
// ---------------------------------------------------------------------------
createRoute("POST", "/api/setup")
  .openapi({
    operationId: "runSetup",
    summary: "Create the first API key (only works when no keys exist)",
    tags: ["Setup"],
  })
  .body(SetupRequestSchema)
  .response(SetupResponseSchema)
  .handler(({ body, res }) => {
    const existing = apiKeyRepository.listAll()
    if (!existing.isOk()) return res.internalError(existing.error.message)

    if (existing.value.length > 0) {
      return res.conflict(
        "Setup already completed. Use the admin UI to manage API keys.",
        "RESOURCE_ALREADY_EXISTS",
      )
    }

    const rawKey = randomBytes(32).toString("hex")
    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const keyPrefix = rawKey.slice(0, 8)

    const result = apiKeyRepository.create({
      name: body.name,
      keyHash,
      keyPrefix,
      createdBy: "setup",
      isAdmin: true,
      expiresAt: null,
    })

    if (!result.isOk()) return res.internalError(result.error.message)

    return res.setCookie(AUTH_COOKIE, rawKey, cookieOptions).created({
      id: result.value.id,
      name: result.value.name,
      keyPrefix,
      key: rawKey,
    })
  })
