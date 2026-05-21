import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { foreignId, primaryId, timestamps } from "./_helpers"
import { filterRules } from "./filter-rules.schema"
import { webhookEndpoints } from "./webhook-endpoints.schema"

/**
 * A webhook event is an inbound HTTP request received on a webhook endpoint.
 *
 * The full request metadata (headers, body, source IP) is captured for replay
 * and audit purposes.  `matchedRuleId` records which filter rule allowed the
 * event through (null = no rule matched / default pass-through).
 *
 * `body` is stored as raw text to preserve the original bytes for signature
 * re-verification during replay.
 */
export const webhookEvents = sqliteTable("webhook_events", {
  id: primaryId(),
  endpointId: foreignId("endpoint_id", () => webhookEndpoints.id, {
    onDelete: "cascade",
  }).notNull(),
  method: text("method").notNull(),
  headers: text("headers", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull(),
  body: text("body").notNull().default(""),
  sourceIp: text("source_ip"),
  receivedAt: integer("received_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  matchedRuleId: foreignId("matched_rule_id", () => filterRules.id),
  signatureValid: integer("signature_valid", { mode: "boolean" }),
  ...timestamps(),
})

export type WebhookEvent = typeof webhookEvents.$inferSelect
export type NewWebhookEvent = typeof webhookEvents.$inferInsert
