import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { deliveryAttemptRepository } from "@/db/repositories/delivery-attempt-repository"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { webhookEventRepository } from "@/db/repositories/webhook-event-repository"
import type { WebhookEvent } from "@/db/schemas"
import { enqueueDeliveries } from "@/gateway/delivery-queue"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

const EventSchema = z
  .object({
    id: z.string().uuid(),
    endpointId: z.string().uuid(),
    method: z.string(),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
    sourceIp: z.string().nullable(),
    matchedRuleId: z.string().uuid().nullable(),
    signatureValid: z.boolean().nullable(),
    receivedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "WebhookEvent" })

const EventsQuerySchema = z.object({
  endpointId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

function formatEvent(e: WebhookEvent) {
  return {
    id: e.id,
    endpointId: e.endpointId,
    method: e.method,
    headers: e.headers as Record<string, string>,
    body: e.body,
    sourceIp: e.sourceIp ?? null,
    matchedRuleId: e.matchedRuleId ?? null,
    signatureValid: e.signatureValid ?? null,
    receivedAt: e.receivedAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// GET /api/events
// ---------------------------------------------------------------------------
createRoute("GET", "/api/events")
  .openapi({
    operationId: "listEvents",
    summary: "List webhook events",
    tags: ["Events"],
  })
  .middlewares(apiKeyMiddleware())
  .response(
    z.object({
      events: z.array(EventSchema),
      total: z.number().int(),
      limit: z.number().int(),
      offset: z.number().int(),
    }),
  )
  .handler(({ req, res }) => {
    const raw = Object.fromEntries(new URL(req.url).searchParams)
    const parsed = EventsQuerySchema.safeParse(raw)
    if (!parsed.success) return res.badRequest(parsed.error.message)

    const opts = {
      endpointId: parsed.data.endpointId,
      since: parsed.data.since ? new Date(parsed.data.since) : undefined,
      before: parsed.data.before ? new Date(parsed.data.before) : undefined,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    }

    const [listResult, countResult] = [
      webhookEventRepository.list(opts),
      webhookEventRepository.count(opts),
    ]

    if (!listResult.isOk())
      return res.internalError(listResult.error.message, listResult.error.code)
    if (!countResult.isOk())
      return res.internalError(
        countResult.error.message,
        countResult.error.code,
      )

    return res.ok({
      events: listResult.value.map(formatEvent),
      total: countResult.value,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    })
  })

// ---------------------------------------------------------------------------
// GET /api/events/:id
// ---------------------------------------------------------------------------
createRoute("GET", "/api/events/:id")
  .openapi({
    operationId: "getEvent",
    summary: "Get webhook event",
    tags: ["Events"],
  })
  .middlewares(apiKeyMiddleware())
  .response(EventSchema)
  .handler(({ params, res }) => {
    const result = webhookEventRepository.findById(params.id)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)
    if (!result.value) return res.notFound("Event not found")
    return res.ok(formatEvent(result.value))
  })

// ---------------------------------------------------------------------------
// POST /api/events/:id/replay
// ---------------------------------------------------------------------------
createRoute("POST", "/api/events/:id/replay")
  .openapi({
    operationId: "replayEvent",
    summary: "Replay webhook event",
    tags: ["Events"],
  })
  .middlewares(apiKeyMiddleware())
  .response(
    z.object({
      queued: z.boolean(),
      attemptCount: z.number().int(),
    }),
  )
  .handler(({ params, res }) => {
    const eventResult = webhookEventRepository.findById(params.id)
    if (!eventResult.isOk())
      return res.internalError(
        eventResult.error.message,
        eventResult.error.code,
      )
    if (!eventResult.value) return res.notFound("Event not found")

    const targetsResult = deliveryTargetRepository.listEnabledByEndpoint(
      eventResult.value.endpointId,
    )
    if (!targetsResult.isOk())
      return res.internalError(
        targetsResult.error.message,
        targetsResult.error.code,
      )

    const enqueuedResult = enqueueDeliveries(
      eventResult.value,
      targetsResult.value,
    )
    if (!enqueuedResult.isOk())
      return res.internalError(
        enqueuedResult.error.message,
        enqueuedResult.error.code,
      )

    return res.ok({ queued: true, attemptCount: enqueuedResult.value.length })
  })

// ---------------------------------------------------------------------------
// GET /api/events/:id/attempts
// ---------------------------------------------------------------------------
createRoute("GET", "/api/events/:id/attempts")
  .openapi({
    operationId: "listEventAttempts",
    summary: "List delivery attempts for event",
    tags: ["Events"],
  })
  .middlewares(apiKeyMiddleware())
  .response(z.array(z.any()))
  .handler(({ params, res }) => {
    const event = webhookEventRepository.findById(params.id)
    if (!event.isOk())
      return res.internalError(event.error.message, event.error.code)
    if (!event.value) return res.notFound("Event not found")

    const result = deliveryAttemptRepository.list({ eventId: params.id })
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)

    return res.ok(
      result.value.map((a) => ({
        ...a,
        nextRetryAt: a.nextRetryAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    )
  })
