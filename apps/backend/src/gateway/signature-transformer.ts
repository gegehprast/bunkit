import { createHmac } from "node:crypto"
import { WEBHOOK_HEADERS } from "@/config/constants"
import type { OutboundSigningScheme } from "@/db/schemas"

/**
 * Build the extra headers to attach to an outbound delivery request.
 *
 * Always includes `x-hookitup-event-id` so the downstream service can
 * correlate the delivery to the original event.
 *
 * When the target has an outbound signing scheme and a secret configured,
 * also adds `x-hookitup-signature: <algorithm>=<hex>`.
 */
export function buildOutboundHeaders(
  scheme: OutboundSigningScheme,
  secret: string | null | undefined,
  body: string,
  eventId: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    [WEBHOOK_HEADERS.HOOKITUP_EVENT_ID]: eventId,
  }

  if (scheme !== "none" && secret) {
    const algorithm = scheme === "hmac_sha256" ? "sha256" : "sha1"
    const hex = createHmac(algorithm, secret).update(body).digest("hex")
    headers[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE] = `${algorithm}=${hex}`
  }

  return headers
}
