import path from "node:path"
import { err, ok, type Result } from "@bunkit/result"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { config } from "@/config"
import { APP_ASSETS_DIR } from "@/config/app-root"
import { DatabaseError } from "@/core/errors"
import type { ILogger } from "@/core/logger"
import { getDatabase } from "@/db/client"

/**
 * Run Drizzle migrations against the initialized database.
 * Reads migration files from MIGRATIONS_DIR (default: ./drizzle, relative to app assets dir).
 *
 * Must be called after initDatabase().
 */
export function runMigrations(logger?: ILogger): Result<void, DatabaseError> {
  const dbResult = getDatabase()
  if (dbResult.isErr()) return err(dbResult.error)

  const migrationsFolder = path.isAbsolute(config.MIGRATIONS_DIR)
    ? config.MIGRATIONS_DIR
    : path.resolve(APP_ASSETS_DIR, config.MIGRATIONS_DIR)

  try {
    logger?.debug("Running database migrations", { migrationsFolder })
    migrate(dbResult.value, { migrationsFolder })
    logger?.info("✅ Database migrations applied", { migrationsFolder })
    return ok(undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed"
    logger?.error("Database migration failed", {
      error: message,
      migrationsFolder,
    })
    return err(new DatabaseError("Migration failed", { error: message }))
  }
}
