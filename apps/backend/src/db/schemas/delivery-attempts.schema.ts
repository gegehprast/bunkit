import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { foreignId, primaryId, timestamps } from "./_helpers"
import { deliveryTargets } from "./delivery-targets.schema"
import { webhookEvents } from "./webhook-events.schema"

/**
 * Delivery statuses for a single attempt.
 *
 * - `pending`  — queued, not yet attempted
 * - `success`  — target responded with 2xx
 * - `failed`   — exhausted all retries, moved to DLQ
 * - `retrying` — waiting for next retry interval
 * - `dlq`      — permanently failed, in dead-letter queue
 */
export const DELIVERY_STATUSES = [
  "pending",
  "success",
  "failed",
  "retrying",
  "dlq",
] as const

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

/**
 * A delivery attempt records one HTTP POST to a delivery target for a given event.
 *
 * Multiple attempts can exist for the same (eventId, targetId) pair when retries
 * occur.  `isReplay` distinguishes user-initiated replays from automatic retries.
 * `originalAttemptId` links a replay attempt back to the first attempt for the event.
 * It is a plain text column (no FK constraint) to avoid circular references.
 */
export const deliveryAttempts = sqliteTable("delivery_attempts", {
  id: primaryId(),
  eventId: foreignId("event_id", () => webhookEvents.id, {
    onDelete: "cascade",
  }).notNull(),
  targetId: foreignId("target_id", () => deliveryTargets.id, {
    onDelete: "cascade",
  }).notNull(),
  status: text("status").$type<DeliveryStatus>().notNull().default("pending"),
  attemptNumber: integer("attempt_number").notNull().default(1),
  nextRetryAt: integer("next_retry_at", { mode: "timestamp_ms" }),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  responseLatencyMs: integer("response_latency_ms"),
  errorMessage: text("error_message"),
  isReplay: integer("is_replay", { mode: "boolean" }).notNull().default(false),
  // Plain text (no FK) to avoid circular self-reference TS issues
  originalAttemptId: text("original_attempt_id"),
  ...timestamps(),
})

export type DeliveryAttempt = typeof deliveryAttempts.$inferSelect
export type NewDeliveryAttempt = typeof deliveryAttempts.$inferInsert
