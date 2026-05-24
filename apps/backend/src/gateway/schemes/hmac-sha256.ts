import { err, ok, type Result } from "@bunkit/result"
import { WEBHOOK_HEADERS } from "@/config/constants"
import { SignatureInvalidError, SignatureMissingError } from "@/core/errors"
import { hmacHex, safeEqual } from "./_crypto"
/**
 * Expects `x-webhook-signature: sha256=<hex>`
 */
export function verifyHmacSha256(
  secret: string,
  headers: Record<string, string>,
  body: string,
): Result<void, SignatureMissingError | SignatureInvalidError> {
  const header = headers[WEBHOOK_HEADERS.GENERIC_SIGNATURE]
  if (!header)
    return err(new SignatureMissingError(WEBHOOK_HEADERS.GENERIC_SIGNATURE))
  const expected = `sha256=${hmacHex("sha256", secret, body)}`
  if (!safeEqual(header, expected))
    return err(new SignatureInvalidError("HMAC-SHA256 signature mismatch"))
  return ok(undefined)
}
