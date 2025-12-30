/**
 * Authentication Service
 *
 * Handles JWT token generation, verification, and password hashing using jose and Bun's native APIs
 */

import { err, ok, type Result } from "@bunkit/result"
import { type JWTPayload as JoseJWTPayload, jwtVerify, SignJWT } from "jose"
import { config } from "@/config"
import {
  type AppError,
  InvalidTokenError,
  TokenExpiredError,
} from "@/core/errors"
import { logger } from "@/core/logger"

/**
 * JWT payload structure
 */
export interface JWTPayload extends JoseJWTPayload {
  userId: string
  email: string
}

/**
 * Hash a password using Bun's native password hashing
 */
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  })
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await Bun.password.verify(password, hash)
}

/**
 * Generate a JWT token for a user
 */
export async function generateToken(
  userId: string,
  email: string,
): Promise<Result<string, Error>> {
  try {
    const secret = new TextEncoder().encode(config.JWT_SECRET)
    const expiresIn = parseExpiration(config.JWT_EXPIRES_IN)

    const token = await new SignJWT({ userId, email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
      .sign(secret)

    return ok(token)
  } catch (error) {
    logger.error("Failed to generate token", { error })
    return err(error instanceof Error ? error : new Error("Unknown error"))
  }
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string,
): Promise<Result<JWTPayload, AppError>> {
  try {
    const secret = new TextEncoder().encode(config.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    // Ensure required fields exist
    if (!payload.userId || !payload.email) {
      return err(new InvalidTokenError("Missing required token claims"))
    }

    return ok(payload as JWTPayload)
  } catch (error) {
    logger.debug("Failed to verify token", { error })

    // Check for specific jose errors
    if (error instanceof Error) {
      if (error.message.includes("exp")) {
        return err(new TokenExpiredError())
      }
    }

    return err(new InvalidTokenError())
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(
  authHeader: string | null,
): Result<string, AppError> {
  if (!authHeader) {
    return err(new InvalidTokenError())
  }

  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return err(new InvalidTokenError())
  }

  return ok(parts[1])
}

/**
 * Helper: Parse expiration string to seconds (e.g., "7d" -> 604800)
 */
function parseExpiration(expiration: string): number {
  const units: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  }

  const match = expiration.match(/^(\d+)([smhdw])$/)
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid expiration format: ${expiration}`)
  }

  const value = match[1]
  const unit = match[2]
  const multiplier = units[unit]
  if (multiplier === undefined) {
    throw new Error(`Invalid expiration unit: ${unit}`)
  }

  return Number.parseInt(value, 10) * multiplier
}
