import { ErrorCode } from "../core/standard-errors"
import type { ErrorResponse, ResponseHelpers } from "./types/response"

// JSON responses
export function ok<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function created<T>(data: T, location?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (location) {
    headers.Location = location
  }
  return new Response(JSON.stringify(data), {
    status: 201,
    headers,
  })
}

export function accepted<T>(data: T): Response {
  return new Response(JSON.stringify(data), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

// Error responses
export function badRequest(
  message: string,
  code: string = ErrorCode.BAD_REQUEST,
  details?: unknown,
): Response {
  const body: ErrorResponse = { message, code, details }
  return new Response(JSON.stringify(body), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  })
}

export function unauthorized(
  message: string,
  code: string = ErrorCode.UNAUTHORIZED,
  details?: unknown,
): Response {
  const body: ErrorResponse = { message, code, details }
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}

export function forbidden(
  message: string,
  code: string = ErrorCode.FORBIDDEN,
  details?: unknown,
): Response {
  const body: ErrorResponse = { message, code, details }
  return new Response(JSON.stringify(body), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}

export function notFound(
  message: string,
  code: string = ErrorCode.NOT_FOUND,
  details?: unknown,
): Response {
  const body: ErrorResponse = { message, code, details }
  return new Response(JSON.stringify(body), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  })
}

export function conflict(
  message: string,
  code: string = ErrorCode.CONFLICT,
  details?: unknown,
): Response {
  const body: ErrorResponse = { message, code, details }
  return new Response(JSON.stringify(body), {
    status: 409,
    headers: { "Content-Type": "application/json" },
  })
}

export function internalError(
  message: string,
  code: string = ErrorCode.INTERNAL_ERROR,
  details?: unknown,
): Response {
  const body: ErrorResponse = { message, code, details }
  return new Response(JSON.stringify(body), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  })
}

// Other content types
export function text(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

export function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function file(
  path: string,
  contentType?: string,
): Promise<Response> {
  const file = Bun.file(path)
  const exists = await file.exists()

  if (!exists) {
    return new Response(
      JSON.stringify({ message: "File not found", code: "FILE_NOT_FOUND" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    )
  }

  const headers: Record<string, string> = {}
  if (contentType) {
    headers["Content-Type"] = contentType
  }

  return new Response(file, { headers })
}

export function stream(
  readable: ReadableStream,
  contentType = "application/octet-stream",
): Response {
  return new Response(readable, {
    headers: { "Content-Type": contentType },
  })
}

export function redirect(url: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: url },
  })
}

export function custom(
  body: string | null,
  options: ResponseInit & { status?: number },
): Response {
  return new Response(body, options)
}

/**
 * Creates response helper methods for handlers
 * These helpers ensure type-safe response construction
 */
export function createResponseHelpers(): ResponseHelpers {
  return {
    // JSON responses
    ok,
    created,
    accepted,
    noContent,

    // Error responses
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    internalError,

    // Other content types
    text,
    html,
    file,
    stream,
    redirect,
    custom,
  }
}
