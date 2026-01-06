import type { Result } from "@bunkit/result"
import { err, ok } from "@bunkit/result"
import { DatabaseError } from "@/core/errors"
import { type Database, getDatabase } from "@/db/client"

/**
 * Base repository class with common database operation helpers
 */
export abstract class BaseRepository {
  protected get db(): Database {
    const dbResult = getDatabase()
    if (dbResult.isErr()) {
      throw new Error(dbResult.error.message)
    }
    return dbResult.value
  }

  /**
   * Wrap a database operation in Result pattern
   *
   * Catches any errors and converts them to DatabaseError
   */
  protected async wrapQuery<T>(
    operation: () => Promise<T>,
    errorMessage: string,
  ): Promise<Result<T, DatabaseError>> {
    try {
      const result = await operation()
      return ok(result)
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)

      return err(
        new DatabaseError(errorMessage, {
          error: details,
          stack: error instanceof Error ? error.stack : undefined,
        }),
      )
    }
  }

  /**
   * Wrap a synchronous database operation in Result pattern
   */
  protected wrapQuerySync<T>(
    operation: () => T,
    errorMessage: string,
  ): Result<T, DatabaseError> {
    try {
      const result = operation()
      return ok(result)
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)

      return err(
        new DatabaseError(errorMessage, {
          error: details,
          stack: error instanceof Error ? error.stack : undefined,
        }),
      )
    }
  }

  /**
   * Helper to check if a single result exists
   *
   * Returns NotFoundError if result is null/undefined
   */
  protected requireResult<T>(
    result: T | null | undefined,
    errorMessage: string,
  ): Result<T, DatabaseError> {
    if (result === null || result === undefined) {
      return err(new DatabaseError(errorMessage))
    }
    return ok(result)
  }

  /**
   * Helper for optional results (returns null instead of error)
   */
  protected optionalResult<T>(
    result: T | null | undefined,
  ): Result<T | null, DatabaseError> {
    return ok(result ?? null)
  }
}

/**
 * Repository error messages
 */
export const RepositoryErrors = {
  FIND_FAILED: "Failed to fetch record",
  FIND_BY_ID_FAILED: "Failed to fetch record by ID",
  FIND_MANY_FAILED: "Failed to fetch records",
  CREATE_FAILED: "Failed to create record",
  UPDATE_FAILED: "Failed to update record",
  DELETE_FAILED: "Failed to delete record",
  COUNT_FAILED: "Failed to count records",
  EXISTS_FAILED: "Failed to check existence",
} as const
