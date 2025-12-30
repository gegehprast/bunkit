import { createRoute } from "@bunkit/server"
import { z } from "zod"
import {
  generateToken,
  hashPassword,
  verifyPassword,
} from "@/auth/auth.service"
import { getUserRepository } from "@/db/repositories/user-repository"
import { authMiddleware } from "@/middlewares/auth.middleware"

// Schemas
const RegisterBodySchema = z
  .object({
    email: z.string().email().meta({ example: "user@example.com" }),
    password: z.string().min(8).meta({ example: "password123" }),
    name: z.string().optional().meta({ example: "John Doe" }),
  })
  .meta({
    id: "RegisterBody",
    title: "Register Request",
    description: "User registration data",
  })

const LoginBodySchema = z
  .object({
    email: z.string().email().meta({ example: "user@example.com" }),
    password: z.string().meta({ example: "password123" }),
  })
  .meta({
    id: "LoginBody",
    title: "Login Request",
    description: "User login credentials",
  })

const AuthResponseSchema = z
  .object({
    user: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable(),
    }),
    token: z.string(),
  })
  .meta({
    id: "AuthResponse",
    title: "Auth Response",
    description: "Authentication response with user data and JWT token",
  })

const UserResponseSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    createdAt: z.string(),
  })
  .meta({
    id: "UserResponse",
    title: "User Response",
    description: "User profile data",
  })

/**
 * POST /auth/register - Register a new user
 */
createRoute("POST", "/auth/register")
  .openapi({
    operationId: "register",
    summary: "Register new user",
    description: "Create a new user account with email and password",
    tags: ["Authentication"],
  })
  .body(RegisterBodySchema)
  .response(AuthResponseSchema)
  .errorResponses({
    400: {
      description: "Invalid input or email already exists",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            code: z.string(),
          }),
        },
      },
    },
  })
  .handler(async ({ body, res }) => {
    const userRepo = getUserRepository()

    // Check if user already exists
    const existingUserResult = await userRepo.findByEmail(body.email)
    if (existingUserResult.isErr()) {
      return res.internalError({
        message: "Database error",
        code: "DATABASE_ERROR",
      })
    }

    if (existingUserResult.value) {
      return res.badRequest({
        message: "Email already registered",
        code: "EMAIL_EXISTS",
      })
    }

    // Hash password
    const passwordHash = await hashPassword(body.password)

    // Create user
    const createResult = await userRepo.create({
      email: body.email,
      passwordHash,
      name: body.name,
    })

    if (createResult.isErr()) {
      return res.internalError({
        message: "Failed to create user",
        code: "USER_CREATION_FAILED",
      })
    }

    const user = createResult.value

    // Generate token
    const tokenResult = await generateToken(user.id, user.email)
    if (tokenResult.isErr()) {
      return res.internalError({
        message: "Failed to generate token",
        code: "TOKEN_GENERATION_FAILED",
      })
    }

    return res.created({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token: tokenResult.value,
    })
  })

/**
 * POST /auth/login - Login user
 */
createRoute("POST", "/auth/login")
  .openapi({
    operationId: "login",
    summary: "Login user",
    description: "Authenticate user with email and password",
    tags: ["Authentication"],
  })
  .body(LoginBodySchema)
  .response(AuthResponseSchema)
  .errorResponses({
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            code: z.string(),
          }),
        },
      },
    },
  })
  .handler(async ({ body, res }) => {
    const userRepo = getUserRepository()

    // Find user by email
    const userResult = await userRepo.findByEmail(body.email)
    if (userResult.isErr()) {
      return res.internalError({
        message: "Database error",
        code: "DATABASE_ERROR",
      })
    }

    if (!userResult.value) {
      return res.unauthorized({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      })
    }

    const user = userResult.value

    // Verify password
    const isValidPassword = await verifyPassword(
      body.password,
      user.passwordHash,
    )
    if (!isValidPassword) {
      return res.unauthorized({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      })
    }

    // Generate token
    const tokenResult = await generateToken(user.id, user.email)
    if (tokenResult.isErr()) {
      return res.internalError({
        message: "Failed to generate token",
        code: "TOKEN_GENERATION_FAILED",
      })
    }

    return res.ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token: tokenResult.value,
    })
  })

/**
 * GET /auth/me - Get current user
 */
createRoute("GET", "/auth/me")
  .openapi({
    operationId: "getCurrentUser",
    summary: "Get current user",
    description: "Get the authenticated user's profile (requires Bearer token)",
    tags: ["Authentication"],
  })
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware())
  .response(UserResponseSchema)
  .errorResponses({
    401: {
      description: "Unauthorized - Invalid or missing token",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            code: z.string(),
          }),
        },
      },
    },
  })
  .handler(async ({ ctx, res }) => {
    const userRepo = getUserRepository()

    // Get user ID from context (set by auth middleware)
    const userId = ctx.userId as string

    const userResult = await userRepo.findById(userId)
    if (userResult.isErr()) {
      return res.internalError({
        message: "Database error",
        code: "DATABASE_ERROR",
      })
    }

    if (!userResult.value) {
      return res.notFound({
        message: "User not found",
        code: "USER_NOT_FOUND",
      })
    }

    const user = userResult.value
    return res.ok({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    })
  })
