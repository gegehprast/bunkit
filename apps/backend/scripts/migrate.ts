#!/usr/bin/env bun

/**
 * Database Migration Script
 *
 * Runs Drizzle Kit migrations against a SQLite database file.
 * DATABASE_PATH defaults to ./data/gateway.db (relative to backend dir).
 *
 * Usage:
 *   bun run migrate               # uses DATABASE_PATH from .env
 *   DATABASE_PATH=./data/test.db bun run migrate
 */

import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"

async function main() {
  const backendDir = path.resolve(import.meta.dirname, "..")
  const dbPath =
    process.env.DATABASE_PATH ?? path.join(backendDir, "data", "gateway.db")

  const resolvedDbPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.resolve(backendDir, dbPath)

  // Ensure the directory for the database file exists
  mkdirSync(path.dirname(resolvedDbPath), { recursive: true })

  console.info(`🔄 Running migrations against: ${resolvedDbPath}`)

  const sqlite = new Database(resolvedDbPath)
  const db = drizzle({ client: sqlite, casing: "snake_case" })

  migrate(db, { migrationsFolder: path.join(backendDir, "drizzle") })

  sqlite.close()
  console.info("✅ Migrations applied successfully")
}

await main()
