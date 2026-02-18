import { ErrorCode } from "../core/standard-errors"
import type {
  BuildRoutePath,
  Cookie,
  CookieOptions,
  ErrorResponse,
  RegisteredRoutes,
  ResponseBuilder,
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
 * ResponseBuilderImpl - Implements the ResponseBuilder interface as a class.
 * Accumulates cookies, status overrides, and header overrides, then applies
 * them to every response produced by the builder.
 */
class ResponseBuilderImpl implements ResponseBuilder {
  private readonly _cookies: Cookie[] = []
  private _customStatus: number | undefined
  private _customHeaders: Record<string, string> = {}

  private applyModifiers(response: Response): Response {
    let result = response

    if (
      this._customStatus !== undefined ||
      Object.keys(this._customHeaders).length > 0
    ) {
      const mergedHeaders = new Headers(response.headers)
      for (const [key, value] of Object.entries(this._customHeaders)) {
        mergedHeaders.set(key, value)
      }
      result = new Response(response.body, {
        status: this._customStatus ?? response.status,
        statusText: response.statusText,
        headers: mergedHeaders,
      })
    }

    return addCookiesToResponse(result, this._cookies)
  }

  // --- Chainable modifiers ---

  public status(code: number): this {
    this._customStatus = code
    return this
  }

  public header(name: string, value: string): this {
    this._customHeaders[name] = value
    return this
  }

  public headers(headers: Record<string, string>): this {
    this._customHeaders = { ...this._customHeaders, ...headers }
    return this
  }

  public setCookie(name: string, value: string, options?: CookieOptions): this
  public setCookie(cookie: Cookie): this
  public setCookie(
    nameOrCookie: string | Cookie,
    value?: string,
    options?: CookieOptions,
  ): this {
    if (typeof nameOrCookie === "string") {
      if (value === undefined) {
        throw new Error("Cookie value is required when name is provided")
      }
      this._cookies.push({ name: nameOrCookie, value, options })
    } else {
      this._cookies.push(nameOrCookie)
    }
    return this
  }

  public cookie(name: string, value: string, options?: CookieOptions): this
  public cookie(cookie: Cookie): this
  public cookie(
    nameOrCookie: string | Cookie,
    value?: string,
    options?: CookieOptions,
  ): this {
    if (typeof nameOrCookie === "string") {
      if (value === undefined) {
        throw new Error("Cookie value is required when name is provided")
      }
      this._cookies.push({ name: nameOrCookie, value, options })
    } else {
      this._cookies.push(nameOrCookie)
    }
    return this
  }

  // --- 2xx responses ---

  public ok<T>(data: T, statusCode = 200): Response {
    return this.applyModifiers(ok(data, statusCode))
  }

  public created<T>(data: T, location?: string): Response {
    return this.applyModifiers(created(data, location))
  }

  public accepted<T>(data: T): Response {
    return this.applyModifiers(accepted(data))
  }

  public noContent(): Response {
    return this.applyModifiers(noContent())
  }

  // --- 4xx / 5xx responses ---

  public badRequest(
    message: string,
    code?: string,
    details?: unknown,
  ): Response {
    return this.applyModifiers(badRequest(message, code, details))
  }

  public unauthorized(
    message: string,
    code?: string,
    details?: unknown,
  ): Response {
    return this.applyModifiers(unauthorized(message, code, details))
  }

  public forbidden(
    message: string,
    code?: string,
    details?: unknown,
  ): Response {
    return this.applyModifiers(forbidden(message, code, details))
  }

  public notFound(message: string, code?: string, details?: unknown): Response {
    return this.applyModifiers(notFound(message, code, details))
  }

  public conflict(message: string, code?: string, details?: unknown): Response {
    return this.applyModifiers(conflict(message, code, details))
  }

  public internalError(
    message: string,
    code?: string,
    details?: unknown,
  ): Response {
    return this.applyModifiers(internalError(message, code, details))
  }

  // --- Generic / utility responses ---

  public json(body: unknown, statusCode?: number): Response
  public json<T>(body: T, statusCode?: number): Response
  public json<T>(
    body: T,
    options: { status?: number; headers?: Record<string, string> },
  ): Response
  public json<T>(
    body: T,
    statusOrOptions?:
      | number
      | { status?: number; headers?: Record<string, string> },
  ): Response {
    let statusCode: number | undefined
    let extraHeaders: Record<string, string> | undefined

    if (typeof statusOrOptions === "number") {
      statusCode = statusOrOptions
    } else if (
      statusOrOptions !== null &&
      typeof statusOrOptions === "object"
    ) {
      statusCode = statusOrOptions.status
      extraHeaders = statusOrOptions.headers
    }

    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    }

    return this.applyModifiers(
      new Response(JSON.stringify(body), {
        status: statusCode ?? 200,
        headers: responseHeaders,
      }),
    )
  }

  public text(content: string, statusCode?: number): Response {
    return this.applyModifiers(text(content, statusCode))
  }

  public html(content: string, statusCode?: number): Response {
    return this.applyModifiers(html(content, statusCode))
  }

  public async file(path: string, contentType?: string): Promise<Response> {
    return this.applyModifiers(await file(path, contentType))
  }

  public stream(readable: ReadableStream, contentType?: string): Response {
    return this.applyModifiers(stream(readable, contentType))
  }

  public redirect(url: string, statusCode?: number): Response {
    return this.applyModifiers(redirect(url, statusCode))
  }

  public redirectTo<TPath extends keyof RegisteredRoutes>(
    route: BuildRoutePath<TPath>,
    statusCode?: number,
  ): Response {
    return this.applyModifiers(redirectTo(route, statusCode))
  }

  public custom(
    body: string | null,
    options: ResponseInit & { status?: number },
  ): Response {
    return this.applyModifiers(custom(body, options))
  }
}

/**
 * Creates a new ResponseBuilder instance for use in route handlers.
 */
export function createResponseBuilder(): ResponseBuilder {
  return new ResponseBuilderImpl()
}
