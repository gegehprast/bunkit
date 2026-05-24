import type { Result } from "@bunkit/result"
import { desc, eq } from "drizzle-orm"
import type { DatabaseError } from "@/core/errors"
import {
  type NewTestReceiver,
  type NewTestReceiverRequest,
  type TestReceiver,
  type TestReceiverRequest,
  testReceiverRequests,
  testReceivers,
} from "@/db/schemas"
import { BaseRepository } from "./base-repository"

export class TestReceiverRepository extends BaseRepository {
  // ---------------------------------------------------------------------------
  // Receivers
  // ---------------------------------------------------------------------------

  public create(data: NewTestReceiver): Result<TestReceiver, DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.insert(testReceivers).values(data).returning().get(),
      "Failed to create test receiver",
    )
  }

  public findById(id: string): Result<TestReceiver | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(testReceivers)
          .where(eq(testReceivers.id, id))
          .get() ?? null,
      "Failed to find test receiver by ID",
    )
  }

  public findByToken(
    token: string,
  ): Result<TestReceiver | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(testReceivers)
          .where(eq(testReceivers.token, token))
          .get() ?? null,
      "Failed to find test receiver by token",
    )
  }

  public findByTargetId(
    targetId: string,
  ): Result<TestReceiver | null, DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(testReceivers)
          .where(eq(testReceivers.targetId, targetId))
          .get() ?? null,
      "Failed to find test receiver by target ID",
    )
  }

  public listByEndpoint(
    endpointId: string,
  ): Result<TestReceiver[], DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(testReceivers)
          .where(eq(testReceivers.endpointId, endpointId))
          .all(),
      "Failed to list test receivers for endpoint",
    )
  }

  public delete(id: string): Result<void, DatabaseError> {
    return this.wrapQuerySync(() => {
      this.db.delete(testReceivers).where(eq(testReceivers.id, id)).run()
    }, "Failed to delete test receiver")
  }

  // ---------------------------------------------------------------------------
  // Captured requests
  // ---------------------------------------------------------------------------

  public createRequest(
    data: NewTestReceiverRequest,
  ): Result<TestReceiverRequest, DatabaseError> {
    return this.wrapQuerySync(
      () => this.db.insert(testReceiverRequests).values(data).returning().get(),
      "Failed to create test receiver request",
    )
  }

  public listRequests(
    receiverId: string,
    limit = 50,
  ): Result<TestReceiverRequest[], DatabaseError> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(testReceiverRequests)
          .where(eq(testReceiverRequests.receiverId, receiverId))
          .orderBy(desc(testReceiverRequests.receivedAt))
          .limit(limit)
          .all(),
      "Failed to list test receiver requests",
    )
  }

  public deleteRequests(receiverId: string): Result<void, DatabaseError> {
    return this.wrapQuerySync(() => {
      this.db
        .delete(testReceiverRequests)
        .where(eq(testReceiverRequests.receiverId, receiverId))
        .run()
    }, "Failed to delete test receiver requests")
  }
}

export const testReceiverRepository = new TestReceiverRepository()
