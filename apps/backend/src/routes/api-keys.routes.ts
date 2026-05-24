import { createHash, randomBytes } from "node:crypto"
import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { apiKeyRepository } from "@/db/repositories/api-key-repository"
import type { ApiKey } from "@/db/schemas"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

const ApiKeySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    keyPrefix: z.string(),
    createdBy: z.string().nullable(),
    isAdmin: z.boolean(),
    expiresAt: z.string().datetime().nullable(),
    lastUsedAt: z.string().datetime().nullable(),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "ApiKey" })

const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  isAdmin: z.boolean().default(false),
  createdBy: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})

const CreateApiKeyResponseSchema = ApiKeySchema.extend({
  /** The raw key — only returned once at creation time. */
  key: z.string(),
}).meta({ id: "CreateApiKeyResponse" })

function formatKey(key: ApiKey) {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    createdBy: key.createdBy ?? null,
    isAdmin: key.isAdmin,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    enabled: key.enabled,
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// GET /api/keys
// ---------------------------------------------------------------------------
createRoute("GET", "/api/keys")
  .openapi({
    operationId: "listApiKeys",
    summary: "List API keys",
    tags: ["API Keys"],
  })
  .middlewares(apiKeyMiddleware())
  .response(z.array(ApiKeySchema))
  .handler(({ res }) => {
    const result = apiKeyRepository.listAll()
    if (!result.isOk()) return res.internalError(result.error.message)
    return res.ok(result.value.map(formatKey))
  })

// ---------------------------------------------------------------------------
// POST /api/keys
// ---------------------------------------------------------------------------
createRoute("POST", "/api/keys")
  .openapi({
    operationId: "createApiKey",
    summary: "Create an API key",
    tags: ["API Keys"],
  })
  .middlewares(apiKeyMiddleware({ adminOnly: true }))
  .body(CreateApiKeyRequestSchema)
  .response(CreateApiKeyResponseSchema)
  .handler(({ body, res }) => {
    const rawKey = randomBytes(32).toString("hex")
    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const keyPrefix = rawKey.slice(0, 8)

    const result = apiKeyRepository.create({
      name: body.name,
      keyHash,
      keyPrefix,
      isAdmin: body.isAdmin,
      createdBy: body.createdBy ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    })

    if (!result.isOk()) return res.internalError(result.error.message)

    return res.created({ ...formatKey(result.value), key: rawKey })
  })

// ---------------------------------------------------------------------------
// DELETE /api/keys/:id
// ---------------------------------------------------------------------------
createRoute("DELETE", "/api/keys/:id")
  .openapi({
    operationId: "deleteApiKey",
    summary: "Delete an API key",
    tags: ["API Keys"],
  })
  .middlewares(apiKeyMiddleware({ adminOnly: true }))
  .handler(({ params, res }) => {
    const existing = apiKeyRepository.findById(params.id)
    if (!existing.isOk()) return res.internalError(existing.error.message)
    if (!existing.value) return res.notFound("API key not found")

    const result = apiKeyRepository.delete(params.id)
    if (!result.isOk()) return res.internalError(result.error.message)

    return res.noContent()
  })
