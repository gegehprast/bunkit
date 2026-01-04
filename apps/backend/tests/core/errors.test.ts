import { describe, expect, test } from "bun:test"
import { ERROR_CODES } from "@/config/constants"
import {
  AppError,
  AuthInvalidError,
  AuthRequiredError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  fromZodError,
  InternalError,
  InvalidCredentialsError,
  isAppError,
  NotFoundError,
  RateLimitError,
  ResourceExistsError,
  ServiceUnavailableError,
  TokenExpiredError,
  toAppError,
  ValidationError,
  WsHandlerNotFoundError,
  WsMessageInvalidError,
} from "@/core/errors"

describe("Core Errors", () => {
  describe("AppError", () => {
    test("should create base error with all properties", () => {
      const error = new AppError(
        "Test error",
        ERROR_CODES.INTERNAL_ERROR,
        500,
        { extra: "data" },
      )

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Test error")
      expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR)
      expect(error.statusCode).toBe(500)
      expect(error.details).toEqual({ extra: "data" })
      expect(error.name).toBe("AppError")
      expect(error.stack).toBeDefined()
    })

    test("should default to statusCode 500", () => {
      const error = new AppError("Error", ERROR_CODES.INTERNAL_ERROR)
      expect(error.statusCode).toBe(500)
    })
  })

  describe("ValidationError", () => {
    test("should create validation error with correct properties", () => {
      const details = { field: "email", message: "Invalid format" }
      const error = new ValidationError("Validation failed", details)

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Validation failed")
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
      expect(error.statusCode).toBe(400)
      expect(error.details).toEqual(details)
    })
  })

  describe("AuthRequiredError", () => {
    test("should create auth required error with default message", () => {
      const error = new AuthRequiredError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Authentication required")
      expect(error.code).toBe(ERROR_CODES.AUTH_REQUIRED)
      expect(error.statusCode).toBe(401)
    })

    test("should accept custom message", () => {
      const error = new AuthRequiredError("Please log in")

      expect(error.message).toBe("Please log in")
      expect(error.code).toBe(ERROR_CODES.AUTH_REQUIRED)
    })
  })

  describe("AuthInvalidError", () => {
    test("should create invalid auth error with default message", () => {
      const error = new AuthInvalidError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Invalid or expired token")
      expect(error.code).toBe(ERROR_CODES.AUTH_INVALID)
      expect(error.statusCode).toBe(401)
    })

    test("should accept custom message", () => {
      const error = new AuthInvalidError("Token is malformed")

      expect(error.message).toBe("Token is malformed")
    })
  })

  describe("InvalidCredentialsError", () => {
    test("should create invalid credentials error", () => {
      const error = new InvalidCredentialsError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Invalid credentials")
      expect(error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS)
      expect(error.statusCode).toBe(401)
    })
  })

  describe("TokenExpiredError", () => {
    test("should create token expired error", () => {
      const error = new TokenExpiredError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Token has expired")
      expect(error.code).toBe(ERROR_CODES.TOKEN_EXPIRED)
      expect(error.statusCode).toBe(401)
    })
  })

  describe("InvalidTokenError", () => {
    test("should create invalid token error", () => {
      const error = new AuthInvalidError("Invalid token")

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Invalid token")
      expect(error.code).toBe(ERROR_CODES.AUTH_INVALID)
      expect(error.statusCode).toBe(401)
    })
  })

  describe("ForbiddenError", () => {
    test("should create forbidden error with default message", () => {
      const error = new ForbiddenError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Insufficient permissions")
      expect(error.code).toBe(ERROR_CODES.FORBIDDEN)
      expect(error.statusCode).toBe(403)
    })

    test("should accept custom message", () => {
      const error = new ForbiddenError("Access denied")

      expect(error.message).toBe("Access denied")
    })
  })

  describe("NotFoundError", () => {
    test("should create not found error with default message", () => {
      const error = new NotFoundError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Resource not found")
      expect(error.code).toBe(ERROR_CODES.NOT_FOUND)
      expect(error.statusCode).toBe(404)
    })

    test("should accept custom message", () => {
      const error = new NotFoundError("User not found")

      expect(error.message).toBe("User not found")
    })
  })

  describe("ConflictError", () => {
    test("should create conflict error", () => {
      const error = new ConflictError("Resource conflict")

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Resource conflict")
      expect(error.code).toBe(ERROR_CODES.CONFLICT)
      expect(error.statusCode).toBe(409)
    })

    test("should accept custom message and details", () => {
      const error = new ConflictError("Email already taken", {
        field: "email",
      })

      expect(error.message).toBe("Email already taken")
      expect(error.details).toEqual({ field: "email" })
    })
  })

  describe("ResourceExistsError", () => {
    test("should create resource exists error", () => {
      const error = new ResourceExistsError("User already exists")

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("User already exists")
      expect(error.code).toBe(ERROR_CODES.RESOURCE_ALREADY_EXISTS)
      expect(error.statusCode).toBe(409)
    })
  })

  describe("InternalError", () => {
    test("should create internal server error with default message", () => {
      const error = new InternalError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Internal server error")
      expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR)
      expect(error.statusCode).toBe(500)
    })

    test("should accept custom message", () => {
      const error = new InternalError("Database connection failed")

      expect(error.message).toBe("Database connection failed")
    })
  })

  describe("DatabaseError", () => {
    test("should create database error", () => {
      const error = new DatabaseError("Query failed", { query: "SELECT *" })

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Query failed")
      expect(error.code).toBe(ERROR_CODES.DATABASE_ERROR)
      expect(error.statusCode).toBe(500)
      expect(error.details).toEqual({ query: "SELECT *" })
    })
  })

  describe("RateLimitError", () => {
    test("should create rate limit error with default message", () => {
      const error = new RateLimitError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Too many requests")
      expect(error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED)
      expect(error.statusCode).toBe(429)
    })

    test("should include retryAfter", () => {
      const error = new RateLimitError("Rate limit exceeded", 60)

      expect(error.retryAfter).toBe(60)
    })
  })

  describe("ServiceUnavailableError", () => {
    test("should create service unavailable error", () => {
      const error = new ServiceUnavailableError()

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Service temporarily unavailable")
      expect(error.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE)
      expect(error.statusCode).toBe(503)
    })
  })

  describe("WsMessageInvalidError", () => {
    test("should create websocket message invalid error", () => {
      const error = new WsMessageInvalidError("Invalid message format", {
        type: "unknown",
      })

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Invalid message format")
      expect(error.code).toBe(ERROR_CODES.WS_MESSAGE_INVALID)
      expect(error.statusCode).toBe(400)
      expect(error.details).toEqual({ type: "unknown" })
    })
  })

  describe("WsHandlerNotFoundError", () => {
    test("should create websocket handler not found error", () => {
      const error = new WsHandlerNotFoundError("Handler not registered")

      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe("Handler not registered")
      expect(error.code).toBe(ERROR_CODES.WS_HANDLER_NOT_FOUND)
      expect(error.statusCode).toBe(404)
    })
  })

  describe("Error hierarchy", () => {
    test("all custom errors should extend AppError", () => {
      const errors = [
        new ValidationError("test"),
        new AuthRequiredError(),
        new AuthInvalidError(),
        new InvalidCredentialsError(),
        new TokenExpiredError(),
        new ForbiddenError(),
        new NotFoundError(),
        new ConflictError("test"),
        new ResourceExistsError("test"),
        new InternalError(),
        new DatabaseError("test"),
        new RateLimitError(),
        new ServiceUnavailableError(),
        new WsMessageInvalidError("test"),
        new WsHandlerNotFoundError("test"),
      ]

      for (const error of errors) {
        expect(error).toBeInstanceOf(AppError)
        expect(error).toBeInstanceOf(Error)
        expect(error.stack).toBeDefined()
      }
    })
  })

  describe("isAppError", () => {
    test("should return true for AppError instances", () => {
      const error = new ValidationError("test")
      expect(isAppError(error)).toBe(true)
    })

    test("should return false for non-AppError instances", () => {
      expect(isAppError(new Error("test"))).toBe(false)
      expect(isAppError("string")).toBe(false)
      expect(isAppError(null)).toBe(false)
      expect(isAppError(undefined)).toBe(false)
    })
  })

  describe("toAppError", () => {
    test("should return AppError as-is", () => {
      const error = new ValidationError("test")
      const result = toAppError(error)
      expect(result).toBe(error)
    })

    test("should convert Error to InternalError", () => {
      const error = new Error("Test error")
      const result = toAppError(error)

      expect(result).toBeInstanceOf(InternalError)
      expect(result.message).toBe("Test error")
    })

    test("should convert unknown to InternalError", () => {
      const result = toAppError("string error")

      expect(result).toBeInstanceOf(InternalError)
      expect(result.message).toBe("An unexpected error occurred")
    })
  })

  describe("fromZodError", () => {
    test("should convert Zod error to ValidationError", () => {
      const zodError = {
        issues: [
          { path: ["email"], message: "Invalid email" },
          { path: ["password"], message: "Too short" },
        ],
      }

      const error = fromZodError(zodError)

      expect(error).toBeInstanceOf(ValidationError)
      expect(error.message).toBe("Validation failed")
      expect(error.details).toEqual([
        { field: "email", message: "Invalid email" },
        { field: "password", message: "Too short" },
      ])
    })

    test("should handle empty path as root", () => {
      const zodError = {
        issues: [{ path: [], message: "Invalid input" }],
      }

      const error = fromZodError(zodError)
      expect(error.details).toEqual([
        { field: "root", message: "Invalid input" },
      ])
    })
  })
})
