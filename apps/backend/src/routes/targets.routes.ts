import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import { type DeliveryTarget, OUTBOUND_SIGNING_SCHEMES } from "@/db/schemas"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

const TargetSchema = z
  .object({
    id: z.string().uuid(),
    endpointId: z.string().uuid(),
    name: z.string(),
    url: z.string().url(),
    maxRetries: z.number().int(),
    retryBackoffSeconds: z.number().int(),
    throttleRps: z.number().int().nullable(),
    outboundSigningScheme: z.enum(OUTBOUND_SIGNING_SCHEMES),
    outboundSigningSecret: z.string().nullable(),
    headers: z.record(z.string(), z.string()).nullable(),
    enabled: z.boolean(),
    isTest: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "DeliveryTarget" })

const CreateTargetSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryBackoffSeconds: z.number().int().min(1).max(3600).default(60),
  throttleRps: z.number().int().min(1).optional(),
  outboundSigningScheme: z.enum(OUTBOUND_SIGNING_SCHEMES).default("none"),
  outboundSigningSecret: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
})

const UpdateTargetSchema = CreateTargetSchema.partial()

function formatTarget(t: DeliveryTarget) {
  return {
    id: t.id,
    endpointId: t.endpointId,
    name: t.name,
    url: t.url,
    maxRetries: t.maxRetries,
    retryBackoffSeconds: t.retryBackoffSeconds,
    throttleRps: t.throttleRps ?? null,
    outboundSigningScheme: t.outboundSigningScheme,
    outboundSigningSecret: t.outboundSigningSecret ?? null,
    headers: t.headers ?? null,
    enabled: t.enabled,
    isTest: t.isTest,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// GET /api/endpoints/:endpointId/targets
// ---------------------------------------------------------------------------
createRoute("GET", "/api/endpoints/:endpointId/targets")
  .openapi({
    operationId: "listTargets",
    summary: "List delivery targets",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .response(z.array(TargetSchema))
  .handler(({ params, res }) => {
    const endpoint = webhookEndpointRepository.findById(params.endpointId)
    if (!endpoint.isOk())
      return res.internalError(endpoint.error.message, endpoint.error.code)
    if (!endpoint.value) return res.notFound("Endpoint not found")

    const result = deliveryTargetRepository.listByEndpoint(params.endpointId)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.ok(result.value.map(formatTarget))
  })

// ---------------------------------------------------------------------------
// POST /api/endpoints/:endpointId/targets
// ---------------------------------------------------------------------------
createRoute("POST", "/api/endpoints/:endpointId/targets")
  .openapi({
    operationId: "createTarget",
    summary: "Create delivery target",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .body(CreateTargetSchema)
  .response(TargetSchema)
  .handler(({ params, body, res }) => {
    const endpoint = webhookEndpointRepository.findById(params.endpointId)
    if (!endpoint.isOk())
      return res.internalError(endpoint.error.message, endpoint.error.code)
    if (!endpoint.value) return res.notFound("Endpoint not found")

    const result = deliveryTargetRepository.create({
      endpointId: params.endpointId,
      name: body.name,
      url: body.url,
      maxRetries: body.maxRetries,
      retryBackoffSeconds: body.retryBackoffSeconds,
      throttleRps: body.throttleRps ?? null,
      outboundSigningScheme: body.outboundSigningScheme,
      outboundSigningSecret: body.outboundSigningSecret ?? null,
      headers: body.headers ?? null,
      enabled: body.enabled,
    })
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.created(formatTarget(result.value))
  })

// ---------------------------------------------------------------------------
// GET /api/endpoints/:endpointId/targets/:id
// ---------------------------------------------------------------------------
createRoute("GET", "/api/endpoints/:endpointId/targets/:id")
  .openapi({
    operationId: "getTarget",
    summary: "Get delivery target",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .response(TargetSchema)
  .handler(({ params, res }) => {
    const result = deliveryTargetRepository.findById(params.id)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    if (!result.value) return res.notFound("Target not found")
    return res.ok(formatTarget(result.value))
  })

// ---------------------------------------------------------------------------
// PATCH /api/endpoints/:endpointId/targets/:id
// ---------------------------------------------------------------------------
createRoute("PATCH", "/api/endpoints/:endpointId/targets/:id")
  .openapi({
    operationId: "updateTarget",
    summary: "Update delivery target",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .body(UpdateTargetSchema)
  .response(TargetSchema)
  .handler(({ params, body, res }) => {
    const existing = deliveryTargetRepository.findById(params.id)
    if (!existing.isOk())
      return res.internalError(existing.error.message, existing.error.code)
    if (!existing.value) return res.notFound("Target not found")

    const result = deliveryTargetRepository.update(params.id, body)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    if (!result.value) return res.notFound("Target not found")
    return res.ok(formatTarget(result.value))
  })

// ---------------------------------------------------------------------------
// DELETE /api/endpoints/:endpointId/targets/:id
// ---------------------------------------------------------------------------
createRoute("DELETE", "/api/endpoints/:endpointId/targets/:id")
  .openapi({
    operationId: "deleteTarget",
    summary: "Delete delivery target",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .handler(({ params, res }) => {
    const existing = deliveryTargetRepository.findById(params.id)
    if (!existing.isOk())
      return res.internalError(existing.error.message, existing.error.code)
    if (!existing.value) return res.notFound("Target not found")

    const result = deliveryTargetRepository.delete(params.id)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    return res.noContent()
  })
