import type { Result } from "@bunkit/result"
import { eq, sql } from "drizzle-orm"
import type { DatabaseError } from "@/core/errors"
import { type NewUser, type User, users } from "@/db/schemas/users.schema"
import { BaseRepository, RepositoryErrors } from "./base-repository"

/**
 * User repository for database operations
 */
export class UserRepository extends BaseRepository {
  /**
   * Find user by ID
   */
  public async findById(
    id: string,
  ): Promise<Result<User | null, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db.query.users.findFirst({
        where: eq(users.id, id),
      })
      return result ?? null
    }, `${RepositoryErrors.FIND_BY_ID_FAILED}: ${id}`)
  }

  /**
   * Find user by email
   */
  public async findByEmail(
    email: string,
  ): Promise<Result<User | null, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db.query.users.findFirst({
        where: eq(users.email, email),
      })
      return result ?? null
    }, `${RepositoryErrors.FIND_FAILED}: email ${email}`)
  }

  /**
   * Find all users
   */
  public async findAll(options?: {
    limit?: number
    offset?: number
  }): Promise<Result<User[], DatabaseError>> {
    return this.wrapQuery(async () => {
      let query = this.db.select().from(users)

      if (options?.limit) {
        query = query.limit(options.limit) as typeof query
      }

      if (options?.offset) {
        query = query.offset(options.offset) as typeof query
      }

      return await query
    }, RepositoryErrors.FIND_MANY_FAILED)
  }

  /**
   * Create new user
   */
  public async create(data: NewUser): Promise<Result<User, DatabaseError>> {
    return this.wrapQuery(async () => {
      const [user] = await this.db
        .insert(users)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      if (!user) {
        throw new Error("Failed to create user - no record returned")
      }

      return user
    }, RepositoryErrors.CREATE_FAILED)
  }

  /**
   * Update user by ID
   */
  public async update(
    id: string,
    data: Partial<Omit<User, "id" | "createdAt">>,
  ): Promise<Result<User, DatabaseError>> {
    return this.wrapQuery(async () => {
      const [user] = await this.db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning()

      if (!user) {
        throw new Error(`User not found: ${id}`)
      }

      return user
    }, `${RepositoryErrors.UPDATE_FAILED}: ${id}`)
  }

  /**
   * Delete user by ID
   */
  public async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .delete(users)
        .where(eq(users.id, id))
        .returning()

      return result.length > 0
    }, `${RepositoryErrors.DELETE_FAILED}: ${id}`)
  }

  /**
   * Check if user exists by ID
   */
  public async exists(id: string): Promise<Result<boolean, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.id, id))

      return (result[0]?.count ?? 0) > 0
    }, `${RepositoryErrors.EXISTS_FAILED}: ${id}`)
  }

  /**
   * Check if email exists
   */
  public async emailExists(
    email: string,
  ): Promise<Result<boolean, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.email, email))

      return (result[0]?.count ?? 0) > 0
    }, `${RepositoryErrors.EXISTS_FAILED}: email ${email}`)
  }

  /**
   * Count total users
   */
  public async count(): Promise<Result<number, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(users)

      return result[0]?.count ?? 0
    }, RepositoryErrors.COUNT_FAILED)
  }

  /**
   * Update user password
   */
  public async updatePassword(
    id: string,
    passwordHash: string,
  ): Promise<Result<User, DatabaseError>> {
    return this.update(id, { passwordHash })
  }

  /**
   * Increment failed login attempts
   */
  public async incrementFailedAttempts(
    id: string,
  ): Promise<Result<User, DatabaseError>> {
    return this.wrapQuery(async () => {
      const [user] = await this.db
        .update(users)
        .set({
          failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning()

      if (!user) {
        throw new Error(`User not found: ${id}`)
      }

      return user
    }, `${RepositoryErrors.UPDATE_FAILED}: increment failed attempts ${id}`)
  }

  /**
   * Reset failed login attempts
   */
  public async resetFailedAttempts(
    id: string,
  ): Promise<Result<User, DatabaseError>> {
    return this.update(id, {
      failedLoginAttempts: 0,
      lockoutUntil: null,
    })
  }

  /**
   * Lock account until specified time
   */
  public async lockAccount(
    id: string,
    lockoutUntil: Date,
  ): Promise<Result<User, DatabaseError>> {
    return this.update(id, { lockoutUntil })
  }

  /**
   * Check if account is currently locked
   */
  public isAccountLocked(user: User): boolean {
    if (!user.lockoutUntil) return false
    return user.lockoutUntil > new Date()
  }
}

let userRepository: UserRepository | null = null

/**
 * Get user repository instance
 */
export function getUserRepository(): UserRepository {
  if (!userRepository) {
    userRepository = new UserRepository()
  }
  return userRepository
}
