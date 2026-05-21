import type { Result } from "@bunkit/result"
import { eq } from "drizzle-orm"
import type { DatabaseError } from "@/core/errors"
import {
  type DeliveryTarget,
  deliveryTargets,
  type NewDeliveryTarget,
} from "@/db/schemas"
import { BaseRepository } from "./base-repository"

export class DeliveryTargetRepository extends BaseRepository {
  public create(
    data: NewDeliveryTarget,
  ): Result<DeliveryTarget, DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.insert(deliveryTargets).values(data).returning().get(),
      "Failed to create delivery target",
    )
  }

  public findById(id: string): Result<DeliveryTarget | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(deliveryTargets)
          .where(eq(deliveryTargets.id, id))
          .get() ?? null,
      "Failed to find delivery target by ID",
    )
  }

  /** List all targets for a given endpoint, enabled or not. */
  public listByEndpoint(
    endpointId: string,
  ): Result<DeliveryTarget[], DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(deliveryTargets)
          .where(eq(deliveryTargets.endpointId, endpointId))
          .all(),
      "Failed to list delivery targets for endpoint",
    )
  }

  /** List only enabled targets for a given endpoint — used by the delivery worker. */
  public listEnabledByEndpoint(
    endpointId: string,
  ): Result<DeliveryTarget[], DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(deliveryTargets)
          .where(eq(deliveryTargets.endpointId, endpointId))
          .all()
          .filter((t) => t.enabled),
      "Failed to list enabled delivery targets for endpoint",
    )
  }

  public update(
    id: string,
    data: Partial<Omit<DeliveryTarget, "id" | "endpointId" | "createdAt">>,
  ): Result<DeliveryTarget | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .update(deliveryTargets)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(deliveryTargets.id, id))
          .returning()
          .get() ?? null,
      "Failed to update delivery target",
    )
  }

  public delete(id: string): Result<void, DatabaseError> {
    return this.wrapQuerySync(() => {
      this.db.delete(deliveryTargets).where(eq(deliveryTargets.id, id)).run()
    }, "Failed to delete delivery target")
  }
}

export const deliveryTargetRepository = new DeliveryTargetRepository()
