import { err, ok, type Result } from "@bunkit/result"
import type { DatabaseError } from "@/core/errors"
import { deliveryAttemptRepository } from "@/db/repositories/delivery-attempt-repository"
import type {
  DeliveryAttempt,
  DeliveryTarget,
  WebhookEvent,
} from "@/db/schemas"

/**
 * Create a pending `DeliveryAttempt` row for each delivery target.
 *
 * All attempts are created with `status = "pending"` and
 * `nextRetryAt = now`, making them immediately eligible for pickup
 * by the delivery worker.
 *
 * Returns early with the first database error encountered.
 */
export function enqueueDeliveries(
  event: WebhookEvent,
  targets: DeliveryTarget[],
): Result<DeliveryAttempt[], DatabaseError> {
  const attempts: DeliveryAttempt[] = []
  const now = new Date()

  for (const target of targets) {
    const result = deliveryAttemptRepository.create({
      eventId: event.id,
      targetId: target.id,
      status: "pending",
      attemptNumber: 1,
      nextRetryAt: now,
    })

    if (!result.isOk()) return err(result.error)
    attempts.push(result.value)
  }

  return ok(attempts)
}
