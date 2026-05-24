import { z } from "zod"
import packageJson from "../../package.json"

const configSchema = z.object({
  // Application
  APP_NAME: z.string().default("hookitup"),
  APP_URL: z.string().default("http://localhost:3001"),
  VERSION: z.string(),

  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("localhost"),

  // HTTP Server
  HTTP_MAX_REQUEST_BODY_SIZE: z.coerce.number().default(10485760), // 10MB in bytes

  // CORS
  CORS_ORIGIN: z.string().default(
    `
      http://localhost:3000,
      http://localhost:3001,
      http://localhost:5173,
      http://localhost:4173,
      http://localhost:8080,
      http://127.0.0.1:3000,
      http://127.0.0.1:3001,
      http://127.0.0.1:5173,
      http://127.0.0.1:4173,
      http://127.0.0.1:8080
      `,
  ),

  // Database
  DATABASE_PATH: z.string().default("./data/gateway.db"),
  MIGRATIONS_DIR: z.string().default("./drizzle"),

  // Static files
  PUBLIC_DIR: z.string().default("./public"),
  FRONTEND_DIR: z.string().default("./webui"),

  // Logging
  LOG_LEVEL: z
    .enum(["none", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_DISABLED_COMPONENTS: z.string().default(""),

  // Shutdown
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(10000), // 10 seconds
})

export type Config = z.infer<typeof configSchema>

/**
 * Parse and validate environment variables
 */
function parseConfig(): Config {
  try {
    const parsed = configSchema.parse({
      ...process.env,
      VERSION: packageJson.version,
    })

    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid environment configuration:")
      for (const issue of error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`)
      }
      process.exit(1)
    }
    throw error
  }
}

/**
 * Application configuration (singleton)
 */
export const config = parseConfig()

/**
 * Check if running in development mode
 */
export const isDevelopment = config.NODE_ENV === "development"

/**
 * Check if running in production mode
 */
export const isProduction = config.NODE_ENV === "production"

/**
 * Check if running in test mode
 */
export const isTest = config.NODE_ENV === "test"
