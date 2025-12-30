/**
 * Todos Schema
 *
 * Database schema for todos table
 */

import { boolean, pgTable, text } from "drizzle-orm/pg-core"
import { foreignId, primaryId, timestamps } from "./helpers"
import { users } from "./users.schema"

/**
 * Todos table
 *
 * Stores todo items with user ownership and completion status
 */
export const todos = pgTable("todos", {
  id: primaryId(),
  userId: foreignId("user_id", () => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  completed: boolean("completed").notNull().default(false),
  ...timestamps(),
})

/**
 * Type exports for use in application code
 */
export type Todo = typeof todos.$inferSelect
export type NewTodo = typeof todos.$inferInsert
