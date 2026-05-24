/**
 * Test database helper — creates an in-memory SQLite database
 * with all migrations applied, isolated per test file.
 *
 * Usage:
 *   import { setupTestDb, teardownTestDb } from "@tests/helpers/test-db"
 *   beforeAll(setupTestDb)
 *   afterAll(teardownTestDb)
 */

import { Database } from "bun:sqlite"
import path from "node:path"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import * as schema from "@/db/schemas"

// Module-level reference — shared within a single test file's module scope
let _sqliteClient: Database | null = null

export async function setupTestDb(): Promise<void> {
  // In-memory DB — fresh per test process
  const sqlite = new Database(":memory:")
  sqlite.run("PRAGMA journal_mode = WAL;")
  sqlite.run("PRAGMA foreign_keys = ON;")

  _sqliteClient = sqlite

  const db = drizzle({ client: sqlite, casing: "snake_case", schema })

  const migrationsFolder = path.resolve(import.meta.dir, "../../drizzle")

  migrate(db, { migrationsFolder })

  // Inject the db instance into the module-level singleton used by repositories
  const { _setTestDatabase } = await import("@/db/client")
  _setTestDatabase(db)
}

export async function teardownTestDb(): Promise<void> {
  const { _clearTestDatabase } = await import("@/db/client")
  _clearTestDatabase()
  _sqliteClient?.close()
  _sqliteClient = null
}

export async function clearAllTables(): Promise<void> {
  const { getDatabase } = await import("@/db/client")
  const dbResult = getDatabase()
  if (!dbResult.isOk()) throw new Error("Database not initialized")
  const db = dbResult.value

  // Delete in reverse FK-dependency order.
  // Note: webhookEvents.matched_rule_id → filterRules.id (RESTRICT),
  // so webhookEvents must be deleted before filterRules.
  db.delete(schema.deliveryAttempts).run()
  db.delete(schema.deliveryTargets).run()
  db.delete(schema.filterConditions).run()
  db.delete(schema.webhookEvents).run()
  db.delete(schema.filterRules).run()
  db.delete(schema.webhookEndpoints).run()
  db.delete(schema.apiKeys).run()
}
