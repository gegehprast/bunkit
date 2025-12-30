import { err, ok, type Result } from "@bunkit/result"
import { SQL } from "bun"
import type { BunSQLDatabase } from "drizzle-orm/bun-sql"
import { drizzle } from "drizzle-orm/bun-sql"
import { config } from "@/config"
import { DatabaseError } from "@/core/errors"
import type { ILogger } from "@/core/logger"
import * as schema from "./schemas"

/**
 * Database connection instance
 */
let db: BunSQLDatabase<typeof schema> | null = null
let sqlClient: SQL | null = null

/**
 * Database client options
 */
export interface DatabaseOptions {
  /**
   * Enable read-only mode
   */
  readonly?: boolean
  /**
   * Enable safe integers mode
   */
  safeIntegers?: boolean
}

/**
 * Initialize database connection
 */
export async function initDatabase(
  logger?: ILogger,
  _options: DatabaseOptions = {},
): Promise<Result<BunSQLDatabase<typeof schema>, DatabaseError>> {
  try {
    if (db) {
      logger?.warn("Database already initialized")
      return ok(db)
    }

    logger?.debug("Initializing database connection", {
      host: new URL(config.DATABASE_URL).hostname,
      database: new URL(config.DATABASE_URL).pathname.slice(1),
    })

    // Create Bun SQL client
    sqlClient = new SQL(config.DATABASE_URL)

    // Create Drizzle instance
    db = drizzle({
      client: sqlClient,
      casing: "snake_case",
      schema: schema,
    })

    // Test connection with a simple query
    await sqlClient`SELECT 1`

    logger?.info("✅ Database connection established")

    return ok(db)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to connect to database"

    logger?.error("Database initialization failed", {
      error: message,
      databaseUrl: config.DATABASE_URL.replace(/:[^:@]+@/, ":***@"), // Hide password
    })

    return err(
      new DatabaseError("Failed to initialize database connection", {
        error: message,
      }),
    )
  }
}

/**
 * Get database instance
 */
export function getDatabase(): Result<
  BunSQLDatabase<typeof schema>,
  DatabaseError
> {
  if (!db) {
    return err(
      new DatabaseError("Database not initialized. Call initDatabase() first."),
    )
  }
  return ok(db)
}

/**
 * Close database connection
 */
export async function closeDatabase(
  logger?: ILogger,
): Promise<Result<void, DatabaseError>> {
  try {
    if (!sqlClient) {
      logger?.warn("Database connection already closed or not initialized")
      return ok(undefined)
    }

    logger?.info("Closing database connection")

    // Close Bun SQL client
    sqlClient.close()
    sqlClient = null
    db = null

    logger?.info("Database connection closed")

    return ok(undefined)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to close database"

    logger?.error("Failed to close database connection", {
      error: message,
    })

    return err(
      new DatabaseError("Failed to close database connection", {
        error: message,
      }),
    )
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return db !== null && sqlClient !== null
}

/**
 * Health check - test database connection
 */
export async function checkDatabaseHealth(
  logger?: ILogger,
): Promise<Result<boolean, DatabaseError>> {
  try {
    if (!sqlClient) {
      return err(new DatabaseError("Database not initialized"))
    }

    // Simple query to test connection
    await sqlClient`SELECT 1`

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

export { schema }
export type Database = BunSQLDatabase<typeof schema>
