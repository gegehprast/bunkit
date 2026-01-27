import {
  type PgColumn,
  type PgTimestampConfig,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * Primary key UUID column with automatic random generation
 *
 * @example
 * ```ts
 * export const myTable = pgTable("my_table", {
 *   id: primaryId(),
 *   // ... other columns
 * })
 * ```
 */
export function primaryId() {
  return uuid("id").defaultRandom().primaryKey()
}

/**
 * Timestamp columns for tracking creation and updates
 *
 * Automatically sets createdAt and updatedAt with proper defaults
 *
 * @example
 * ```ts
 * export const myTable = pgTable("my_table", {
 *   id: primaryId(),
 *   // ... other columns
 *   ...timestamps({ withTimezone: true }),
 * })
 * ```
 */
export function timestamps(config?: PgTimestampConfig<"date">) {
  return {
    createdAt: timestamp("created_at", config).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", config).notNull().defaultNow(),
  }
}

/**
 * Foreign key UUID column that references another table
 *
 * @param columnName - The column name in the database
 * @param reference - Function returning the referenced table column
 * @param options - Optional configuration for the foreign key
 *
 * @example
 * ```ts
 * export const todos = pgTable("todos", {
 *   id: primaryId(),
 *   userId: foreignId("user_id", () => users.id, { onDelete: "cascade" }),
 *   // ... other columns
 * })
 * ```
 */
export function foreignId(
  columnName: string,
  reference: () => PgColumn,
  options?: {
    onDelete?: "cascade" | "set null" | "restrict" | "no action"
    onUpdate?: "cascade" | "set null" | "restrict" | "no action"
  },
) {
  return uuid(columnName).references(reference, options)
}
