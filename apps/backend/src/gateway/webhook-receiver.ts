import { err, ok, type Result } from "@bunkit/result"
import type { AppError } from "@/core/errors"
import { EndpointDisabledError, EndpointNotFoundError } from "@/core/errors"
import { server } from "@/core/server"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { filterRuleRepository } from "@/db/repositories/filter-rule-repository"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import { webhookEventRepository } from "@/db/repositories/webhook-event-repository"
import type { WebhookEvent } from "@/db/schemas"
import { WS_EVENTS_TOPIC } from "@/routes/events.websocket"
import { enqueueDeliveries } from "./delivery-queue"
import { evaluateFilters, type FilterContext } from "./filter-engine"
import { verifySignature } from "./signature-verifier"

export interface IncomingWebhook {
  /** Endpoint slug from the URL path (e.g. `/hooks/:slug`). */
  slug: string
  method: string
  /** All request headers, normalised to lowercase keys. */
  headers: Record<string, string>
  /** Raw request body text (must be read before calling this function). */
  body: string
  /** Parsed query-string parameters. */
  query: Record<string, string>
  sourceIp: string | null
}

export interface ReceiveWebhookOptions {
  /**
   * When true, signature verification is skipped entirely.
   * Used by the "Send Test" feature so operators can fire test webhooks
   * from the dashboard without needing to compute a valid HMAC.
   */
  skipSignatureVerification?: boolean
}

/**
 * Orchestrate the full inbound webhook pipeline:
 *
 * 1. Resolve endpoint by slug → 404 if unknown, 403 if disabled
 * 2. Verify the inbound signature → 400 on failure
 * 3. Evaluate filter rules against the request
 * 4. Persist the `WebhookEvent` record
 * 5. Enqueue delivery attempts to all enabled targets (skipped when a
 *    `dropOnMatch` rule fired)
 *
 * The returned `WebhookEvent` is always the persisted record, regardless
 * of whether delivery was enqueued.
 */
export interface ReceiveWebhookResult {
  event: WebhookEvent
  /** True when a drop-on-match filter rule fired and delivery was suppressed. */
  dropped: boolean
}

export async function receiveWebhook(
  incoming: IncomingWebhook,
  options?: ReceiveWebhookOptions,
): Promise<Result<ReceiveWebhookResult, AppError>> {
  // 1. Resolve endpoint
  const endpointResult = webhookEndpointRepository.findBySlug(incoming.slug)
  if (!endpointResult.isOk()) return err(endpointResult.error)
  if (!endpointResult.value)
    return err(new EndpointNotFoundError(incoming.slug))

  const endpoint = endpointResult.value

  // 2. Check enabled
  if (!endpoint.enabled) return err(new EndpointDisabledError(incoming.slug))

  // 3. Verify signature (skipped for test sends)
  if (!options?.skipSignatureVerification) {
    const sigResult = verifySignature(
      endpoint.signingScheme,
      endpoint.signingSecret,
      incoming.headers,
      incoming.body,
      {
        customSignatureHeader: endpoint.customSignatureHeader,
        customSignatureEncoding: endpoint.customSignatureEncoding,
      },
    )
    if (!sigResult.isOk()) return err(sigResult.error)
  }

  // 4. Load + evaluate filter rules
  const rulesResult = filterRuleRepository.listEnabledWithConditions(
    endpoint.id,
  )
  if (!rulesResult.isOk()) return err(rulesResult.error)

  const ctx: FilterContext = {
    headers: incoming.headers,
    body: incoming.body,
    query: incoming.query,
    method: incoming.method,
    sourceIp: incoming.sourceIp,
  }
  const filterResult = evaluateFilters(ctx, rulesResult.value)
  if (!filterResult.isOk()) return err(filterResult.error)

  const { matchedRule, drop } = filterResult.value

  // 5. Persist event
  const signatureValid = endpoint.signingScheme === "none" ? null : true
  const eventResult = webhookEventRepository.create({
    endpointId: endpoint.id,
    method: incoming.method,
    headers: incoming.headers,
    body: incoming.body,
    sourceIp: incoming.sourceIp,
    matchedRuleId: matchedRule?.id ?? null,
    signatureValid,
  })
  if (!eventResult.isOk()) return err(eventResult.error)

  const event = eventResult.value

  // 5b. Broadcast to WebSocket subscribers
  server.ws.publish(WS_EVENTS_TOPIC, {
    type: "event",
    data: {
      id: event.id,
      endpointId: event.endpointId,
      method: event.method,
      sourceIp: event.sourceIp ?? null,
      signingScheme: endpoint.signingScheme,
      signatureVerified: event.signatureValid ?? false,
      receivedAt: event.receivedAt.toISOString(),
    },
  })
  // 6. Skip delivery if the matched rule blocks the event
  if (drop) return ok({ event, dropped: true })

  // 7. Enqueue to enabled delivery targets
  const targetsResult = deliveryTargetRepository.listEnabledByEndpoint(
    endpoint.id,
  )
  if (!targetsResult.isOk()) return err(targetsResult.error)

  if (targetsResult.value.length > 0) {
    const enqueueResult = enqueueDeliveries(event, targetsResult.value)
    if (!enqueueResult.isOk()) return err(enqueueResult.error)
  }

  return ok({ event, dropped: false })
}
