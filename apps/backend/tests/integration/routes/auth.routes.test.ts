import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hashPassword } from "@/auth/auth.service"
import { UserRepository } from "@/db/repositories/user-repository"
import { createTestServer, type TestServer } from "../test-server"

describe("Auth Routes", () => {
  let testServer: TestServer
  let BASE_URL: string
  let userRepo: UserRepository

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

    // Clean up test user
    const existingUser = await userRepo.findByEmail("auth-test@example.com")
    if (existingUser.isOk() && existingUser.value) {
      await userRepo.delete(existingUser.value.id)
    }

    // Create test user
    const hashedPassword = await hashPassword("password123")
    await userRepo.create({
      email: "auth-test@example.com",
      passwordHash: hashedPassword,
      name: "Auth Test User",
    })
  })

  afterAll(async () => {
    await testServer.stop()
  })

  describe("POST /auth/login", () => {
    test("should login with valid credentials", async () => {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "auth-test@example.com",
          password: "password123",
        }),
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        token: string
        user: { email: string; id: string; name: string | null }
      }
      expect(data).toHaveProperty("token")
      expect(data).toHaveProperty("user")
      expect(data.user.email).toBe("auth-test@example.com")
    })

    test("should reject invalid credentials", async () => {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "auth-test@example.com",
          password: "wrongpassword",
        }),
      })

      expect(response.status).toBe(401)
    })

    test("should reject non-existent user", async () => {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "password123",
        }),
      })

      expect(response.status).toBe(401)
    })

    test("should validate email format", async () => {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          password: "password123",
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe("POST /auth/register", () => {
    test("should register new user", async () => {
      // Clean up if exists
      const existing = await userRepo.findByEmail("newuser@example.com")
      if (existing.isOk() && existing.value) {
        await userRepo.delete(existing.value.id)
      }

      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@example.com",
          password: "securepassword123",
          name: "New User",
        }),
      })

      expect(response.status).toBe(201)
      const data = (await response.json()) as {
        token: string
        user: { email: string; id: string; name: string | null }
      }
      expect(data).toHaveProperty("token")
      expect(data).toHaveProperty("user")
      expect(data.user.email).toBe("newuser@example.com")
    })

    test("should reject duplicate email", async () => {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "auth-test@example.com",
          password: "password123",
          name: "Duplicate",
        }),
      })

      expect(response.status).toBe(409)
    })

    test("should validate email format", async () => {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          password: "password123",
          name: "Test",
        }),
      })

      expect(response.status).toBe(400)
    })

    test("should require minimum password length", async () => {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "short",
          name: "Test",
        }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe("GET /auth/me", () => {
    test("should return user data with valid token", async () => {
      // Login first to get token
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "auth-test@example.com",
          password: "password123",
        }),
      })

      const loginData = (await loginResponse.json()) as { token: string }

      const response = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${loginData.token}` },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        email: string
        id: string
        name: string | null
        createdAt: string
      }
      expect(data.email).toBe("auth-test@example.com")
    })

    test("should reject request without token", async () => {
      const response = await fetch(`${BASE_URL}/auth/me`)

      expect(response.status).toBe(401)
    })

    test("should reject request with invalid token", async () => {
      const response = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: "Bearer invalid-token" },
      })

      expect(response.status).toBe(401)
    })
  })
})
