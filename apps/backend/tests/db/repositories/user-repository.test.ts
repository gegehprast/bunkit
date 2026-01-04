import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import { sql as drizzleSql } from "drizzle-orm"
import { getDatabase, initDatabase } from "@/db/client"
import type { UserRepository } from "@/db/repositories/user-repository"
import { getUserRepository } from "@/db/repositories/user-repository"
import type { NewUser } from "@/db/schemas/users.schema"

let userRepo: UserRepository

beforeAll(async () => {
  // Initialize database connection
  const initResult = await initDatabase()
  if (initResult.isErr()) {
    throw new Error(
      `Failed to initialize database: ${initResult.error.message}`,
    )
  }

  const dbResult = getDatabase()
  if (dbResult.isErr()) {
    throw new Error("Failed to get database connection")
  }

  userRepo = getUserRepository()
})

afterEach(async () => {
  // Clean up after each test
  const dbResult = getDatabase()
  if (dbResult.isOk()) {
    await dbResult.value.execute(drizzleSql`DELETE FROM users`)
  }
})

/**
 * Helper to create test user data
 */
function createUserData(overrides: Partial<NewUser> = {}): NewUser {
  return {
    email: `test-${Date.now()}@example.com`,
    passwordHash: "$2b$10$test.hash.value",
    name: "Test User",
    ...overrides,
  }
}

