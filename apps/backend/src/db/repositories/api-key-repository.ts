import { err, ok, type Result } from "@bunkit/result"
import { eq } from "drizzle-orm"
import {
  ApiKeyDisabledError,
  ApiKeyExpiredError,
  ApiKeyInvalidError,
} from "@/core/errors"
import { type ApiKey, apiKeys, type NewApiKey } from "@/db/schemas"
import { BaseRepository } from "./base-repository"

export class ApiKeyRepository extends BaseRepository {
  /**
   * Insert a new API key record.
   * The caller is responsible for hashing the raw key before passing `keyHash`.
   */
  public create(
    data: NewApiKey,
  ): Result<ApiKey, ReturnType<typeof err>["error"]> {
    return this.wrapQuerySync(
      () => this.db.insert(apiKeys).values(data).returning().get(),
      "Failed to create API key",
    )
  }

  /** Find a key record by its SHA-256 hash — used during authentication. */
  public findByHash(
    keyHash: string,
  ): Result<ApiKey | null, ReturnType<typeof err>["error"]> {
    return this.wrapQuerySync(
      () =>
        this.db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.keyHash, keyHash))
          .get() ?? null,
      "Failed to find API key by hash",
    )
  }

  public findById(
    id: string,
  ): Result<ApiKey | null, ReturnType<typeof err>["error"]> {
    return this.wrapQuerySync(
      () =>
        this.db.select().from(apiKeys).where(eq(apiKeys.id, id)).get() ?? null,
      "Failed to find API key by ID",
    )
  }

  public listAll(): Result<ApiKey[], ReturnType<typeof err>["error"]> {
    return this.wrapQuerySync(
      () => this.db.select().from(apiKeys).all(),
      "Failed to list API keys",
    )
  }

  public updateLastUsed(
    id: string,
    lastUsedAt: Date,
  ): Result<void, ReturnType<typeof err>["error"]> {
    return this.wrapQuerySync(() => {
      this.db
        .update(apiKeys)
        .set({ lastUsedAt })
        .where(eq(apiKeys.id, id))
        .run()
    }, "Failed to update API key last used timestamp")
  }

  public delete(id: string): Result<void, ReturnType<typeof err>["error"]> {
    return this.wrapQuerySync(() => {
      this.db.delete(apiKeys).where(eq(apiKeys.id, id)).run()
    }, "Failed to delete API key")
  }

  /**
   * Validate a key by its hash and return the key record if it is active.
   * Returns a typed error if missing, expired, or disabled.
   */
  public validate(
    keyHash: string,
  ): Result<
    ApiKey,
    ApiKeyInvalidError | ApiKeyExpiredError | ApiKeyDisabledError
  > {
    const result = this.findByHash(keyHash)
    if (result.isErr()) {
      return err(new ApiKeyInvalidError())
    }

    const key = result.value
    if (!key) {
      return err(new ApiKeyInvalidError())
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      return err(new ApiKeyExpiredError())
    }

    if (!key.enabled) {
      return err(new ApiKeyDisabledError())
    }

    return ok(key)
  }
}

export const apiKeyRepository = new ApiKeyRepository()
