import { beforeAll, describe, expect, test } from "bun:test"
import { hashPassword } from "@/auth/auth.service"
import { initDatabase } from "@/db/client"
import { UserRepository } from "@/db/repositories/user-repository"

describe("Auth Routes", () => {
  const BASE_URL = `http://localhost:${process.env.PORT || 3099}`
  let userRepo: UserRepository

  // Note: These tests require the server to be running
  // Run with: bun run dev (in another terminal)

  beforeAll(async () => {
    await initDatabase()
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

  describe("POST /api/auth/login", () => {
    test.skip("should login with valid credentials", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
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
        user: { email: string }
      }
      expect(data).toHaveProperty("token")
      expect(data).toHaveProperty("user")
      expect(data.user.email).toBe("auth-test@example.com")
    })

    test.skip("should reject invalid credentials", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "auth-test@example.com",
          password: "wrongpassword",
        }),
      })

      expect(response.status).toBe(401)
    })

    test.skip("should reject non-existent user", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "password123",
        }),
      })

      expect(response.status).toBe(401)
    })

    test.skip("should validate email format", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
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

  describe("POST /api/auth/register", () => {
    test.skip("should register new user", async () => {
      // Clean up if exists
      const existing = await userRepo.findByEmail("newuser@example.com")
      if (existing.isOk() && existing.value) {
        await userRepo.delete(existing.value.id)
      }

      const response = await fetch(`${BASE_URL}/api/auth/register`, {
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
        user: { email: string }
      }
      expect(data).toHaveProperty("token")
      expect(data).toHaveProperty("user")
      expect(data.user.email).toBe("newuser@example.com")
    })

    test.skip("should reject duplicate email", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
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

    test.skip("should validate email format", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
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

    test.skip("should require minimum password length", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
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

  describe("GET /api/auth/me", () => {
    test("should return user data with valid token", async () => {
      // Login first to get token
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "auth-test@example.com",
          password: "password123",
        }),
      })

      const { token } = (await loginResponse.json()) as { token: string }

      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as { email: string }
      expect(data.email).toBe("auth-test@example.com")
    })

    test("should reject request without token", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/me`)

      expect(response.status).toBe(401)
    })

    test("should reject request with invalid token", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: "Bearer invalid-token" },
      })

      expect(response.status).toBe(401)
    })
  })
})
