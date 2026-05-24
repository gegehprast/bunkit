import { err, ok, type Result } from "@bunkit/result"
import { WEBHOOK_HEADERS } from "@/config/constants"
import { SignatureInvalidError, SignatureMissingError } from "@/core/errors"
import { hmacBytes, safeEqualBytes } from "./_crypto"
/**
 * Expects three headers: `svix-id`, `svix-timestamp`, `svix-signature`.
 *
 * The signing secret is base64-encoded and may be prefixed with `whsec_`.
 * Multiple space-separated `v1,<base64>` signatures are accepted (key rotation).
 */
export function verifySvix(
  secret: string,
  headers: Record<string, string>,
  body: string,
): Result<void, SignatureMissingError | SignatureInvalidError> {
  const msgId = headers[WEBHOOK_HEADERS.SVIX_MSG_ID]
  const timestamp = headers[WEBHOOK_HEADERS.SVIX_TIMESTAMP]
  const sigHeader = headers[WEBHOOK_HEADERS.SVIX_SIGNATURE]

  if (!msgId) return err(new SignatureMissingError(WEBHOOK_HEADERS.SVIX_MSG_ID))
  if (!timestamp)
    return err(new SignatureMissingError(WEBHOOK_HEADERS.SVIX_TIMESTAMP))
  if (!sigHeader)
    return err(new SignatureMissingError(WEBHOOK_HEADERS.SVIX_SIGNATURE))

  const rawSecret = secret.startsWith("whsec_") ? secret.slice(7) : secret
  const keyBytes = Buffer.from(rawSecret, "base64")
  const signedPayload = `${msgId}.${timestamp}.${body}`
  const expectedBytes = hmacBytes(keyBytes, signedPayload)

  const sigs = sigHeader
    .split(" ")
    .filter((p) => p.startsWith("v1,"))
    .map((p) => p.slice(3))

  const valid = sigs.some((sig) => {
    try {
      return safeEqualBytes(Buffer.from(sig, "base64"), expectedBytes)
    } catch {
      return false
    }
  })

  if (!valid) return err(new SignatureInvalidError("Svix signature mismatch"))
  return ok(undefined)
}
