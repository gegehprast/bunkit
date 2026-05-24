import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { deliveryAttemptRepository } from "@/db/repositories/delivery-attempt-repository"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { webhookEventRepository } from "@/db/repositories/webhook-event-repository"
import type { DeliveryAttempt } from "@/db/schemas"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

const AttemptSchema = z
  .object({
    id: z.string().uuid(),
    eventId: z.string().uuid(),
    targetId: z.string().uuid(),
    status: z.string(),
    attemptNumber: z.number().int(),
    nextRetryAt: z.string().datetime().nullable(),
    responseStatus: z.number().int().nullable(),
    responseBody: z.string().nullable(),
    responseLatencyMs: z.number().int().nullable(),
    errorMessage: z.string().nullable(),
    isReplay: z.boolean(),
    originalAttemptId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "DeliveryAttempt" })

function formatAttempt(a: DeliveryAttempt) {
  return {
    id: a.id,
    eventId: a.eventId,
    targetId: a.targetId,
    status: a.status,
    attemptNumber: a.attemptNumber,
    nextRetryAt: a.nextRetryAt?.toISOString() ?? null,
    responseStatus: a.responseStatus ?? null,
    responseBody: a.responseBody ?? null,
    responseLatencyMs: a.responseLatencyMs ?? null,
    errorMessage: a.errorMessage ?? null,
    isReplay: a.isReplay,
    originalAttemptId: a.originalAttemptId ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// GET /api/dlq
// ---------------------------------------------------------------------------
createRoute("GET", "/api/dlq")
  .openapi({
    operationId: "listDlq",
    summary: "List dead-letter queue entries",
    tags: ["DLQ"],
  })
  .middlewares(apiKeyMiddleware())
  .response(
    z.object({
      attempts: z.array(AttemptSchema),
      total: z.number().int(),
    }),
  )
  .handler(({ req, res }) => {
    const params = new URL(req.url).searchParams
    const limit = Math.min(Number(params.get("limit") ?? 100), 200)
    const offset = Number(params.get("offset") ?? 0)

    const [listResult, countResult] = [
      deliveryAttemptRepository.list({ status: "dlq", limit, offset }),
      deliveryAttemptRepository.countByStatus("dlq"),
    ]

    if (!listResult.isOk())
      return res.internalError(listResult.error.message, listResult.error.code)
    if (!countResult.isOk())
      return res.internalError(
        countResult.error.message,
        countResult.error.code,
      )

    return res.ok({
      attempts: listResult.value.map(formatAttempt),
      total: countResult.value,
    })
  })

// ---------------------------------------------------------------------------
// POST /api/dlq/replay
// ---------------------------------------------------------------------------
createRoute("POST", "/api/dlq/replay")
  .openapi({
    operationId: "replayDlq",
    summary: "Replay DLQ entries",
    tags: ["DLQ"],
  })
  .middlewares(apiKeyMiddleware())
  .body(z.object({ ids: z.array(z.string().uuid()).optional() }))
  .response(z.object({ replayed: z.number().int(), errors: z.number().int() }))
  .handler(async ({ body, res }) => {
    const toReplay: DeliveryAttempt[] = body.ids
      ? body.ids.flatMap((id) => {
          const r = deliveryAttemptRepository.findById(id)
          if (!r.isOk() || !r.value || r.value.status !== "dlq") return []
          return [r.value]
        })
      : (() => {
          const all = deliveryAttemptRepository.list({
            status: "dlq",
            limit: 1000,
            offset: 0,
          })
          return all.isOk() ? all.value : []
        })()

    let replayed = 0
    let errors = 0
    const now = new Date()

    for (const attempt of toReplay) {
      const eventResult = webhookEventRepository.findById(attempt.eventId)
      const targetResult = deliveryTargetRepository.findById(attempt.targetId)

      if (!eventResult.isOk() || !eventResult.value) {
        errors++
        continue
      }
      if (!targetResult.isOk() || !targetResult.value) {
        errors++
        continue
      }

      const createResult = deliveryAttemptRepository.create({
        eventId: attempt.eventId,
        targetId: attempt.targetId,
        status: "pending",
        attemptNumber: 1,
        nextRetryAt: now,
        isReplay: true,
        originalAttemptId: attempt.id,
      })

      if (createResult.isOk()) {
        replayed++
      } else {
        errors++
      }
    }

    return res.ok({ replayed, errors })
  })

// ---------------------------------------------------------------------------
// DELETE /api/dlq
// ---------------------------------------------------------------------------
createRoute("DELETE", "/api/dlq")
  .openapi({
    operationId: "discardDlq",
    summary: "Discard DLQ entries",
    tags: ["DLQ"],
  })
  .middlewares(apiKeyMiddleware())
  .body(z.object({ ids: z.array(z.string().uuid()).optional() }))
  .response(z.object({ discarded: z.number().int() }))
  .handler(({ body, res }) => {
    const toDiscard = body.ids
      ? body.ids
      : (() => {
          const all = deliveryAttemptRepository.list({
            status: "dlq",
            limit: 1000,
            offset: 0,
          })
          return all.isOk() ? all.value.map((a) => a.id) : []
        })()

    let discarded = 0
    for (const id of toDiscard) {
      const result = deliveryAttemptRepository.delete(id)
      if (result.isOk()) discarded++
    }

    return res.ok({ discarded })
  })
