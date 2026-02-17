import { ErrorCode } from "../core/standard-errors"
import type {
  BuildRoutePath,
  Cookie,
  CookieOptions,
  ErrorResponse,
  RegisteredRoutes,
  ResponseHelpers,
} from "./types/response"

/**
 * Build a URL from a route path and its parameters
 */
function buildRouteUrl(path: string, params?: Record<string, string>): string {
  if (!params) {
    return path
  }

  let url = path
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, encodeURIComponent(value))
    // Handle wildcard params
    url = url.replace(`:${key}*`, encodeURIComponent(value))
  }

  return url
}

/**
 * Serializes a cookie into a Set-Cookie header value
 */
function serializeCookie(cookie: Cookie): string {
  let result = `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`

  if (cookie.options) {
    const opts = cookie.options
    if (opts.domain) result += `; Domain=${opts.domain}`
    if (opts.path) result += `; Path=${opts.path}`
    if (opts.expires) result += `; Expires=${opts.expires.toUTCString()}`
    if (opts.maxAge !== undefined) result += `; Max-Age=${opts.maxAge}`
    if (opts.httpOnly) result += "; HttpOnly"
    if (opts.secure) result += "; Secure"
    if (opts.sameSite) result += `; SameSite=${opts.sameSite}`
  }

  return result
}

/**
 * Adds cookies to a Response object
 */
function addCookiesToResponse(response: Response, cookies: Cookie[]): Response {
  if (cookies.length === 0) {
    return response
  }

  const headers = new Headers(response.headers)
  for (const cookie of cookies) {
    headers.append("Set-Cookie", serializeCookie(cookie))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

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

/**
 * Redirect to an internal route with type safety
 */
function redirectTo<TPath extends keyof RegisteredRoutes>(
  route: BuildRoutePath<TPath>,
  status = 302,
): Response {
  let url: string

  if (typeof route === "string") {
    // Simple route without parameters
    url = route
  } else {
    // Route with parameters
    url = buildRouteUrl(
      route.path as string,
      route.params as Record<string, string>,
    )
  }

  return redirect(url, status)
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
  const cookies: Cookie[] = []

  // Helper to apply cookies to any response
  const withCookies = (response: Response): Response => {
    return addCookiesToResponse(response, cookies)
  }

  return {
    setCookie(
      nameOrCookie: string | Cookie,
      value?: string,
      options?: CookieOptions,
    ): ResponseHelpers {
      if (typeof nameOrCookie === "string") {
        if (value === undefined) {
          throw new Error("Cookie value is required when name is provided")
        }
        cookies.push({ name: nameOrCookie, value, options })
      } else {
        cookies.push(nameOrCookie)
      }
      return this
    },

    ok: (data, status) => withCookies(ok(data, status)),
    created: (data, location) => withCookies(created(data, location)),
    accepted: (data) => withCookies(accepted(data)),
    noContent: () => withCookies(noContent()),

    badRequest: (message, code, details) =>
      withCookies(badRequest(message, code, details)),
    unauthorized: (message, code, details) =>
      withCookies(unauthorized(message, code, details)),
    forbidden: (message, code, details) =>
      withCookies(forbidden(message, code, details)),
    notFound: (message, code, details) =>
      withCookies(notFound(message, code, details)),
    conflict: (message, code, details) =>
      withCookies(conflict(message, code, details)),
    internalError: (message, code, details) =>
      withCookies(internalError(message, code, details)),

    text: (content, status) => withCookies(text(content, status)),
    html: (content, status) => withCookies(html(content, status)),
    file: async (path, contentType) =>
      withCookies(await file(path, contentType)),
    stream: (readable, contentType) =>
      withCookies(stream(readable, contentType)),
    redirect: (url, status) => withCookies(redirect(url, status)),
    redirectTo: (route, status) => withCookies(redirectTo(route, status)),
    custom: (body, options) => withCookies(custom(body, options)),
  }
}
