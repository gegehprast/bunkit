import { err, ok, type Result } from "@bunkit/result"
import { z } from "zod"
import { config } from "@/config"
import { type AppError, toAppError } from "@/core/errors"
import { logger } from "@/core/logger"
import { server } from "@/core/server"
import { closeDatabase, initDatabase } from "@/db/client"

export interface TestServer {
  start: () => Promise<Result<void, AppError>>
  stop: () => Promise<Result<void, AppError>>
  getBaseUrl: () => string
}

export async function createTestServer(): Promise<TestServer> {
  console.log("Creating test server...", config.PORT)
  const baseUrl = `http://localhost:${config.PORT || 3099}`
  let isStarted = false

  return {
    async start(): Promise<Result<void, AppError>> {
      if (isStarted) {
        return ok(undefined)
      }

      try {
        // Clear z.globalRegistry to avoid duplicate schema IDs
        z.globalRegistry.clear()

        // Load routes
        await import("@/routes")

        // Initialize database (will skip if already initialized)
        const initDbResult = await initDatabase()
        if (initDbResult.isErr()) {
          return err(initDbResult.error)
        }

        // Start server
        const serverStartResult = await server.start()
        if (serverStartResult.isErr()) {
          return err(toAppError(serverStartResult.error))
        }

        isStarted = true
        logger.info(`Test server started at ${baseUrl}`)
        return ok(undefined)
      } catch (error) {
        return err(toAppError(error))
      }
    },

    async stop(): Promise<Result<void, AppError>> {
      if (!isStarted) {
        return ok(undefined)
      }

      try {
        // Stop server
        const stopServerResult = await server.stop()
        if (stopServerResult.isErr()) {
          logger.error("Error stopping test server", {
            error: stopServerResult.error,
          })
        }

        // Close database
        const closeDbResult = await closeDatabase(logger)
        if (closeDbResult.isErr()) {
          logger.error("Error closing database", { error: closeDbResult.error })
        }

        isStarted = false
        logger.info("Test server stopped")
        return ok(undefined)
      } catch (error) {
        return err(toAppError(error))
      }
    },

    getBaseUrl(): string {
      return baseUrl
    },
  }
}
