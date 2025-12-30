import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { sql as drizzleSql } from "drizzle-orm"
import { getDatabase, initDatabase } from "@/db/client"
import {
  getTodoRepository,
  type TodoRepository,
} from "@/db/repositories/todo-repository"
import {
  getUserRepository,
  type UserRepository,
} from "@/db/repositories/user-repository"
import type { NewTodo } from "@/db/schemas/todos.schema"

let todoRepo: TodoRepository
let userRepo: UserRepository
let testUserId: string

beforeAll(async () => {
  const initResult = await initDatabase()
  if (initResult.isErr()) {
    throw new Error(
      `Failed to initialize database: ${initResult.error.message}`,
    )
  }
})

beforeEach(async () => {
  const dbResult = getDatabase()
  if (dbResult.isErr()) {
    throw new Error("Failed to get database connection")
  }

  todoRepo = getTodoRepository()
  userRepo = getUserRepository()

  // Clean up
  await dbResult.value.execute(drizzleSql`DELETE FROM todos`)
  await dbResult.value.execute(drizzleSql`DELETE FROM users`)

  // Create a test user for todos
  const userResult = await userRepo.create({
    email: `test-${Date.now()}@example.com`,
    passwordHash: "$2b$10$test",
    name: "Test User",
  })

  if (userResult.isErr()) {
    throw new Error("Failed to create test user")
  }

  testUserId = userResult.value.id
})

afterEach(async () => {
  const dbResult = getDatabase()
  if (dbResult.isOk()) {
    await dbResult.value.execute(drizzleSql`DELETE FROM todos`)
    await dbResult.value.execute(drizzleSql`DELETE FROM users`)
  }
})

function createTodoData(overrides: Partial<NewTodo> = {}): NewTodo {
  return {
    userId: testUserId,
    title: "Test Todo",
    description: "Test description",
    completed: false,
    ...overrides,
  }
}

describe("TodoRepository", () => {
  describe("create", () => {
    test("should create todo successfully", async () => {
      const todoData = createTodoData()
      const result = await todoRepo.create(todoData)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.title).toBe("Test Todo")
        expect(result.value.userId).toBe(testUserId)
        expect(result.value.completed).toBe(false)
        expect(result.value.id).toBeDefined()
      }
    })

    test("should create todo with completed status", async () => {
      const todoData = createTodoData({ completed: true })
      const result = await todoRepo.create(todoData)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.completed).toBe(true)
      }
    })
  })

  describe("findById", () => {
    test("should find todo by id", async () => {
      const created = await todoRepo.create(createTodoData())
      if (created.isErr()) throw new Error("Setup failed")

      const result = await todoRepo.findById(created.value.id)

      expect(result.isOk()).toBe(true)
      if (result.isOk() && result.value) {
        expect(result.value.id).toBe(created.value.id)
      }
    })
  })

  describe("findByUserId", () => {
    test("should find todos for user", async () => {
      await todoRepo.create(createTodoData({ title: "Todo 1" }))
      await todoRepo.create(createTodoData({ title: "Todo 2" }))

      const result = await todoRepo.findByUserId(testUserId)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.length).toBe(2)
      }
    })

    test("should filter by completed status", async () => {
      await todoRepo.create(createTodoData({ completed: true }))
      await todoRepo.create(createTodoData({ completed: false }))

      const result = await todoRepo.findByUserId(testUserId, {
        completed: true,
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.length).toBe(1)
        expect(result.value[0]?.completed).toBe(true)
      }
    })

    test("should respect limit", async () => {
      await todoRepo.create(createTodoData())
      await todoRepo.create(createTodoData())
      await todoRepo.create(createTodoData())

      const result = await todoRepo.findByUserId(testUserId, { limit: 2 })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.length).toBe(2)
      }
    })
  })

  describe("update", () => {
    test("should update todo", async () => {
      const created = await todoRepo.create(createTodoData())
      if (created.isErr()) throw new Error("Setup failed")

      const result = await todoRepo.update(created.value.id, {
        title: "Updated Title",
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.title).toBe("Updated Title")
      }
    })
  })

  describe("toggleCompleted", () => {
    test("should toggle completion status", async () => {
      const created = await todoRepo.create(
        createTodoData({ completed: false }),
      )
      if (created.isErr()) throw new Error("Setup failed")

      const result = await todoRepo.toggleCompleted(created.value.id)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.completed).toBe(true)
      }
    })
  })

  describe("delete", () => {
    test("should delete todo", async () => {
      const created = await todoRepo.create(createTodoData())
      if (created.isErr()) throw new Error("Setup failed")

      const result = await todoRepo.delete(created.value.id)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(true)
      }
    })
  })

  describe("count", () => {
    test("should count todos", async () => {
      await todoRepo.create(createTodoData())
      await todoRepo.create(createTodoData())

      const result = await todoRepo.count()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(Number(result.value)).toBe(2)
      }
    })

    test("should count todos by user", async () => {
      await todoRepo.create(createTodoData())
      await todoRepo.create(createTodoData())

      const result = await todoRepo.countByUserId(testUserId)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(Number(result.value)).toBe(2)
      }
    })

    test("should count completed todos for user", async () => {
      await todoRepo.create(createTodoData({ completed: true }))
      await todoRepo.create(createTodoData({ completed: false }))

      const result = await todoRepo.countByUserId(testUserId, true)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(Number(result.value)).toBe(1)
      }
    })
  })
})
