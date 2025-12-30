import { createServer, SecuritySchemes } from "@bunkit/server"
import z from "zod"
import { config } from "@/config"
import { logger } from "@/core/logger"
import { shutdownManager } from "@/core/shutdown-manager"
import { closeDatabase, initDatabase } from "./db/client"

// Clear z.globalRegistry to avoid duplicate schema IDs on hot reload
// There must be a better way to handle this, but I just got no idea how to prevent
// re-registering duplicate schemas ID. See the createSchema function in schema-helpers.ts
z.globalRegistry.clear()

async function main() {
  // Import routes to register them with the route registry
  await import("@/routes/home.routes")
  await import("@/routes/static.routes")
  await import("@/routes/health.routes")
  await import("@/routes/docs.routes")
  await import("@/routes/auth.routes")
  await import("@/routes/todos.routes")

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

    const server = createServer({
      port: config.PORT,
      host: config.HOST,
      openapi: {
        title: "BunKit API",
        version: "1.0.0",
        description: "Production-ready HTTP API built with BunKit",
        securitySchemes: {
          bearerAuth: SecuritySchemes.bearerAuth(),
        },
      },
    })

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

    logger.info(`✅ App ready at http://${config.HOST}:${config.PORT}`)
  } catch (error) {
    logger.error("Failed to start application", { error })
    await shutdownManager.shutdown("ERROR")
    process.exit(1)
  }
}

main()
