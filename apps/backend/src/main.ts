import { ok, type Result } from "@bunkit/result"
import z from "zod"
import { config } from "@/config"
import { logger } from "@/core/logger"
import { shutdownManager } from "@/core/shutdown-manager"
import { closeDatabase, initDatabase } from "./db/client"

// Clear z.globalRegistry to avoid duplicate schema IDs on hot reload
// There must be a better way to handle this, but I just got no idea how to prevent
// re-registering duplicate schemas ID. See the createSchema function in schema-helpers.ts
z.globalRegistry.clear()

/**
 * Import auto-generated file (created during build)
 * This file contains imports for all discovered routes and handlers
 */
try {
  // biome-ignore lint/suspicious/noTsIgnore: Using @ts-expect-error won't work when the file is present
  // @ts-ignore: Only available at build time
  await import("@/.autoloads.gen")
} catch (error) {
  console.error(error)
}

// Mock createServer function for demonstration purposes
function createServer() {
  return {
    async start(): Promise<Result<void, Error>> {
      logger.info("Server started")
      return ok(void 0)
    },
    async stop(): Promise<Result<void, Error>> {
      logger.info("Server stopped")
      return ok(void 0)
    },
  }
}

async function main() {
  try {
    logger.info("🚀 Starting BunKit Backend...")
    logger.debug("Environment configuration", {
      nodeEnv: config.NODE_ENV,
      port: config.PORT,
      host: config.HOST,
      logLevel: config.LOG_LEVEL,
    })

    logger.info("✅ Core services registered")

    // Setup graceful shutdown handlers
    shutdownManager.setupSignalHandlers()
    shutdownManager.setupErrorHandlers()

    const server = createServer()

    // Register cleanup handlers
    shutdownManager.onShutdown("main-cleanup", async () => {
      logger.info("Stopping server...")
      const stopServerResult = await server.stop()
      if (stopServerResult.isErr()) {
        logger.error("Error stopping server", { error: stopServerResult.error })
      }

      logger.debug("Closing database connection...")
      const closeDbResult = await closeDatabase(logger)
      if (closeDbResult.isErr()) {
        logger.error("Error closing database", { error: closeDbResult.error })
      }
    })

    // Initialize database connection
    const initDbResult = await initDatabase(logger)
    if (initDbResult.isErr()) {
      throw initDbResult.error
    }

    // Start the server
    const serverStartResult = await server.start()
    if (serverStartResult.isErr()) {
      throw serverStartResult.error
    }

    logger.info(`✅ App ready!`)
  } catch (error) {
    logger.error("Failed to start application", { error })
    await shutdownManager.shutdown("ERROR")
    process.exit(1)
  }
}

main()
