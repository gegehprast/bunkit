import type { Result } from "@bunkit/result"
import { and, eq, inArray, lte, sql } from "drizzle-orm"
import type { DatabaseError } from "@/core/errors"
import {
  type DeliveryAttempt,
  type DeliveryStatus,
  deliveryAttempts,
  type NewDeliveryAttempt,
} from "@/db/schemas"
import { BaseRepository } from "./base-repository"

export interface ListAttemptsOptions {
  eventId?: string
  targetId?: string
  status?: DeliveryStatus | DeliveryStatus[]
  limit?: number
  offset?: number
}

export class DeliveryAttemptRepository extends BaseRepository {
  public create(
    data: NewDeliveryAttempt,
  ): Result<DeliveryAttempt, DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.insert(deliveryAttempts).values(data).returning().get(),
      "Failed to create delivery attempt",
    )
  }

  public findById(id: string): Result<DeliveryAttempt | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(deliveryAttempts)
          .where(eq(deliveryAttempts.id, id))
          .get() ?? null,
      "Failed to find delivery attempt by ID",
    )
  }

  public list(
    options: ListAttemptsOptions = {},
  ): Result<DeliveryAttempt[], DatabaseError> {
    return this.wrapQuerySync(() => {
      const conditions = []

      if (options.eventId) {
        conditions.push(eq(deliveryAttempts.eventId, options.eventId))
      }
      if (options.targetId) {
        conditions.push(eq(deliveryAttempts.targetId, options.targetId))
      }
      if (options.status) {
        const statuses = Array.isArray(options.status)
          ? options.status
          : [options.status]
        conditions.push(inArray(deliveryAttempts.status, statuses))
      }

      const query = this.db
        .select()
        .from(deliveryAttempts)
        .limit(options.limit ?? 100)
        .offset(options.offset ?? 0)

      return conditions.length > 0
        ? query.where(and(...conditions)).all()
        : query.all()
    }, "Failed to list delivery attempts")
  }

  /**
   * Fetch pending/retrying attempts whose `nextRetryAt` is in the past.
   * Called by the delivery worker on each poll cycle.
   */
  public listDue(limit = 50): Result<DeliveryAttempt[], DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(deliveryAttempts)
          .where(
            and(
              inArray(deliveryAttempts.status, ["pending", "retrying"]),
              lte(deliveryAttempts.nextRetryAt, new Date()),
            ),
          )
          .limit(limit)
          .all(),
      "Failed to list due delivery attempts",
    )
  }

  /** Count DLQ entries — used by dashboard summary stats. */
  public countByStatus(status: DeliveryStatus): Result<number, DatabaseError> {
    return this.wrapQuerySync(() => {
      const row = this.db
        .select({ count: sql<number>`count(*)` })
        .from(deliveryAttempts)
        .where(eq(deliveryAttempts.status, status))
        .get()
      return row?.count ?? 0
    }, "Failed to count delivery attempts by status")
  }

  public updateStatus(
    id: string,
    status: DeliveryStatus,
    patch?: Partial<
      Pick<
        DeliveryAttempt,
        | "nextRetryAt"
        | "responseStatus"
        | "responseBody"
        | "responseLatencyMs"
        | "errorMessage"
        | "attemptNumber"
      >
    >,
  ): Result<DeliveryAttempt | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .update(deliveryAttempts)
          .set({ status, updatedAt: new Date(), ...patch })
          .where(eq(deliveryAttempts.id, id))
          .returning()
          .get() ?? null,
      "Failed to update delivery attempt status",
    )
  }

  public delete(id: string): Result<void, DatabaseError> {
    return this.wrapQuerySync(() => {
      this.db.delete(deliveryAttempts).where(eq(deliveryAttempts.id, id)).run()
    }, "Failed to delete delivery attempt")
  }
}

export const deliveryAttemptRepository = new DeliveryAttemptRepository()
