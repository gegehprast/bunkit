import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import type { WebhookEvent } from "@/db/schemas"
import { receiveWebhook } from "@/gateway/webhook-receiver"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

const SendTestBodySchema = z.object({
  /** Raw request body to deliver (defaults to empty JSON object). */
  body: z.string().default("{}"),
  /** Extra headers to include on the synthetic inbound request. */
  headers: z.record(z.string(), z.string()).optional(),
  /** HTTP method to simulate (defaults to POST). */
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
})

const SendTestResponseSchema = z
  .object({
    eventId: z.string().uuid(),
    endpointId: z.string().uuid(),
    method: z.string(),
    matchedRuleId: z.string().uuid().nullable(),
    signatureValid: z.boolean().nullable(),
    dropped: z.boolean(),
    receivedAt: z.string().datetime(),
  })
  .meta({ id: "SendTestResult" })

function formatResult(event: WebhookEvent, dropped: boolean) {
  return {
    eventId: event.id,
    endpointId: event.endpointId,
    method: event.method,
    matchedRuleId: event.matchedRuleId ?? null,
    signatureValid: event.signatureValid ?? null,
    dropped,
    receivedAt: event.receivedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// POST /api/endpoints/:endpointId/send-test
// ---------------------------------------------------------------------------
createRoute("POST", "/api/endpoints/:endpointId/send-test")
  .openapi({
    operationId: "sendTestWebhook",
    summary: "Send a test webhook to an endpoint",
    description:
      "Fires a synthetic inbound request through the full gateway pipeline " +
      "(filter rules → event persist → delivery enqueue) without requiring a " +
      "valid signature. Useful for testing filter rules and delivery targets " +
      "from the dashboard.",
    tags: ["Endpoints"],
  })
  .middlewares(apiKeyMiddleware())
  .body(SendTestBodySchema)
  .response(SendTestResponseSchema)
  .handler(async ({ params, body, res }) => {
    const endpointResult = webhookEndpointRepository.findById(params.endpointId)
    if (!endpointResult.isOk())
      return res.internalError(
        endpointResult.error.message,
        endpointResult.error.code,
      )
    if (!endpointResult.value) return res.notFound("Endpoint not found")

    const endpoint = endpointResult.value

    const result = await receiveWebhook(
      {
        slug: endpoint.slug,
        method: body.method,
        headers: {
          "content-type": "application/json",
          ...(body.headers ?? {}),
        },
        body: body.body,
        query: {},
        sourceIp: null,
      },
      { skipSignatureVerification: true },
    )

    if (!result.isOk()) {
      return res.internalError(result.error.message, result.error.code)
    }

    const { event, dropped } = result.value
    return res.ok(formatResult(event, dropped))
  })
