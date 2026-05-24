import { err, ok, type Result } from "@bunkit/result"
import { WEBHOOK_HEADERS } from "@/config/constants"
import { SignatureInvalidError, SignatureMissingError } from "@/core/errors"
import { hmacHex, safeEqual } from "./_crypto"
/**
 * Expects `stripe-signature: t=<timestamp>,v1=<hex>[,v1=<hex>…]`
 *
 * Stripe can include multiple `v1` values during key rotation — any matching
 * signature is accepted.
 */
export function verifyStripe(
  secret: string,
  headers: Record<string, string>,
  body: string,
): Result<void, SignatureMissingError | SignatureInvalidError> {
  const header = headers[WEBHOOK_HEADERS.STRIPE_SIGNATURE]
  if (!header)
    return err(new SignatureMissingError(WEBHOOK_HEADERS.STRIPE_SIGNATURE))

  const parts = header.split(",")
  const timestampPart = parts.find((p) => p.startsWith("t="))
  if (!timestampPart)
    return err(
      new SignatureInvalidError(
        "Stripe signature header missing timestamp component",
      ),
    )

  const timestamp = timestampPart.slice(2)
  const signedPayload = `${timestamp}.${body}`
  const expectedHex = hmacHex("sha256", secret, signedPayload)

  const v1Sigs = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3))
  const valid = v1Sigs.some((sig) => safeEqual(sig, expectedHex))
  if (!valid) return err(new SignatureInvalidError("Stripe signature mismatch"))
  return ok(undefined)
}
