import { describe, expect, test } from "bun:test"
import { createResponseHelpers } from "../../src/http/response-helpers"

describe("Response Cookie Support", () => {
  test("should set a single cookie", () => {
    const res = createResponseHelpers()
    const response = res
      .setCookie("session", "abc123")
      .ok({ message: "Success" })

    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(1)
    expect(cookies[0]).toBe("session=abc123")
  })

  test("should set multiple cookies", () => {
    const res = createResponseHelpers()
    const response = res
      .setCookie("session", "abc123")
      .setCookie("user", "john")
      .ok({ message: "Success" })

    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toBe("session=abc123")
    expect(cookies[1]).toBe("user=john")
  })

  test("should set cookies with options", () => {
    const res = createResponseHelpers()
    const response = res
      .setCookie("session", "abc123", {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        path: "/",
        maxAge: 3600,
      })
      .ok({ message: "Success" })

    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(1)
    expect(cookies[0]).toContain("session=abc123")
    expect(cookies[0]).toContain("HttpOnly")
    expect(cookies[0]).toContain("Secure")
    expect(cookies[0]).toContain("SameSite=Strict")
    expect(cookies[0]).toContain("Path=/")
    expect(cookies[0]).toContain("Max-Age=3600")
  })

  test("should set cookie with object syntax", () => {
    const res = createResponseHelpers()
    const response = res
      .setCookie({
        name: "token",
        value: "xyz789",
        options: {
          httpOnly: true,
          secure: true,
        },
      })
      .ok({ message: "Success" })

    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(1)
    expect(cookies[0]).toContain("token=xyz789")
    expect(cookies[0]).toContain("HttpOnly")
    expect(cookies[0]).toContain("Secure")
  })

  test("should set cookies with different response types", () => {
    const res = createResponseHelpers()

    // Test with created()
    const createdResponse = res
      .setCookie("session", "abc123")
      .created({ id: 1 }, "/api/users/1")

    expect(createdResponse.status).toBe(201)
    expect(createdResponse.headers.getSetCookie()).toHaveLength(1)

    // Test with redirect()
    const res2 = createResponseHelpers()
    const redirectResponse = res2
      .setCookie("redirect", "true")
      .redirect("/dashboard")

    expect(redirectResponse.status).toBe(302)
    expect(redirectResponse.headers.getSetCookie()).toHaveLength(1)

    // Test with error responses
    const res3 = createResponseHelpers()
    const errorResponse = res3
      .setCookie("error", "logged")
      .badRequest("Invalid input")

    expect(errorResponse.status).toBe(400)
    expect(errorResponse.headers.getSetCookie()).toHaveLength(1)
  })

  test("should encode cookie name and value", () => {
    const res = createResponseHelpers()
    const response = res
      .setCookie("my cookie", "value with spaces")
      .ok({ message: "Success" })

    const cookies = response.headers.getSetCookie()
    expect(cookies[0]).toBe("my%20cookie=value%20with%20spaces")
  })

  test("should set cookie with expires date", () => {
    const res = createResponseHelpers()
    const expires = new Date("2026-12-31T23:59:59Z")
    const response = res
      .setCookie("session", "abc123", { expires })
      .ok({ message: "Success" })

    const cookies = response.headers.getSetCookie()
    expect(cookies[0]).toContain("session=abc123")
    expect(cookies[0]).toContain("Expires=Thu, 31 Dec 2026 23:59:59 GMT")
  })

  test("should throw error when value is missing for string name", () => {
    const res = createResponseHelpers()
    expect(() => {
      // @ts-expect-error - testing runtime error
      res.setCookie("session")
    }).toThrow("Cookie value is required when name is provided")
  })

  test("should work with all cookie options", () => {
    const res = createResponseHelpers()
    const expires = new Date("2026-12-31T23:59:59Z")
    const response = res
      .setCookie("full", "cookie", {
        domain: "example.com",
        path: "/api",
        expires,
        maxAge: 7200,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      })
      .ok({ message: "Success" })

    const cookies = response.headers.getSetCookie()
    const cookie = cookies[0]
    expect(cookie).toContain("full=cookie")
    expect(cookie).toContain("Domain=example.com")
    expect(cookie).toContain("Path=/api")
    expect(cookie).toContain("Expires=")
    expect(cookie).toContain("Max-Age=7200")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Lax")
  })
})
