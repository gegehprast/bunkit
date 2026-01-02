import { createRoute } from "@bunkit/server"
import { UnauthorizedErrorResponseSchema } from "node_modules/@bunkit/server/src/core/standard-errors"
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
    email: z.email().meta({ example: "john@doe.com" }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be less than 128 characters")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      // .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      // .regex(
      //   /[^a-zA-Z0-9]/,
      //   "Password must contain at least one special character",
      // )
      .describe(
        "User password (min 12 characters, must include uppercase, lowercase, number, and special character)",
      )
      .meta({ example: "qwer1234" }),
    name: z.string().optional().meta({ example: "John Doe" }),
  })
  .meta({
    id: "RegisterBody",
    title: "Register Request",
    description: "User registration data",
  })

const LoginBodySchema = z
  .object({
    email: z.email().meta({ example: "john@doe.com" }),
    password: z.string().meta({ example: "qwer1234" }),
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
  .errors([400, 409])
  .handler(async ({ body, res }) => {
    const userRepo = getUserRepository()

    // Check if user already exists
    const existingUserResult = await userRepo.findByEmail(body.email)
    if (existingUserResult.isErr()) {
      return res.internalError("Database error")
    }

    if (existingUserResult.value) {
      return res.badRequest("Email already registered")
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
      return res.internalError("Failed to create user")
    }

    const user = createResult.value

    // Generate token
    const tokenResult = await generateToken(user.id, user.email)
    if (tokenResult.isErr()) {
      return res.internalError("Failed to generate token")
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
          schema: UnauthorizedErrorResponseSchema,
        },
      },
    },
  })
  .handler(async ({ body, res }) => {
    const userRepo = getUserRepository()

    // Find user by email
    const userResult = await userRepo.findByEmail(body.email)
    if (userResult.isErr()) {
      return res.internalError("Database error")
    }

    if (!userResult.value) {
      return res.unauthorized("Invalid credentials")
    }

    const user = userResult.value

    // Verify password
    const isValidPassword = await verifyPassword(
      body.password,
      user.passwordHash,
    )
    if (!isValidPassword) {
      return res.unauthorized("Invalid credentials")
    }

    // Generate token
    const tokenResult = await generateToken(user.id, user.email)
    if (tokenResult.isErr()) {
      return res.internalError("Failed to generate token")
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
  .security()
  .middlewares(authMiddleware())
  .response(UserResponseSchema)
  .errorResponses({
    401: {
      description: "Unauthorized - Invalid or missing token hahah",
    },
  })
  .handler(async ({ ctx, res }) => {
    const userRepo = getUserRepository()

    // Get user ID from context (set by auth middleware)
    const userId = ctx.userId as string

    const userResult = await userRepo.findById(userId)
    if (userResult.isErr()) {
      return res.internalError("Database error")
    }

    if (!userResult.value) {
      return res.notFound("User not found")
    }

    const user = userResult.value
    return res.ok({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    })
  })
