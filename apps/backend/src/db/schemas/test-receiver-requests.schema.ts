import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { foreignId, primaryId, timestamps } from "./_helpers"
import { testReceivers } from "./test-receivers.schema"

/**
 * A single HTTP request captured by a test receiver.
 *
 * Stores the full inbound request as sent by the delivery worker so the
 * user can verify headers, signature, body transformation, etc.
 */
export const testReceiverRequests = sqliteTable("test_receiver_requests", {
  id: primaryId(),
  receiverId: foreignId("receiver_id", () => testReceivers.id, {
    onDelete: "cascade",
  }).notNull(),
  method: text("method").notNull(),
  headers: text("headers", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull(),
  body: text("body").notNull().default(""),
  receivedAt: integer("received_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  ...timestamps(),
})

export type TestReceiverRequest = typeof testReceiverRequests.$inferSelect
export type NewTestReceiverRequest = typeof testReceiverRequests.$inferInsert
