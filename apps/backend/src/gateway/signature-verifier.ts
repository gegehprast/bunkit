import { err, ok, type Result } from "@bunkit/result"
import {
  SignatureInvalidError,
  type SignatureMissingError,
} from "@/core/errors"
import type { CustomSignatureEncoding, SigningScheme } from "@/db/schemas"
import { verifyCustom } from "./schemes/custom"
import { verifyGithub } from "./schemes/github"
import { verifyHmacSha1 } from "./schemes/hmac-sha1"
import { verifyHmacSha256 } from "./schemes/hmac-sha256"
import { verifyStripe } from "./schemes/stripe"
import { verifySvix } from "./schemes/svix"

export type SignatureVerifyError = SignatureMissingError | SignatureInvalidError

export interface VerifySignatureOptions {
  /**
   * Header name to read for `"custom"` scheme.
   * Defaults to `x-webhook-signature` when null/undefined.
   */
  customSignatureHeader?: string | null
  /**
   * Digest encoding used in the custom signature header value.
   * Defaults to `"hex"` when null/undefined.
   */
  customSignatureEncoding?: CustomSignatureEncoding | null
}

/**
 * Verify the inbound webhook signature for the given scheme.
 *
 * Dispatches to a per-scheme verifier in `./schemes/`.
 *
 * - `none`       — always passes
 * - `hmac_sha256`— `x-webhook-signature: sha256=<hex>`
 * - `hmac_sha1`  — `x-webhook-signature: sha1=<hex>`
 * - `github`     — `x-hub-signature-256: sha256=<hex>`
 * - `stripe`     — `stripe-signature: t=<ts>,v1=<hex>[,v1=<hex>…]`
 * - `svix`       — `svix-id` + `svix-timestamp` + `svix-signature`
 * - `custom`     — HMAC-SHA256 with configurable header + encoding
 */
export function verifySignature(
  scheme: SigningScheme,
  secret: string | null | undefined,
  headers: Record<string, string>,
  body: string,
  options: VerifySignatureOptions = {},
): Result<void, SignatureVerifyError> {
  if (scheme === "none") return ok(undefined)

  if (!secret) {
    return err(
      new SignatureInvalidError(
        "Endpoint has a signing scheme configured but no secret is set",
      ),
    )
  }

  switch (scheme) {
    case "hmac_sha256":
      return verifyHmacSha256(secret, headers, body)
    case "hmac_sha1":
      return verifyHmacSha1(secret, headers, body)
    case "github":
      return verifyGithub(secret, headers, body)
    case "stripe":
      return verifyStripe(secret, headers, body)
    case "svix":
      return verifySvix(secret, headers, body)
    case "custom":
      return verifyCustom(secret, headers, body, {
        headerName: options.customSignatureHeader,
        encoding: options.customSignatureEncoding,
      })
  }
}
