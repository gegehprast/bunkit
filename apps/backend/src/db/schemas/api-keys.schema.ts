import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { primaryId, timestamps } from "./_helpers"

/**
 * API keys for authenticating admin API requests.
 *
 * The actual key value is never stored in plaintext — only a SHA-256 hash
 * (`keyHash`) is persisted. The `keyPrefix` (first 8 chars) is stored for
 * display so users can identify their keys without exposing the secret.
 */
export const apiKeys = sqliteTable("api_keys", {
  id: primaryId(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  createdBy: text("created_by"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps(),
})

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
