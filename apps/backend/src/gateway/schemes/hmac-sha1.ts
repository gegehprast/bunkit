import { err, ok, type Result } from "@bunkit/result"
import { WEBHOOK_HEADERS } from "@/config/constants"
import { SignatureInvalidError, SignatureMissingError } from "@/core/errors"
import { hmacHex, safeEqual } from "./_crypto"
/**
 * Expects `x-webhook-signature: sha1=<hex>`
 */
export function verifyHmacSha1(
  secret: string,
  headers: Record<string, string>,
  body: string,
): Result<void, SignatureMissingError | SignatureInvalidError> {
  const header = headers[WEBHOOK_HEADERS.GENERIC_SIGNATURE]
  if (!header)
    return err(new SignatureMissingError(WEBHOOK_HEADERS.GENERIC_SIGNATURE))
  const expected = `sha1=${hmacHex("sha1", secret, body)}`
  if (!safeEqual(header, expected))
    return err(new SignatureInvalidError("HMAC-SHA1 signature mismatch"))
  return ok(undefined)
}
