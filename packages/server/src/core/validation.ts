import { err, ok, type Result } from "@bunkit/result"
import type { z } from "zod"

/**
 * Validation error
 */
export class ValidationError extends Error {
  public constructor(
    message: string,
    public readonly issues: Array<{ path: string; message: string }>,
  ) {
    super(message)
    this.name = "ValidationError"
  }
}

/**
 * Validate data against a Zod schema
 */
export function validateSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
): Result<T, ValidationError> {
  const result = schema.safeParse(data)

  if (result.success) {
    return ok(result.data)
  }

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))

  return err(
    new ValidationError(
      `Validation failed: ${issues.map((i) => `${i.path}: ${i.message}`).join(", ")}`,
      issues,
    ),
  )
}

/**
 * Parse query parameters from URL
 */
export function parseQueryParams(url: URL): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {}

  for (const [key, value] of url.searchParams.entries()) {
    if (params[key]) {
      // Multiple values for same key
      if (Array.isArray(params[key])) {
        ;(params[key] as string[]).push(value)
      } else {
        params[key] = [params[key] as string, value]
      }
    } else {
      params[key] = value
    }
  }

  return params
}

/**
 * Parse request body based on content type
 */
export async function parseBody(
  request: Request,
): Promise<Result<unknown, Error>> {
  const contentType = request.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("application/json")) {
      const data = await request.json()
      return ok(data)
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      const data: Record<string, string> = {}
      for (const [key, value] of params.entries()) {
        data[key] = value
      }
      return ok(data)
    }

    if (contentType.includes("text/")) {
      const text = await request.text()
      return ok(text)
    }

    // Default to empty object for GET, HEAD, OPTIONS
    if (
      request.method === "GET" ||
      request.method === "HEAD" ||
      request.method === "OPTIONS"
    ) {
      return ok({})
    }

    // For other content types, return raw body
    const text = await request.text()
    return ok(text)
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error("Failed to parse request body"),
    )
  }
}
