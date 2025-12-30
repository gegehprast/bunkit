import type { ErrorResponse, ResponseHelpers } from "./types/response"

// JSON responses
function ok<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function created<T>(data: T, location?: string): Response {
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

function noContent(): Response {
  return new Response(null, { status: 204 })
}

// Error responses
function badRequest(error: ErrorResponse | string, code?: string): Response {
  const body: ErrorResponse =
    typeof error === "string" ? { message: error, code } : error
  return new Response(JSON.stringify(body), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  })
}

function unauthorized(error: ErrorResponse | string, code?: string): Response {
  const body: ErrorResponse =
    typeof error === "string" ? { message: error, code } : error
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}

function forbidden(error: ErrorResponse | string, code?: string): Response {
  const body: ErrorResponse =
    typeof error === "string" ? { message: error, code } : error
  return new Response(JSON.stringify(body), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}

function notFound(error: ErrorResponse | string, code?: string): Response {
  const body: ErrorResponse =
    typeof error === "string" ? { message: error, code } : error
  return new Response(JSON.stringify(body), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  })
}

function internalError(error: ErrorResponse | string, code?: string): Response {
  const body: ErrorResponse =
    typeof error === "string" ? { message: error, code } : error
  return new Response(JSON.stringify(body), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  })
}

// Other content types
function text(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

async function file(path: string, contentType?: string): Promise<Response> {
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

function stream(
  readable: ReadableStream,
  contentType = "application/octet-stream",
): Response {
  return new Response(readable, {
    headers: { "Content-Type": contentType },
  })
}

function redirect(url: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: url },
  })
}

function custom(
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
    noContent,

    // Error responses
    badRequest,
    unauthorized,
    forbidden,
    notFound,
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
