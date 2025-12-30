import { config } from "@/config"
import type { ILogger } from "@/core/logger"
import { logger as defaultLogger } from "@/core/logger"

/**
 * Cleanup handler function type
 */
export type CleanupHandler = () => Promise<void> | void

/**
 * Shutdown manager for graceful application shutdown
 */
export class ShutdownManager {
  private cleanupHandlers: Array<{
    name: string
    handler: CleanupHandler
  }> = []
  private isShuttingDown = false
  private shutdownPromise: Promise<void> | null = null
  private logger: ILogger

  public constructor(logger: ILogger = defaultLogger) {
    this.logger = logger.child({ component: "ShutdownManager" })
  }

  /**
   * Register a cleanup handler
   */
  public onShutdown(name: string, handler: CleanupHandler): void {
    this.cleanupHandlers.push({ name, handler })
    this.logger.debug(`Registered cleanup handler: ${name}`)
  }

  /**
   * Check if shutdown is in progress
   */
  public isShuttingDownNow(): boolean {
    return this.isShuttingDown
  }

  /**
   * Initiate graceful shutdown
   */
  public async shutdown(signal: string): Promise<void> {
    // Prevent multiple shutdown calls
    if (this.isShuttingDown) {
      this.logger.warn("Shutdown already in progress")
      if (this.shutdownPromise) {
        return this.shutdownPromise
      }
      return
    }

    this.isShuttingDown = true
    this.logger.info(`Received ${signal}, starting graceful shutdown...`)

    this.shutdownPromise = this.executeShutdown()
    return this.shutdownPromise
  }

  /**
   * Execute shutdown with timeout
   */
  private async executeShutdown(): Promise<void> {
    const timeoutMs = config.SHUTDOWN_TIMEOUT_MS

    try {
      // Create shutdown promise
      const shutdownPromise = this.runCleanupHandlers()

      // Create timeout promise
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Shutdown timeout exceeded (${timeoutMs}ms), forcing exit`,
            ),
          )
        }, timeoutMs)
      })

      // Race between cleanup and timeout
      await Promise.race([shutdownPromise, timeoutPromise])

      this.logger.info("✅ Graceful shutdown completed successfully")
      process.exit(0)
    } catch (error) {
      this.logger.error("❌ Shutdown failed", {
        error: error instanceof Error ? error : new Error(String(error)),
      })
      process.exit(1)
    }
  }

  /**
   * Run all cleanup handlers in reverse order (LIFO)
   */
  private async runCleanupHandlers(): Promise<void> {
    const handlers = [...this.cleanupHandlers].reverse()

    this.logger.info(`Running ${handlers.length} cleanup handlers...`)

    for (const { name, handler } of handlers) {
      try {
        this.logger.debug(`Running cleanup: ${name}`)
        const startTime = Date.now()

        await handler()

        const duration = Date.now() - startTime
        this.logger.debug(`Completed cleanup: ${name} (${duration}ms)`)
      } catch (error) {
        this.logger.error(`Failed to cleanup: ${name}`, {
          error: error instanceof Error ? error : new Error(String(error)),
        })
        // Continue with other cleanup handlers even if one fails
      }
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  public setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"]

    for (const signal of signals) {
      process.on(signal, () => {
        this.shutdown(signal).catch((error) => {
          this.logger.error("Shutdown handler failed", { error })
          process.exit(1)
        })
      })
    }

    this.logger.debug("Signal handlers registered", { signals })
  }

  /**
   * Handle uncaught exceptions
   */
  public setupErrorHandlers(): void {
    process.on("uncaughtException", (error) => {
      this.logger.error("Uncaught exception", { error })
      this.shutdown("uncaughtException").catch(() => {
        process.exit(1)
      })
    })

    process.on("unhandledRejection", (reason) => {
      this.logger.error("Unhandled promise rejection", {
        error: reason instanceof Error ? reason : new Error(String(reason)),
      })
      this.shutdown("unhandledRejection").catch(() => {
        process.exit(1)
      })
    })

    this.logger.debug("Error handlers registered")
  }
}

/**
 * Global shutdown manager instance
 */
export const shutdownManager = new ShutdownManager()
