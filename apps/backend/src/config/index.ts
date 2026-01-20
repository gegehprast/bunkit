import { z } from "zod"
import packageJson from "../../package.json"

const DEFAULT_JWT_SECRET =
  "your-super-secret-jwt-key-min-32-chars-please-change-this-in-production"
const DEFAULT_JWT_REFRESH_SECRET =
  "your-super-secret-refresh-key-min-32-chars-please-change-this-in-production"

/**
 * Environment configuration schema with validation
 */
const configSchema = z.object({
  // Application
  APP_NAME: z.string().default("Bunkit"),
  VERSION: z.string(),

  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  MAX_REQUEST_BODY_SIZE: z.coerce.number().default(10485760), // 10MB in bytes

  // Database
  DATABASE_URL: z.string().default("postgresql://localhost:5432/bunkit_test"),

  // JWT
  JWT_SECRET: z.string().min(32).default(DEFAULT_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().default("7d"),
  JWT_REFRESH_SECRET: z.string().min(32).default(DEFAULT_JWT_REFRESH_SECRET),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // CORS
  CORS_ORIGIN: z
    .string()
    .default(
      "http://localhost:3000,http://localhost:5173,http://localhost:4173,http://localhost:8080",
    ),

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

    // On production, ensure JWT secrets are not default values
    if (parsed.NODE_ENV === "production") {
      if (
        parsed.JWT_SECRET === DEFAULT_JWT_SECRET ||
        parsed.JWT_REFRESH_SECRET === DEFAULT_JWT_REFRESH_SECRET
      ) {
        console.error(
          "❌ In production, JWT_SECRET and JWT_REFRESH_SECRET must be set to secure values.",
        )
        process.exit(1)
      }
    }
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
