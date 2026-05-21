import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { foreignId, primaryId, timestamps } from "./_helpers"
import { webhookEndpoints } from "./webhook-endpoints.schema"

/**
 * Outbound signing schemes for re-signing forwarded payloads.
 *
 * Useful when the downstream service expects a different signature scheme
 * than the inbound one (signature transformation).
 */
export const OUTBOUND_SIGNING_SCHEMES = [
  "none",
  "hmac_sha256",
  "hmac_sha1",
] as const

export type OutboundSigningScheme = (typeof OUTBOUND_SIGNING_SCHEMES)[number]

/**
 * A delivery target is an outbound URL that receives filtered webhook events.
 *
 * Each target belongs to exactly one endpoint and can have independent
 * retry, throttle, and signature transformation settings.
 */
export const deliveryTargets = sqliteTable("delivery_targets", {
  id: primaryId(),
  endpointId: foreignId("endpoint_id", () => webhookEndpoints.id, {
    onDelete: "cascade",
  }).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  maxRetries: integer("max_retries").notNull().default(3),
  retryBackoffSeconds: integer("retry_backoff_seconds").notNull().default(60),
  throttleRps: integer("throttle_rps"),
  outboundSigningScheme: text("outbound_signing_scheme")
    .$type<OutboundSigningScheme>()
    .notNull()
    .default("none"),
  outboundSigningSecret: text("outbound_signing_secret"),
  headers: text("headers", { mode: "json" }).$type<Record<string, string>>(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  isTest: integer("is_test", { mode: "boolean" }).notNull().default(false),
  ...timestamps(),
})

export type DeliveryTarget = typeof deliveryTargets.$inferSelect
export type NewDeliveryTarget = typeof deliveryTargets.$inferInsert
