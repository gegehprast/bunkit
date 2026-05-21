import type { Result } from "@bunkit/result"
import { and, desc, eq, gt, lt, sql } from "drizzle-orm"
import type { DatabaseError } from "@/core/errors"
import {
  type NewWebhookEvent,
  type WebhookEvent,
  webhookEvents,
} from "@/db/schemas"
import { BaseRepository } from "./base-repository"

export interface ListEventsOptions {
  endpointId?: string
  /** Return only events received after this date */
  since?: Date
  /** Return only events received before this date */
  before?: Date
  limit?: number
  offset?: number
}

export class WebhookEventRepository extends BaseRepository {
  public create(data: NewWebhookEvent): Result<WebhookEvent, DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.insert(webhookEvents).values(data).returning().get(),
      "Failed to create webhook event",
    )
  }

  public findById(id: string): Result<WebhookEvent | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(webhookEvents)
          .where(eq(webhookEvents.id, id))
          .get() ?? null,
      "Failed to find webhook event by ID",
    )
  }

  public list(
    options: ListEventsOptions = {},
  ): Result<WebhookEvent[], DatabaseError> {
    return this.wrapQuerySync(() => {
      const conditions = []

      if (options.endpointId) {
        conditions.push(eq(webhookEvents.endpointId, options.endpointId))
      }
      if (options.since) {
        conditions.push(gt(webhookEvents.receivedAt, options.since))
      }
      if (options.before) {
        conditions.push(lt(webhookEvents.receivedAt, options.before))
      }

      const query = this.db
        .select()
        .from(webhookEvents)
        .orderBy(desc(webhookEvents.receivedAt))
        .limit(options.limit ?? 50)
        .offset(options.offset ?? 0)

      return conditions.length > 0
        ? query.where(and(...conditions)).all()
        : query.all()
    }, "Failed to list webhook events")
  }

  public count(
    options: Omit<ListEventsOptions, "limit" | "offset"> = {},
  ): Result<number, DatabaseError> {
    return this.wrapQuerySync(() => {
      const conditions = []

      if (options.endpointId) {
        conditions.push(eq(webhookEvents.endpointId, options.endpointId))
      }
      if (options.since) {
        conditions.push(gt(webhookEvents.receivedAt, options.since))
      }
      if (options.before) {
        conditions.push(lt(webhookEvents.receivedAt, options.before))
      }

      const query = this.db
        .select({ count: sql<number>`count(*)` })
        .from(webhookEvents)

      const row =
        conditions.length > 0
          ? query.where(and(...conditions)).get()
          : query.get()

      return row?.count ?? 0
    }, "Failed to count webhook events")
  }

  public delete(id: string): Result<void, DatabaseError> {
    return this.wrapQuerySync(() => {
      this.db.delete(webhookEvents).where(eq(webhookEvents.id, id)).run()
    }, "Failed to delete webhook event")
  }
}

export const webhookEventRepository = new WebhookEventRepository()