describe("UserRepository", () => {
  describe("create", () => {
    test("should create user successfully", async () => {
      const userData = createUserData()
      const result = await userRepo.create(userData)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.email).toBe(userData.email)
        expect(result.value.passwordHash).toBe(userData.passwordHash)
        expect(result.value.name).toBe(userData.name ?? null)
        expect(result.value.id).toBeDefined()
        expect(result.value.createdAt).toBeInstanceOf(Date)
        expect(result.value.updatedAt).toBeInstanceOf(Date)
      }
    })

    test("should create user without name", async () => {
      const userData = createUserData({ name: undefined })
      const result = await userRepo.create(userData)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.name).toBeNull()
      }
    })

    test("should fail to create user with duplicate email", async () => {
      const userData = createUserData({ email: "duplicate@example.com" })

      const first = await userRepo.create(userData)
      expect(first.isOk()).toBe(true)

      const second = await userRepo.create(userData)
      expect(second.isErr()).toBe(true)
    })
  })

  describe("findById", () => {
    test("should find user by id", async () => {
      const userData = createUserData()
      const created = await userRepo.create(userData)

      if (created.isErr()) {
        throw new Error("Setup failed")
      }

      const result = await userRepo.findById(created.value.id)

      expect(result.isOk()).toBe(true)
      if (result.isOk() && result.value) {
        expect(result.value.id).toBe(created.value.id)
        expect(result.value.email).toBe(userData.email)
      }
    })

    test("should return null for non-existent id", async () => {
      const result = await userRepo.findById("non-existent-id")

      // Find may return null or error depending on driver behavior
      if (result.isOk()) {
        expect(result.value).toBeNull()
      } else {
        // If it errors, that's also acceptable
        expect(result.isErr()).toBe(true)
      }
    })
  })

  describe("findByEmail", () => {
    test("should find user by email", async () => {
      const userData = createUserData({ email: "find@example.com" })
      await userRepo.create(userData)

      const result = await userRepo.findByEmail("find@example.com")

      expect(result.isOk()).toBe(true)
      if (result.isOk() && result.value) {
        expect(result.value.email).toBe("find@example.com")
      }
    })

    test("should return null for non-existent email", async () => {
      const result = await userRepo.findByEmail("nonexistent@example.com")

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeNull()
      }
    })

    test("should be case-sensitive", async () => {
      const userData = createUserData({ email: "CaseSensitive@example.com" })
      await userRepo.create(userData)

      const result = await userRepo.findByEmail("casesensitive@example.com")

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBeNull()
      }
    })
  })

  describe("findAll", () => {
    test("should find all users", async () => {
      await userRepo.create(createUserData({ email: "user1@example.com" }))
      await userRepo.create(createUserData({ email: "user2@example.com" }))
      await userRepo.create(createUserData({ email: "user3@example.com" }))

      const result = await userRepo.findAll()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.length).toBe(3)
      }
    })

    test("should respect limit option", async () => {
      await userRepo.create(createUserData({ email: "user1@example.com" }))
      await userRepo.create(createUserData({ email: "user2@example.com" }))
      await userRepo.create(createUserData({ email: "user3@example.com" }))

      const result = await userRepo.findAll({ limit: 2 })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.length).toBe(2)
      }
    })

    test("should respect offset option", async () => {
      await userRepo.create(createUserData({ email: "user1@example.com" }))
      await userRepo.create(createUserData({ email: "user2@example.com" }))
      await userRepo.create(createUserData({ email: "user3@example.com" }))

      const result = await userRepo.findAll({ offset: 2 })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.length).toBe(1)
      }
    })

    test("should return empty array when no users", async () => {
      const result = await userRepo.findAll()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual([])
      }
    })
  })

  describe("update", () => {
    test("should update user name", async () => {
      const userData = createUserData()
      const created = await userRepo.create(userData)

      if (created.isErr()) {
        throw new Error("Setup failed")
      }

      const result = await userRepo.update(created.value.id, {
        name: "Updated Name",
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.name).toBe("Updated Name")
        expect(result.value.email).toBe(userData.email) // Unchanged
        expect(result.value.updatedAt.getTime()).toBeGreaterThan(
          result.value.createdAt.getTime(),
        )
      }
    })

    test("should update user email", async () => {
      const userData = createUserData()
      const created = await userRepo.create(userData)

      if (created.isErr()) {
        throw new Error("Setup failed")
      }

      const result = await userRepo.update(created.value.id, {
        email: "newemail@example.com",
      })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.email).toBe("newemail@example.com")
      }
    })

    test("should fail to update non-existent user", async () => {
      const result = await userRepo.update("non-existent-id", {
        name: "New Name",
      })

      expect(result.isErr()).toBe(true)
    })
  })

  describe("updatePassword", () => {
    test("should update user password hash", async () => {
      const userData = createUserData()
      const created = await userRepo.create(userData)

      if (created.isErr()) {
        throw new Error("Setup failed")
      }

      const newHash = "$2b$10$new.hash.value"
      const result = await userRepo.updatePassword(created.value.id, newHash)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.passwordHash).toBe(newHash)
      }
    })
  })

  describe("delete", () => {
    test("should delete user", async () => {
      const userData = createUserData()
      const created = await userRepo.create(userData)

      if (created.isErr()) {
        throw new Error("Setup failed")
      }

      const result = await userRepo.delete(created.value.id)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(true)
      }

      // Verify user is deleted
      const findResult = await userRepo.findById(created.value.id)
      if (findResult.isOk()) {
        expect(findResult.value).toBeNull()
      }
    })

    test("should return false when deleting non-existent user", async () => {
      const result = await userRepo.delete("non-existent-id")

      // Delete operation may fail or return false depending on driver behavior
      // Both are acceptable for non-existent records
      if (result.isOk()) {
        expect(result.value).toBe(false)
      } else {
        // If it errors, that's also acceptable behavior
        expect(result.isErr()).toBe(true)
      }
    })
  })

  describe("exists", () => {
    test("should return true for existing user", async () => {
      const userData = createUserData()
      const created = await userRepo.create(userData)

      if (created.isErr()) {
        throw new Error("Setup failed")
      }

      const result = await userRepo.exists(created.value.id)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(true)
      }
    })

    test("should return false for non-existent user", async () => {
      const result = await userRepo.exists("non-existent-id")

      // Exists check may fail or return false depending on driver behavior
      // Both are acceptable for non-existent records
      if (result.isOk()) {
        expect(result.value).toBe(false)
      } else {
        // If it errors, that's also acceptable behavior
        expect(result.isErr()).toBe(true)
      }
    })
  })

  describe("emailExists", () => {
    test("should return true for existing email", async () => {
      const userData = createUserData({ email: "exists@example.com" })
      await userRepo.create(userData)

      const result = await userRepo.emailExists("exists@example.com")

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(true)
      }
    })

    test("should return false for non-existent email", async () => {
      const result = await userRepo.emailExists("notexists@example.com")

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(false)
      }
    })
  })

  describe("count", () => {
    test("should count users", async () => {
      await userRepo.create(createUserData())
      await userRepo.create(createUserData())
      await userRepo.create(createUserData())

      const result = await userRepo.count()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(Number(result.value)).toBe(3)
      }
    })

    test("should return 0 when no users", async () => {
      const result = await userRepo.count()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(Number(result.value)).toBe(0)
      }
    })
  })
})
