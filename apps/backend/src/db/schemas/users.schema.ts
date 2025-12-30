/**
 * Users Schema
 *
 * Database schema for users table
 */

import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { primaryId, timestamps } from "./helpers"

/**
 * Users table
 *
 * Stores user account information including authentication credentials
 */
export const users = pgTable("users", {
  id: primaryId(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockoutUntil: timestamp("lockout_until"),
  ...timestamps(),
})

/**
 * Type exports for use in application code
 */
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
