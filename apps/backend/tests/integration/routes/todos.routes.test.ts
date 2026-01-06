import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hashPassword } from "@/auth/auth.service"
import { UserRepository } from "@/db/repositories/user-repository"
import { createTestServer, type TestServer } from "../test-server"

describe("Todo Routes", () => {
  let testServer: TestServer
  let BASE_URL: string
  let userRepo: UserRepository
  let authToken: string

  beforeAll(async () => {
    testServer = await createTestServer()
    const startResult = await testServer.start()
    if (startResult.isErr()) {
      throw new Error(
        `Failed to start test server: ${startResult.error.message}`,
      )
    }
    BASE_URL = testServer.getBaseUrl()
    userRepo = new UserRepository()

    // Clean up and create test user
    const existingUser = await userRepo.findByEmail("todo-test@example.com")
    if (existingUser.isOk() && existingUser.value) {
      await userRepo.delete(existingUser.value.id)
    }

    const hashedPassword = await hashPassword("password123")
    const userResult = await userRepo.create({
      email: "todo-test@example.com",
      passwordHash: hashedPassword,
      name: "Todo Test User",
    })

    if (userResult.isOk()) {
      // Login to get token
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "todo-test@example.com",
          password: "password123",
        }),
      })

      const loginData = (await loginResponse.json()) as { token: string }
      authToken = loginData.token
    }
  })

  afterAll(async () => {
    await testServer.stop()
  })

  describe("POST /api/todos", () => {
    test("should create a new todo", async () => {
      const response = await fetch(`${BASE_URL}/api/todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Test Todo",
        }),
      })

      expect(response.status).toBe(201)
      const data = (await response.json()) as { id: string; title: string }
      expect(data).toHaveProperty("id")
      expect(data.title).toBe("Test Todo")
    })

    test("should require authentication", async () => {
      const response = await fetch(`${BASE_URL}/api/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Todo",
        }),
      })

      expect(response.status).toBe(401)
    })

    test("should validate title", async () => {
      const response = await fetch(`${BASE_URL}/api/todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "",
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe("GET /api/todos", () => {
    test("should list user todos", async () => {
      const response = await fetch(`${BASE_URL}/api/todos`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as Array<{
        id: string
        title: string
      }>
      expect(Array.isArray(data)).toBe(true)
    })

    test("should require authentication", async () => {
      const response = await fetch(`${BASE_URL}/api/todos`)

      expect(response.status).toBe(401)
    })
  })

  describe("GET /api/todos/:id", () => {
    test("should get specific todo", async () => {
      // Create a todo first
      const createResponse = await fetch(`${BASE_URL}/api/todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Get Test Todo",
        }),
      })

      const createData = (await createResponse.json()) as { id: string }

      const response = await fetch(`${BASE_URL}/api/todos/${createData.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as { id: string; title: string }
      expect(data.id).toBe(createData.id)
      expect(data.title).toBe("Get Test Todo")
    })

    test("should return 404 for non-existent todo", async () => {
      // Use a valid UUID format that doesn't exist
      const nonExistentId = "00000000-0000-0000-0000-000000000000"
      const response = await fetch(`${BASE_URL}/api/todos/${nonExistentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      expect(response.status).toBe(404)
    })
  })

  describe("PUT /api/todos/:id", () => {
    test("should update todo", async () => {
      // Create a todo first
      const createResponse = await fetch(`${BASE_URL}/api/todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Update Test Todo",
        }),
      })

      const createData = (await createResponse.json()) as { id: string }

      const response = await fetch(`${BASE_URL}/api/todos/${createData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as { id: string; title: string }
      expect(data.title).toBe("Updated Title")
    })
  })

  describe("DELETE /api/todos/:id", () => {
    test("should delete todo", async () => {
      // Create a todo first
      const createResponse = await fetch(`${BASE_URL}/api/todos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Delete Test Todo",
        }),
      })

      const createData = (await createResponse.json()) as { id: string }

      const response = await fetch(`${BASE_URL}/api/todos/${createData.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as { message: string }
      expect(data.message).toBe("Todo deleted successfully")

      // Verify it's deleted
      const getResponse = await fetch(
        `${BASE_URL}/api/todos/${createData.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      )

      expect(getResponse.status).toBe(404)
    })
  })
})
