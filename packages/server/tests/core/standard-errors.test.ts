import { describe, expect, test } from "bun:test"
import {
  BadRequestErrorResponseSchema,
  CommonErrorResponses,
  ConflictErrorResponseSchema,
  ForbiddenErrorResponseSchema,
  InternalServerErrorResponseSchema,
  NotFoundErrorResponseSchema,
  UnauthorizedErrorResponseSchema,
} from "../../src/core/standard-errors"

describe("Standard Errors", () => {
  describe("CommonErrorResponses", () => {
    test("should have 400 Bad Request response", () => {
      expect(CommonErrorResponses[400]).toBeDefined()
      expect(CommonErrorResponses[400]?.description).toBe(
        "Bad Request - Invalid input or validation failed",
      )
    })

    test("should have 401 Unauthorized response", () => {
      expect(CommonErrorResponses[401]).toBeDefined()
      expect(CommonErrorResponses[401]?.description).toBe(
        "Unauthorized - Authentication required or failed",
      )
    })

    test("should have 403 Forbidden response", () => {
      expect(CommonErrorResponses[403]).toBeDefined()
      expect(CommonErrorResponses[403]?.description).toBe(
        "Forbidden - Insufficient permissions",
      )
    })

    test("should have 404 Not Found response", () => {
      expect(CommonErrorResponses[404]).toBeDefined()
      expect(CommonErrorResponses[404]?.description).toBe(
        "Not Found - Resource does not exist",
      )
    })

    test("should have 409 Conflict response", () => {
      expect(CommonErrorResponses[409]).toBeDefined()
      expect(CommonErrorResponses[409]?.description).toBe(
        "Conflict - Resource already exists or state conflict",
      )
    })

    test("should have 500 Internal Server Error response", () => {
      expect(CommonErrorResponses[500]).toBeDefined()
      expect(CommonErrorResponses[500]?.description).toBe(
        "Internal Server Error - Unexpected server error",
      )
    })
  })

  describe("Error Response Schemas", () => {
    test("should have BadRequestErrorResponseSchema", () => {
      expect(BadRequestErrorResponseSchema).toBeDefined()
      const result = BadRequestErrorResponseSchema.safeParse({
        message: "Invalid input",
        code: "BAD_REQUEST",
        details: [{ field: "email", message: "Invalid format" }],
      })
      expect(result.success).toBe(true)
    })

    test("should have UnauthorizedErrorResponseSchema", () => {
      expect(UnauthorizedErrorResponseSchema).toBeDefined()
      const result = UnauthorizedErrorResponseSchema.safeParse({
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      })
      expect(result.success).toBe(true)
    })

    test("should have ForbiddenErrorResponseSchema", () => {
      expect(ForbiddenErrorResponseSchema).toBeDefined()
      const result = ForbiddenErrorResponseSchema.safeParse({
        message: "Forbidden",
        code: "FORBIDDEN",
      })
      expect(result.success).toBe(true)
    })

    test("should have NotFoundErrorResponseSchema", () => {
      expect(NotFoundErrorResponseSchema).toBeDefined()
      const result = NotFoundErrorResponseSchema.safeParse({
        message: "Not found",
        code: "NOT_FOUND",
      })
      expect(result.success).toBe(true)
    })

    test("should have ConflictErrorResponseSchema", () => {
      expect(ConflictErrorResponseSchema).toBeDefined()
      const result = ConflictErrorResponseSchema.safeParse({
        message: "Conflict",
        code: "CONFLICT",
      })
      expect(result.success).toBe(true)
    })

    test("should have InternalServerErrorResponseSchema", () => {
      expect(InternalServerErrorResponseSchema).toBeDefined()
      const result = InternalServerErrorResponseSchema.safeParse({
        message: "Internal error",
        code: "INTERNAL_ERROR",
      })
      expect(result.success).toBe(true)
    })
  })

  describe("Schema structure", () => {
    test("should accept optional details field in ConflictErrorResponseSchema", () => {
      const result = ConflictErrorResponseSchema.safeParse({
        message: "Resource already exists",
        code: "CONFLICT",
        details: "User with this email already exists",
      })
      expect(result.success).toBe(true)
    })

    test("should require message and code fields", () => {
      const result = BadRequestErrorResponseSchema.safeParse({
        message: "Invalid input",
      })
      expect(result.success).toBe(false)
    })
  })
})
