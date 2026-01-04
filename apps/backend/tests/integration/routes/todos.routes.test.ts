import { beforeAll, describe, expect, test } from "bun:test"
import { hashPassword } from "@/auth/auth.service"
import { initDatabase } from "@/db/client"
import { UserRepository } from "@/db/repositories/user-repository"

describe("Todo Routes", () => {
  const BASE_URL = `http://localhost:${process.env.PORT || 3099}`
  let userRepo: UserRepository
  let authToken: string

  beforeAll(async () => {
    await initDatabase()
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
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "todo-test@example.com",
          password: "password123",
        }),
      })

      const { token } = (await loginResponse.json()) as { token: string }
      authToken = token
    }
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
      const data = (await response.json()) as {
        todos: Array<{ id: string; title: string }>
      }
      expect(Array.isArray(data.todos)).toBe(true)
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

      const { id } = (await createResponse.json()) as { id: string }

      const response = await fetch(`${BASE_URL}/api/todos/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as { id: string; title: string }
      expect(data.id).toBe(id)
      expect(data.title).toBe("Get Test Todo")
    })

    test("should return 404 for non-existent todo", async () => {
      const response = await fetch(`${BASE_URL}/api/todos/nonexistent-id`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      expect(response.status).toBe(404)
    })
  })

  describe("PATCH /api/todos/:id", () => {
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

      const { id } = (await createResponse.json()) as { id: string }

      const response = await fetch(`${BASE_URL}/api/todos/${id}`, {
        method: "PATCH",
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

      const { id } = (await createResponse.json()) as { id: string }

      const response = await fetch(`${BASE_URL}/api/todos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      })

      expect(response.status).toBe(204)

      // Verify it's deleted
      const getResponse = await fetch(`${BASE_URL}/api/todos/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      expect(getResponse.status).toBe(404)
    })
  })
})
