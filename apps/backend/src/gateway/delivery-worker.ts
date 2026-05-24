import { DELIVERY_DEFAULTS } from "@/config/constants"
import { logger } from "@/core/logger"
import { deliveryAttemptRepository } from "@/db/repositories/delivery-attempt-repository"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { webhookEventRepository } from "@/db/repositories/webhook-event-repository"
import type { DeliveryAttempt, DeliveryTarget } from "@/db/schemas"
import { buildOutboundHeaders } from "./signature-transformer"

const workerLogger = logger.child({ component: "DeliveryWorker" })

/**
 * Background delivery worker.
 *
 * Polls the database for pending/retrying delivery attempts and
 * dispatches them to their targets via HTTP POST.
 *
 * Retry strategy:
 * - On non-2xx or network error, the attempt transitions to `retrying`
 *   with `nextRetryAt = now + (backoffSeconds × attemptNumber)`.
 * - Once `attemptNumber` reaches the target's `maxRetries`, the attempt
 *   is moved to `dlq` (dead-letter queue) instead.
 *
 * Usage:
 * ```ts
 * deliveryWorker.start()   // call once at app startup
 * deliveryWorker.stop()    // call during graceful shutdown
 * ```
 */
export class DeliveryWorker {
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false

  public start(): void {
    if (this.running) return
    this.running = true
    workerLogger.info("Delivery worker started")
    this.scheduleNext()
  }

  public stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    workerLogger.info("Delivery worker stopped")
  }

  private scheduleNext(): void {
    this.timer = setTimeout(async () => {
      await this.poll()
      if (this.running) this.scheduleNext()
    }, DELIVERY_DEFAULTS.WORKER_POLL_INTERVAL_MS)
  }

  private async poll(): Promise<void> {
    const dueResult = deliveryAttemptRepository.listDue()
    if (!dueResult.isOk()) {
      workerLogger.warn("Failed to fetch due delivery attempts", {
        error: dueResult.error.message,
      })
      return
    }

    const due = dueResult.value
    if (due.length === 0) return

    workerLogger.debug(`Processing ${due.length} due delivery attempt(s)`)
    await Promise.allSettled(due.map((attempt) => this.deliver(attempt)))
  }

  private async deliver(attempt: DeliveryAttempt): Promise<void> {
    const eventResult = webhookEventRepository.findById(attempt.eventId)
    if (!eventResult.isOk() || !eventResult.value) {
      workerLogger.warn("Event not found for delivery attempt", {
        attemptId: attempt.id,
        eventId: attempt.eventId,
      })
      return
    }

    const targetResult = deliveryTargetRepository.findById(attempt.targetId)
    if (!targetResult.isOk() || !targetResult.value) {
      workerLogger.warn("Target not found for delivery attempt", {
        attemptId: attempt.id,
        targetId: attempt.targetId,
      })
      return
    }

    const event = eventResult.value
    const target = targetResult.value

    const outboundExtra = buildOutboundHeaders(
      target.outboundSigningScheme,
      target.outboundSigningSecret,
      event.body,
      event.id,
    )

    const requestHeaders: Record<string, string> = {
      "content-type": "application/json",
      ...event.headers,
      ...(target.headers ?? {}),
      ...outboundExtra,
    }

    const startMs = Date.now()
    try {
      const response = await fetch(target.url, {
        method: "POST",
        headers: requestHeaders,
        body: event.body,
        signal: AbortSignal.timeout(DELIVERY_DEFAULTS.DELIVERY_TIMEOUT_MS),
      })
      const latencyMs = Date.now() - startMs
      const rawBody = await response.text().catch(() => "")
      const responseBody = rawBody.slice(
        0,
        DELIVERY_DEFAULTS.MAX_RESPONSE_BODY_BYTES,
      )

      if (response.ok) {
        deliveryAttemptRepository.updateStatus(attempt.id, "success", {
          responseStatus: response.status,
          responseBody,
          responseLatencyMs: latencyMs,
        })
        workerLogger.debug("Delivery succeeded", {
          attemptId: attempt.id,
          status: response.status,
          latencyMs,
        })
      } else {
        this.handleFailure(attempt, target, {
          responseStatus: response.status,
          responseBody,
          responseLatencyMs: latencyMs,
          errorMessage: `HTTP ${response.status}`,
        })
      }
    } catch (error) {
      const latencyMs = Date.now() - startMs
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.handleFailure(attempt, target, {
        responseLatencyMs: latencyMs,
        errorMessage,
      })
    }
  }

  private handleFailure(
    attempt: DeliveryAttempt,
    target: DeliveryTarget,
    patch: {
      responseStatus?: number
      responseBody?: string
      responseLatencyMs?: number
      errorMessage?: string
    },
  ): void {
    const maxRetries = target.maxRetries ?? DELIVERY_DEFAULTS.MAX_RETRIES
    const backoffSeconds =
      target.retryBackoffSeconds ?? DELIVERY_DEFAULTS.RETRY_BACKOFF_SECONDS

    if (attempt.attemptNumber >= maxRetries) {
      deliveryAttemptRepository.updateStatus(attempt.id, "dlq", patch)
      workerLogger.warn("Delivery attempt moved to DLQ", {
        attemptId: attempt.id,
        targetId: attempt.targetId,
        attempts: attempt.attemptNumber,
      })
    } else {
      const nextRetryAt = new Date(
        Date.now() + backoffSeconds * attempt.attemptNumber * 1000,
      )
      deliveryAttemptRepository.updateStatus(attempt.id, "retrying", {
        ...patch,
        attemptNumber: attempt.attemptNumber + 1,
        nextRetryAt,
      })
      workerLogger.debug("Delivery attempt scheduled for retry", {
        attemptId: attempt.id,
        nextAttempt: attempt.attemptNumber + 1,
        nextRetryAt: nextRetryAt.toISOString(),
      })
    }
  }
}

export const deliveryWorker = new DeliveryWorker()
