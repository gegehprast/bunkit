import { err, ok, type Result } from "@bunkit/result"
import { WEBHOOK_HEADERS } from "@/config/constants"
import { SignatureInvalidError, SignatureMissingError } from "@/core/errors"
import type { CustomSignatureEncoding } from "@/db/schemas"
import { hmacBase64, hmacHex, safeEqual } from "./_crypto"
export interface CustomSchemeOptions {
  /**
   * Header to read the signature from.
   * Defaults to `x-webhook-signature` when absent.
   */
  headerName?: string | null
  /**
   * How the HMAC-SHA256 digest is encoded in the header value.
   * Defaults to `"hex"` when absent.
   *
   * | Encoding       | Example value                            | Services              |
   * |----------------|------------------------------------------|-----------------------|
   * | `hex`          | `abc123…`                                | Linear, Vercel        |
   * | `base64`       | `abc+123=`                               | Shopify, WooCommerce  |
   * | `hex_prefixed` | `sha256=abc123…`                         | LaunchDarkly, generic |
   */
  encoding?: CustomSignatureEncoding | null
}

/**
 * HMAC-SHA256 verification with a configurable header name and digest encoding.
 * Used for any service not covered by the built-in named schemes.
 */
export function verifyCustom(
  secret: string,
  headers: Record<string, string>,
  body: string,
  options: CustomSchemeOptions = {},
): Result<void, SignatureMissingError | SignatureInvalidError> {
  const headerName = options.headerName ?? WEBHOOK_HEADERS.GENERIC_SIGNATURE
  const encoding = options.encoding ?? "hex"

  const headerValue = headers[headerName.toLowerCase()]
  if (!headerValue) return err(new SignatureMissingError(headerName))

  switch (encoding) {
    case "hex": {
      const expected = hmacHex("sha256", secret, body)
      if (!safeEqual(headerValue, expected))
        return err(
          new SignatureInvalidError(
            "Custom HMAC-SHA256 (hex) signature mismatch",
          ),
        )
      break
    }
    case "base64": {
      const expected = hmacBase64(secret, body)
      if (!safeEqual(headerValue, expected))
        return err(
          new SignatureInvalidError(
            "Custom HMAC-SHA256 (base64) signature mismatch",
          ),
        )
      break
    }
    case "hex_prefixed": {
      const expected = `sha256=${hmacHex("sha256", secret, body)}`
      if (!safeEqual(headerValue, expected))
        return err(
          new SignatureInvalidError(
            "Custom HMAC-SHA256 (hex_prefixed) signature mismatch",
          ),
        )
      break
    }
  }

  return ok(undefined)
}
