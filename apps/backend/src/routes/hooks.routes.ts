import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { receiveWebhook } from "@/gateway/webhook-receiver"

const WebhookReceivedSchema = z
  .object({
    eventId: z.string().uuid(),
    queued: z.boolean(),
  })
  .meta({ id: "WebhookReceived" })

/**
 * Inbound webhook ingestion endpoint.
 *
 * Accepts any HTTP method so that vendors that use PUT/PATCH for webhooks
 * (rare but possible) are also supported.  The heavy lifting is done by
 * `receiveWebhook()` which handles signature verification, filter evaluation,
 * event persistence, and delivery queueing.
 */
for (const method of ["POST", "PUT", "PATCH"] as const) {
  createRoute(method, "/hooks/:slug")
    .openapi({
      operationId: method === "POST" ? "receiveWebhook" : undefined,
      summary: "Receive inbound webhook",
      description:
        "Accepts an inbound webhook, verifies its signature, evaluates filter rules, persists the event, and enqueues delivery to all enabled targets.",
      tags: ["Inbound"],
    })
    .response(WebhookReceivedSchema)
    .handler(async ({ req, params, res }) => {
      const body = await req.text()

      // Normalise headers to lowercase keys
      const headers: Record<string, string> = {}
      req.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
      })

      // Parse query string
      const url = new URL(req.url)
      const query: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        query[key] = value
      })

      const sourceIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null

      const result = await receiveWebhook({
        slug: params.slug,
        method: req.method,
        headers,
        body,
        query,
        sourceIp,
      })

      if (!result.isOk()) {
        const error = result.error
        return res
          .status(error.statusCode)
          .badRequest(error.message, error.code)
      }

      return res.ok({ eventId: result.value.event.id, queued: true })
    })
}
