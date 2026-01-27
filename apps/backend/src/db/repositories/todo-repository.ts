import type { Result } from "@bunkit/result"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { DatabaseError } from "@/core/errors"
import { type NewTodo, type Todo, todos } from "@/db/schemas/todos.schema"
import { BaseRepository, RepositoryErrors } from "./base-repository"

/**
 * Todo repository for database operations
 */
export class TodoRepository extends BaseRepository {
  /**
   * Find todo by ID
   */
  public async findById(
    id: string,
  ): Promise<Result<Todo | null, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db.query.todos.findFirst({
        where: eq(todos.id, id),
      })
      return result ?? null
    }, `${RepositoryErrors.FIND_BY_ID_FAILED}: ${id}`)
  }

  /**
   * Find all todos for a user
   */
  public async findByUserId(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      completed?: boolean
    },
  ): Promise<Result<Todo[], DatabaseError>> {
    return this.wrapQuery(async () => {
      const conditions = [eq(todos.userId, userId)]

      if (options?.completed !== undefined) {
        conditions.push(eq(todos.completed, options.completed))
      }

      let query = this.db
        .select()
        .from(todos)
        .where(and(...conditions))
        .orderBy(asc(todos.createdAt))

      if (options?.limit) {
        query = query.limit(options.limit) as typeof query
      }

      if (options?.offset) {
        query = query.offset(options.offset) as typeof query
      }

      return await query
    }, `${RepositoryErrors.FIND_MANY_FAILED}: user ${userId}`)
  }

  /**
   * Find all todos (admin/global)
   */
  public async findAll(options?: {
    limit?: number
    offset?: number
  }): Promise<Result<Todo[], DatabaseError>> {
    return this.wrapQuery(async () => {
      let query = this.db.select().from(todos).orderBy(desc(todos.createdAt))

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
   * Create new todo
   */
  public async create(data: NewTodo): Promise<Result<Todo, DatabaseError>> {
    return this.wrapQuery(async () => {
      const [todo] = await this.db
        .insert(todos)
        .values({
          ...data,
          completed: data.completed ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      if (!todo) {
        throw new Error("Failed to create todo - no record returned")
      }

      return todo
    }, RepositoryErrors.CREATE_FAILED)
  }

  /**
   * Update todo by ID
   */
  public async update(
    id: string,
    data: Partial<Omit<Todo, "id" | "userId" | "createdAt">>,
  ): Promise<Result<Todo, DatabaseError>> {
    return this.wrapQuery(async () => {
      const [todo] = await this.db
        .update(todos)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(todos.id, id))
        .returning()

      if (!todo) {
        throw new Error(`Todo not found: ${id}`)
      }

      return todo
    }, `${RepositoryErrors.UPDATE_FAILED}: ${id}`)
  }

  /**
   * Update todo by ID and verify ownership
   */
  public async updateByUserIdAndId(
    userId: string,
    id: string,
    data: Partial<Omit<Todo, "id" | "userId" | "createdAt">>,
  ): Promise<Result<Todo, DatabaseError>> {
    return this.wrapQuery(async () => {
      const [todo] = await this.db
        .update(todos)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning()

      if (!todo) {
        throw new Error(`Todo not found or access denied: ${id}`)
      }

      return todo
    }, `${RepositoryErrors.UPDATE_FAILED}: ${id} (user: ${userId})`)
  }

  /**
   * Toggle todo completion status
   */
  public async toggleCompleted(
    id: string,
  ): Promise<Result<Todo, DatabaseError>> {
    return this.wrapQuery(async () => {
      // First get current status
      const current = await this.db.query.todos.findFirst({
        where: eq(todos.id, id),
      })

      if (!current) {
        throw new Error(`Todo not found: ${id}`)
      }

      // Toggle it
      const [todo] = await this.db
        .update(todos)
        .set({
          completed: !current.completed,
          updatedAt: new Date(),
        })
        .where(eq(todos.id, id))
        .returning()

      if (!todo) {
        throw new Error(`Failed to toggle todo: ${id}`)
      }

      return todo
    }, `${RepositoryErrors.UPDATE_FAILED}: toggle ${id}`)
  }

  /**
   * Delete todo by ID
   */
  public async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .delete(todos)
        .where(eq(todos.id, id))
        .returning()

      return result.length > 0
    }, `${RepositoryErrors.DELETE_FAILED}: ${id}`)
  }

  /**
   * Delete todo by ID and verify ownership
   */
  public async deleteByUserIdAndId(
    userId: string,
    id: string,
  ): Promise<Result<boolean, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .delete(todos)
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning()

      return result.length > 0
    }, `${RepositoryErrors.DELETE_FAILED}: ${id} (user: ${userId})`)
  }

  /**
   * Delete all todos for a user
   */
  public async deleteAllByUserId(
    userId: string,
  ): Promise<Result<number, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .delete(todos)
        .where(eq(todos.userId, userId))
        .returning()

      return result.length
    }, `${RepositoryErrors.DELETE_FAILED}: all for user ${userId}`)
  }

  /**
   * Check if todo exists by ID
   */
  public async exists(id: string): Promise<Result<boolean, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(todos)
        .where(eq(todos.id, id))

      return (result[0]?.count ?? 0) > 0
    }, `${RepositoryErrors.EXISTS_FAILED}: ${id}`)
  }

  /**
   * Count todos for a user
   */
  public async countByUserId(
    userId: string,
    completed?: boolean,
  ): Promise<Result<number, DatabaseError>> {
    return this.wrapQuery(async () => {
      const conditions = [eq(todos.userId, userId)]

      if (completed !== undefined) {
        conditions.push(eq(todos.completed, completed))
      }

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(todos)
        .where(and(...conditions))

      return result[0]?.count ?? 0
    }, `${RepositoryErrors.COUNT_FAILED}: user ${userId}`)
  }

  /**
   * Count total todos
   */
  public async count(): Promise<Result<number, DatabaseError>> {
    return this.wrapQuery(async () => {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(todos)

      return result[0]?.count ?? 0
    }, RepositoryErrors.COUNT_FAILED)
  }
}

let todoRepository: TodoRepository | null = null

/**
 * Get todo repository instance
 */
export function getTodoRepository(): TodoRepository {
  if (!todoRepository) {
    todoRepository = new TodoRepository()
  }
  return todoRepository
}
