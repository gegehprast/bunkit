import { Database as BunDatabase } from "bun:sqlite"
import { mkdir } from "node:fs/promises"
import path, { dirname } from "node:path"
import { err, ok, type Result } from "@bunkit/result"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { config } from "@/config"
import { APP_ASSETS_DIR } from "@/config/app-root"
import { DatabaseError } from "@/core/errors"
import type { ILogger } from "@/core/logger"
import * as schema from "./schemas"

let db: BunSQLiteDatabase<typeof schema> | null = null
let sqliteClient: BunDatabase | null = null

export interface DatabaseOptions {
  readonly?: boolean
  safeIntegers?: boolean
}

export async function initDatabase(
  logger?: ILogger,
  options: DatabaseOptions = {},
): Promise<Result<BunSQLiteDatabase<typeof schema>, DatabaseError>> {
  try {
    if (db) {
      logger?.warn("Database already initialized")
      return ok(db)
    }

    logger?.debug("Initializing SQLite database", {
      path: config.DATABASE_PATH,
    })

    const dbPath = path.isAbsolute(config.DATABASE_PATH)
      ? config.DATABASE_PATH
      : path.resolve(APP_ASSETS_DIR, config.DATABASE_PATH)

    // Ensure the parent directory exists before opening the database
    await mkdir(dirname(dbPath), { recursive: true })

    sqliteClient = new BunDatabase(dbPath, {
      readonly: options.readonly ?? false,
      safeIntegers: options.safeIntegers ?? false,
    })

    // WAL mode for better concurrent read performance
    sqliteClient.run("PRAGMA journal_mode = WAL;")
    // SQLite disables foreign key constraints by default
    sqliteClient.run("PRAGMA foreign_keys = ON;")

    db = drizzle({
      client: sqliteClient,
      casing: "snake_case",
      schema,
    })

    logger?.info("✅ SQLite database initialized", {
      path: dbPath,
    })

    return ok(db)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to open database"

    logger?.error("Database initialization failed", {
      error: message,
      path: config.DATABASE_PATH,
    })

    return err(
      new DatabaseError("Failed to initialize database", { error: message }),
    )
  }
}

export function getDatabase(): Result<
  BunSQLiteDatabase<typeof schema>,
  DatabaseError
> {
  if (!db) {
    return err(
      new DatabaseError("Database not initialized. Call initDatabase() first."),
    )
  }
  return ok(db)
}

export async function closeDatabase(
  logger?: ILogger,
): Promise<Result<void, DatabaseError>> {
  try {
    if (!sqliteClient) {
      logger?.warn("Database already closed or not initialized")
      return ok(undefined)
    }

    logger?.info("Closing SQLite database")

    sqliteClient.close()
    sqliteClient = null
    db = null

    logger?.info("SQLite database closed")

    return ok(undefined)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to close database"

    logger?.error("Failed to close database", {
      error: message,
    })

    return err(
      new DatabaseError("Failed to close database", {
        error: message,
      }),
    )
  }
}

export function isDatabaseConnected(): boolean {
  return db !== null && sqliteClient !== null
}

export function checkDatabaseHealth(
  logger?: ILogger,
): Result<boolean, DatabaseError> {
  try {
    if (!sqliteClient) {
      return err(new DatabaseError("Database not initialized"))
    }

    sqliteClient.exec("SELECT 1")

    return ok(true)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database health check failed"

    logger?.error("Database health check failed", {
      error: message,
    })

    return err(
      new DatabaseError("Database health check failed", {
        error: message,
      }),
    )
  }
}

/** For testing only — inject a pre-built database instance. */
export function _setTestDatabase(
  testDb: BunSQLiteDatabase<typeof schema>,
): void {
  db = testDb
}

/** For testing only — clear the injected database instance. */
export function _clearTestDatabase(): void {
  db = null
  sqliteClient = null
}

export { schema }
export type Database = BunSQLiteDatabase<typeof schema>
