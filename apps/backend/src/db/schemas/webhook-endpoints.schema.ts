import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { primaryId, timestamps } from "./_helpers"

/**
 * Signing schemes supported for verifying inbound webhook signatures.
 *
 * Use `"custom"` for any service not covered by the built-in schemes
 * (e.g. Shopify, WooCommerce, Linear, Vercel).  Configure
 * `customSignatureHeader` and `customSignatureEncoding` on the endpoint
 * to tell the verifier which header to read and how the value is encoded.
 */
export const SIGNING_SCHEMES = [
  "none",
  "hmac_sha256",
  "hmac_sha1",
  "stripe",
  "github",
  "svix",
  "custom",
] as const

export type SigningScheme = (typeof SIGNING_SCHEMES)[number]

/**
 * How the HMAC digest is encoded in the custom signature header.
 *
 * - `"hex"`     — raw lowercase hex string (Linear, Vercel, …)
 * - `"base64"`  — standard base64 string (Shopify, WooCommerce, …)
 * - `"hex_prefixed"` — `sha256=<hex>` format (LaunchDarkly, hookitup generic, …)
 */
export const CUSTOM_SIGNATURE_ENCODINGS = [
  "hex",
  "base64",
  "hex_prefixed",
] as const

export type CustomSignatureEncoding =
  (typeof CUSTOM_SIGNATURE_ENCODINGS)[number]

/**
 * A webhook endpoint is the inbound URL that external services POST to.
 *
 * Each endpoint has an optional signing secret used to verify the HMAC
 * signature on incoming requests.  `slug` is the URL path segment, e.g.
 * `/webhooks/{slug}`.
 *
 * When `signingScheme = "custom"`:
 * - `customSignatureHeader` — header name to read (e.g. `x-shopify-hmac-sha256`);
 *   falls back to `x-webhook-signature` if null.
 * - `customSignatureEncoding` — how the digest is encoded in the header value;
 *   defaults to `"hex"`.
 */
export const webhookEndpoints = sqliteTable("webhook_endpoints", {
  id: primaryId(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  signingScheme: text("signing_scheme")
    .$type<SigningScheme>()
    .notNull()
    .default("none"),
  signingSecret: text("signing_secret"),
  /** Only relevant when signingScheme = "custom". */
  customSignatureHeader: text("custom_signature_header"),
  /** Only relevant when signingScheme = "custom". Defaults to "hex". */
  customSignatureEncoding: text("custom_signature_encoding")
    .$type<CustomSignatureEncoding>()
    .default("hex"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps(),
})

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert
