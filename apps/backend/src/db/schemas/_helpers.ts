import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core"
import { integer, text } from "drizzle-orm/sqlite-core"

/**
 * Primary key UUID column — generated via crypto.randomUUID()
 */
export function primaryId() {
  return text("id")
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey()
}

/**
 * Timestamp columns stored as Unix milliseconds (integer)
 *
 * Using `mode: "timestamp_ms"` lets Drizzle map them to/from Date objects
 * automatically while SQLite stores them as integers.
 */
export function timestamps() {
  return {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  }
}

/**
 * Foreign key UUID column (text) referencing another table's id column
 */
export function foreignId(
  columnName: string,
  reference: () => AnySQLiteColumn,
  options?: {
    onDelete?: "cascade" | "set null" | "restrict" | "no action"
    onUpdate?: "cascade" | "set null" | "restrict" | "no action"
  },
) {
  return text(columnName).references(reference, options)
}
