import type { Result } from "@bunkit/result"
import { eq } from "drizzle-orm"
import type { DatabaseError } from "@/core/errors"
import {
  type NewWebhookEndpoint,
  type WebhookEndpoint,
  webhookEndpoints,
} from "@/db/schemas"
import { BaseRepository } from "./base-repository"

export class WebhookEndpointRepository extends BaseRepository {
  public create(
    data: NewWebhookEndpoint,
  ): Result<WebhookEndpoint, DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.insert(webhookEndpoints).values(data).returning().get(),
      "Failed to create webhook endpoint",
    )
  }

  public findById(id: string): Result<WebhookEndpoint | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(webhookEndpoints)
          .where(eq(webhookEndpoints.id, id))
          .get() ?? null,
      "Failed to find webhook endpoint by ID",
    )
  }

  /** Find by URL slug — used during inbound webhook ingestion. */
  public findBySlug(
    slug: string,
  ): Result<WebhookEndpoint | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(webhookEndpoints)
          .where(eq(webhookEndpoints.slug, slug))
          .get() ?? null,
      "Failed to find webhook endpoint by slug",
    )
  }

  public listAll(): Result<WebhookEndpoint[], DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.select().from(webhookEndpoints).all(),
      "Failed to list webhook endpoints",
    )
  }

  public update(
    id: string,
    data: Partial<Omit<WebhookEndpoint, "id" | "createdAt">>,
  ): Result<WebhookEndpoint | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .update(webhookEndpoints)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(webhookEndpoints.id, id))
          .returning()
          .get() ?? null,
      "Failed to update webhook endpoint",
    )
  }

  public delete(id: string): Result<void, DatabaseError> {
    return this.wrapQuerySync(() => {
      this.db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id)).run()
    }, "Failed to delete webhook endpoint")
  }
}

export const webhookEndpointRepository = new WebhookEndpointRepository()
