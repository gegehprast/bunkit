/**
 * Application Error Types
 *
 * Custom error classes for use with the Result pattern.
 * All errors extend Error and include an error code for API responses.
 */

import type { ErrorCode } from "@/config/constants"
import { ERROR_CODES } from "@/config/constants"

/**
 * Base application error
 */
export class AppError extends Error {
  public override readonly message: string
  public readonly code: ErrorCode
  /**
   * HTTP status code associated with the error
   */
  public readonly statusCode: number
  public readonly details?: unknown

  public constructor(
    message: string,
    code: ErrorCode,
    statusCode = 500,
    details?: unknown,
  ) {
    super(message)
    this.message = message
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, details)
  }
}

/**
 * Authentication required error (401)
 */
export class AuthRequiredError extends AppError {
  public constructor(message = "Authentication required") {
    super(message, ERROR_CODES.AUTH_REQUIRED, 401)
  }
}

/**
 * Invalid authentication error (401)
 */
export class AuthInvalidError extends AppError {
  public constructor(message = "Invalid or expired token") {
    super(message, ERROR_CODES.AUTH_INVALID, 401)
  }
}

/**
 * Invalid credentials error (401)
 */
export class InvalidCredentialsError extends AppError {
  public constructor(message = "Invalid credentials") {
    super(message, ERROR_CODES.INVALID_CREDENTIALS, 401)
  }
}

/**
 * Token expired error (401)
 */
export class TokenExpiredError extends AppError {
  public constructor(message = "Token has expired") {
    super(message, ERROR_CODES.TOKEN_EXPIRED, 401)
  }
}

/**
 * Invalid token error (401)
 */
export class InvalidTokenError extends AppError {
  public constructor(message = "Invalid token") {
    super(message, ERROR_CODES.TOKEN_INVALID, 401)
  }
}

/**
 * Insufficient permissions error (403)
 */
export class ForbiddenError extends AppError {
  public constructor(message = "Insufficient permissions") {
    super(message, ERROR_CODES.FORBIDDEN, 403)
  }
}

/**
 * Resource not found error (404)
 */
export class NotFoundError extends AppError {
  public constructor(message = "Resource not found", details?: unknown) {
    super(message, ERROR_CODES.NOT_FOUND, 404, details)
  }
}

/**
 * Resource conflict error (409)
 */
export class ConflictError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.CONFLICT, 409, details)
  }
}

/**
 * Resource already exists error (409)
 */
export class ResourceExistsError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.RESOURCE_ALREADY_EXISTS, 409, details)
  }
}

/**
 * Rate limit exceeded error (429)
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number

  public constructor(message = "Too many requests", retryAfter?: number) {
    super(message, ERROR_CODES.RATE_LIMIT_EXCEEDED, 429, { retryAfter })
    this.retryAfter = retryAfter
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.DATABASE_ERROR, 500, details)
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends AppError {
  public constructor(message = "Internal server error", details?: unknown) {
    super(message, ERROR_CODES.INTERNAL_ERROR, 500, details)
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
  public constructor(message = "Service temporarily unavailable") {
    super(message, ERROR_CODES.SERVICE_UNAVAILABLE, 503)
  }
}

/**
 * WebSocket message invalid error
 */
export class WsMessageInvalidError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.WS_MESSAGE_INVALID, 400, details)
  }
}

/**
 * WebSocket handler not found error
 */
export class WsHandlerNotFoundError extends AppError {
  public constructor(message: string) {
    super(message, ERROR_CODES.WS_HANDLER_NOT_FOUND, 404)
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error
  }

  if (error instanceof Error) {
    return new InternalError(error.message, {
      name: error.name,
      stack: error.stack,
    })
  }

  return new InternalError("An unexpected error occurred", { error })
}

/**
 * Create a ValidationError from Zod error
 */
export function fromZodError(zodError: {
  issues: Array<{ path: Array<string | number>; message: string }>
}): ValidationError {
  const details = zodError.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
  }))

  return new ValidationError("Validation failed", details)
}
