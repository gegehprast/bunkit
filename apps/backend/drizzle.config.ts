import { defineConfig } from "drizzle-kit"

// Migrations use `postgres` library (dev dependency) for drizzle-kit compatibility
// Runtime database operations use Bun.sql via drizzle-orm/bun-sql
// See: https://github.com/drizzle-team/drizzle-orm/issues/4122
export default defineConfig({
  schema: "./src/db/schemas/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/bunkit",
  },
  verbose: true,
  strict: true,
  casing: "snake_case",
})
