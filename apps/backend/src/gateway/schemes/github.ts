import { err, ok, type Result } from "@bunkit/result"
import { WEBHOOK_HEADERS } from "@/config/constants"
import { SignatureInvalidError, SignatureMissingError } from "@/core/errors"
import { hmacHex, safeEqual } from "./_crypto"
/**
 * Expects `x-hub-signature-256: sha256=<hex>`
 */
export function verifyGithub(
  secret: string,
  headers: Record<string, string>,
  body: string,
): Result<void, SignatureMissingError | SignatureInvalidError> {
  const header = headers[WEBHOOK_HEADERS.GITHUB_SIGNATURE]
  if (!header)
    return err(new SignatureMissingError(WEBHOOK_HEADERS.GITHUB_SIGNATURE))
  const expected = `sha256=${hmacHex("sha256", secret, body)}`
  if (!safeEqual(header, expected))
    return err(new SignatureInvalidError("GitHub signature mismatch"))
  return ok(undefined)
}
