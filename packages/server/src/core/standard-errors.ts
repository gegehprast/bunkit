import { z } from "zod"

/**
 * Standard error codes used throughout the server
 */
export const ErrorCode = {
  // Request errors (4xx)
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * Standard error response schema
 */
export const ErrorResponseSchema = z.object({
  message: z.string().meta({ description: "Error message" }),
  code: z.string().meta({ description: "Error code" }),
  details: z
    .unknown()
    .optional()
    .meta({ description: "Additional error details" }),
})

/**
 * Common error response definitions for OpenAPI
 */
export const CommonErrorResponses = {
  400: {
    description: "Bad Request - Invalid input or validation failed",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
        example: {
          message: "Validation failed",
          code: ErrorCode.BAD_REQUEST,
          details: [{ path: ["email"], message: "Invalid email format" }],
        },
      },
    },
  },
  401: {
    description: "Unauthorized - Authentication required or failed",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
        example: {
          message: "Authentication required",
          code: ErrorCode.UNAUTHORIZED,
        },
      },
    },
  },
  403: {
    description: "Forbidden - Insufficient permissions",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
        example: {
          message: "Insufficient permissions",
          code: ErrorCode.FORBIDDEN,
        },
      },
    },
  },
  404: {
    description: "Not Found - Resource does not exist",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
        example: {
          message: "Resource not found",
          code: ErrorCode.NOT_FOUND,
        },
      },
    },
  },
  409: {
    description: "Conflict - Resource already exists or state conflict",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
        example: {
          message: "Resource already exists",
          code: ErrorCode.CONFLICT,
        },
      },
    },
  },
  500: {
    description: "Internal Server Error - Unexpected server error",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
        example: {
          message: "Internal server error",
          code: ErrorCode.INTERNAL_ERROR,
        },
      },
    },
  },
} as const
