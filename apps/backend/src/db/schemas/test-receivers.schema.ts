import { sqliteTable, text } from "drizzle-orm/sqlite-core"
import { foreignId, primaryId, timestamps } from "./_helpers"
import { deliveryTargets } from "./delivery-targets.schema"
import { webhookEndpoints } from "./webhook-endpoints.schema"

/**
 * A test receiver acts as an in-app capture endpoint for a delivery target.
 *
 * When a user creates a "Test Delivery Target", the gateway creates both:
 *   - A `DeliveryTarget` pointing at `/hooks/test/{token}` (on this app)
 *   - A `TestReceiver` record linking the token to that target
 *
 * Incoming requests to `/hooks/test/:token` are captured into
 * `test_receiver_requests` so the user can inspect exactly what the
 * delivery worker sent (headers, signing, transformed body, etc.).
 */
export const testReceivers = sqliteTable("test_receivers", {
  id: primaryId(),
  endpointId: foreignId("endpoint_id", () => webhookEndpoints.id, {
    onDelete: "cascade",
  }).notNull(),
  targetId: foreignId("target_id", () => deliveryTargets.id, {
    onDelete: "cascade",
  })
    .notNull()
    .unique(),
  token: text("token").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps(),
})

export type TestReceiver = typeof testReceivers.$inferSelect
export type NewTestReceiver = typeof testReceivers.$inferInsert
