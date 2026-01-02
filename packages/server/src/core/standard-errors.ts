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
 * Standard error response schemas
 */
export const ErrorResponseSchema = z.object({
  message: z.string().meta({ description: "Error message" }),
  code: z.string().meta({ description: "Error code" }),
  details: z
    .unknown()
    .optional()
    .meta({ description: "Additional error details" }),
})

export const BadRequestErrorResponseSchema = ErrorResponseSchema.extend({
  code: z.literal(ErrorCode.BAD_REQUEST),
  details: z
    .array(
      z.object({
        field: z.string().meta({ description: "Field with validation error" }),
        message: z.string().meta({ description: "Validation error message" }),
      }),
    )
    .meta({ description: "List of validation errors" }),
}).meta({ description: "Bad Request Error Response" })

export const UnauthorizedErrorResponseSchema = ErrorResponseSchema.extend({
  code: z.literal(ErrorCode.UNAUTHORIZED),
}).meta({ description: "Unauthorized Error Response" })

export const ForbiddenErrorResponseSchema = ErrorResponseSchema.extend({
  code: z.literal(ErrorCode.FORBIDDEN),
}).meta({ description: "Forbidden Error Response" })

export const NotFoundErrorResponseSchema = ErrorResponseSchema.extend({
  code: z.literal(ErrorCode.NOT_FOUND),
}).meta({ description: "Not Found Error Response" })

export const ConflictErrorResponseSchema = ErrorResponseSchema.extend({
  code: z.literal(ErrorCode.CONFLICT),
  details: z
    .union([z.string(), z.object({})])
    .optional()
    .meta({ description: "Conflict details" }),
}).meta({ description: "Conflict Error Response" })

export const InternalServerErrorResponseSchema = ErrorResponseSchema.extend({
  code: z.literal(ErrorCode.INTERNAL_ERROR),
  details: z
    .string()
    .optional()
    .meta({ description: "Internal error details (for debugging)" }),
}).meta({ description: "Internal Server Error Response" })

/**
 * Common error response definitions for OpenAPI
 */
export const CommonErrorResponses = {
  400: {
    description: "Bad Request - Invalid input or validation failed",
    content: {
      "application/json": {
        schema: BadRequestErrorResponseSchema,
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
        schema: UnauthorizedErrorResponseSchema,
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
        schema: ForbiddenErrorResponseSchema,
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
        schema: NotFoundErrorResponseSchema,
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
        schema: ConflictErrorResponseSchema,
        example: {
          message: "Resource already exists",
          code: ErrorCode.CONFLICT,
          details: "A user with this email already exists",
        },
      },
    },
  },
  500: {
    description: "Internal Server Error - Unexpected server error",
    content: {
      "application/json": {
        schema: InternalServerErrorResponseSchema,
        example: {
          message: "Internal server error",
          code: ErrorCode.INTERNAL_ERROR,
          details: "Stack trace or error details for debugging",
        },
      },
    },
  },
} as const
