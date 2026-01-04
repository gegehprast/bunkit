import { describe, expect, test } from "bun:test"
import {
  extractTokenFromHeader,
  generateToken,
  hashPassword,
  verifyPassword,
  verifyToken,
} from "@/auth/auth.service"

describe("AuthService", () => {
  describe("hashPassword", () => {
    test("should hash a password", async () => {
      const password = "mySecurePassword123"
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(0)
    })

    test("should generate different hashes for same password", async () => {
      const password = "mySecurePassword123"
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe("verifyPassword", () => {
    test("should verify correct password", async () => {
      const password = "mySecurePassword123"
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    test("should reject incorrect password", async () => {
      const password = "mySecurePassword123"
      const wrongPassword = "wrongPassword"
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(wrongPassword, hash)
      expect(isValid).toBe(false)
    })

    test("should reject empty password", async () => {
      const password = "mySecurePassword123"
      const hash = await hashPassword(password)

      const isValid = await verifyPassword("", hash)
      expect(isValid).toBe(false)
    })
  })

  describe("generateToken", () => {
    test("should generate a valid JWT token", async () => {
      const userId = "user-123"
      const email = "test@example.com"

      const result = await generateToken(userId, email)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const token = result.value
        expect(token).toBeDefined()
        expect(typeof token).toBe("string")
        expect(token.split(".")).toHaveLength(3) // JWT has 3 parts
      }
    })

    test("should include userId and email in payload", async () => {
      const userId = "user-456"
      const email = "user@test.com"

      const tokenResult = await generateToken(userId, email)
      expect(tokenResult.isOk()).toBe(true)

      if (tokenResult.isOk()) {
        const verifyResult = await verifyToken(tokenResult.value)
        expect(verifyResult.isOk()).toBe(true)

        if (verifyResult.isOk()) {
          expect(verifyResult.value.userId).toBe(userId)
          expect(verifyResult.value.email).toBe(email)
        }
      }
    })
  })

  describe("verifyToken", () => {
    test("should verify a valid token", async () => {
      const userId = "user-789"
      const email = "verify@test.com"

      const tokenResult = await generateToken(userId, email)
      expect(tokenResult.isOk()).toBe(true)

      if (tokenResult.isOk()) {
        const verifyResult = await verifyToken(tokenResult.value)
        expect(verifyResult.isOk()).toBe(true)
      }
    })

    test("should reject invalid token", async () => {
      const invalidToken = "invalid.token.here"

      const result = await verifyToken(invalidToken)
      expect(result.isErr()).toBe(true)
    })

    test("should reject malformed token", async () => {
      const malformedToken = "not-a-jwt-token"

      const result = await verifyToken(malformedToken)
      expect(result.isErr()).toBe(true)
    })

    test("should reject empty token", async () => {
      const result = await verifyToken("")
      expect(result.isErr()).toBe(true)
    })
  })

  describe("extractTokenFromHeader", () => {
    test("should extract token from valid Bearer header", () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token"
      const authHeader = `Bearer ${token}`

      const result = extractTokenFromHeader(authHeader)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toBe(token)
      }
    })

    test("should reject missing authorization header", () => {
      const result = extractTokenFromHeader(null)
      expect(result.isErr()).toBe(true)
    })

    test("should reject malformed authorization header", () => {
      const result1 = extractTokenFromHeader("InvalidFormat token")
      expect(result1.isErr()).toBe(true)

      const result2 = extractTokenFromHeader("Bearer")
      expect(result2.isErr()).toBe(true)

      const result3 = extractTokenFromHeader("token-only")
      expect(result3.isErr()).toBe(true)
    })
  })
})
