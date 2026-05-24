import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import {
  CUSTOM_SIGNATURE_ENCODINGS,
  SIGNING_SCHEMES,
  type WebhookEndpoint,
} from "@/db/schemas"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

const EndpointSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    signingScheme: z.enum(SIGNING_SCHEMES),
    signingSecret: z.string().nullable(),
    customSignatureHeader: z.string().nullable(),
    customSignatureEncoding: z.enum(CUSTOM_SIGNATURE_ENCODINGS).nullable(),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "WebhookEndpoint" })

const CreateEndpointSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-_]+$/),
  description: z.string().optional(),
  signingScheme: z.enum(SIGNING_SCHEMES).default("none"),
  signingSecret: z.string().optional(),
  customSignatureHeader: z.string().optional(),
  customSignatureEncoding: z.enum(CUSTOM_SIGNATURE_ENCODINGS).optional(),
  enabled: z.boolean().default(true),
})

const UpdateEndpointSchema = CreateEndpointSchema.partial()

function formatEndpoint(ep: WebhookEndpoint) {
  return {
    id: ep.id,
    name: ep.name,
    slug: ep.slug,
    description: ep.description ?? null,
    signingScheme: ep.signingScheme,
    signingSecret: ep.signingSecret ?? null,
    customSignatureHeader: ep.customSignatureHeader ?? null,
    customSignatureEncoding: ep.customSignatureEncoding ?? null,
    enabled: ep.enabled,
    createdAt: ep.createdAt.toISOString(),
    updatedAt: ep.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// GET /api/endpoints
// ---------------------------------------------------------------------------
createRoute("GET", "/api/endpoints")
  .openapi({
    operationId: "listEndpoints",
    summary: "List endpoints",
    tags: ["Endpoints"],
  })
  .middlewares(apiKeyMiddleware())
  .response(z.array(EndpointSchema))
  .handler(({ res }) => {
    const result = webhookEndpointRepository.listAll()
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.ok(result.value.map(formatEndpoint))
  })

// ---------------------------------------------------------------------------
// POST /api/endpoints
// ---------------------------------------------------------------------------
createRoute("POST", "/api/endpoints")
  .openapi({
    operationId: "createEndpoint",
    summary: "Create endpoint",
    tags: ["Endpoints"],
  })
  .middlewares(apiKeyMiddleware())
  .body(CreateEndpointSchema)
  .response(EndpointSchema)
  .handler(({ body, res }) => {
    const result = webhookEndpointRepository.create({
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      signingScheme: body.signingScheme,
      signingSecret: body.signingSecret ?? null,
      customSignatureHeader: body.customSignatureHeader ?? null,
      customSignatureEncoding: body.customSignatureEncoding ?? null,
      enabled: body.enabled,
    })
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.created(formatEndpoint(result.value))
  })

// ---------------------------------------------------------------------------
// GET /api/endpoints/:id
// ---------------------------------------------------------------------------
createRoute("GET", "/api/endpoints/:id")
  .openapi({
    operationId: "getEndpoint",
    summary: "Get endpoint",
    tags: ["Endpoints"],
  })
  .middlewares(apiKeyMiddleware())
  .response(EndpointSchema)
  .handler(({ params, res }) => {
    const result = webhookEndpointRepository.findById(params.id)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    if (!result.value) return res.notFound("Endpoint not found")
    return res.ok(formatEndpoint(result.value))
  })

// ---------------------------------------------------------------------------
// PATCH /api/endpoints/:id
// ---------------------------------------------------------------------------
createRoute("PATCH", "/api/endpoints/:id")
  .openapi({
    operationId: "updateEndpoint",
    summary: "Update endpoint",
    tags: ["Endpoints"],
  })
  .middlewares(apiKeyMiddleware())
  .body(UpdateEndpointSchema)
  .response(EndpointSchema)
  .handler(({ params, body, res }) => {
    const existing = webhookEndpointRepository.findById(params.id)
    if (!existing.isOk())
      return res.internalError(existing.error.message, existing.error.code)
    if (!existing.value) return res.notFound("Endpoint not found")

    const result = webhookEndpointRepository.update(params.id, body)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    if (!result.value) return res.notFound("Endpoint not found")
    return res.ok(formatEndpoint(result.value))
  })

// ---------------------------------------------------------------------------
// DELETE /api/endpoints/:id
// ---------------------------------------------------------------------------
createRoute("DELETE", "/api/endpoints/:id")
  .openapi({
    operationId: "deleteEndpoint",
    summary: "Delete endpoint",
    tags: ["Endpoints"],
  })
  .middlewares(apiKeyMiddleware())
  .handler(({ params, res }) => {
    const existing = webhookEndpointRepository.findById(params.id)
    if (!existing.isOk())
      return res.internalError(existing.error.message, existing.error.code)
    if (!existing.value) return res.notFound("Endpoint not found")

    const result = webhookEndpointRepository.delete(params.id)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.noContent()
  })
