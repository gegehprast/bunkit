import { describe, expect, test } from "bun:test"
import { createRoute } from "../../src"
import { routeRegistry } from "../../src/http/route-registry"

describe("Response Helpers", () => {
  test("should support all response helper methods", () => {
    routeRegistry.clear()

    // Test ok
    createRoute("GET", "/api/ok").handler(({ res }) => {
      return res.ok({ data: "success" })
    })

    // Test created
    createRoute("POST", "/api/created").handler(({ res }) => {
      return res.created({ id: "1" }, "/api/items/1")
    })

    // Test noContent
    createRoute("DELETE", "/api/nocontent").handler(({ res }) => {
      return res.noContent()
    })

    // Test badRequest
    createRoute("POST", "/api/badrequest").handler(({ res }) => {
      return res.badRequest("Invalid input", "BAD_INPUT")
    })

    // Test unauthorized
    createRoute("GET", "/api/unauthorized").handler(({ res }) => {
      return res.unauthorized("Missing token", "UNAUTHORIZED")
    })

    // Test forbidden
    createRoute("GET", "/api/forbidden").handler(({ res }) => {
      return res.forbidden("Access denied", "FORBIDDEN")
    })

    // Test notFound
    createRoute("GET", "/api/notfound").handler(({ res }) => {
      return res.notFound("Resource not found", "NOT_FOUND")
    })

    // Test internalError
    createRoute("GET", "/api/error").handler(({ res }) => {
      return res.internalError("Something went wrong", "INTERNAL_ERROR")
    })

    // Test text
    createRoute("GET", "/api/text").handler(({ res }) => {
      return res.text("Plain text response")
    })

    // Test html
    createRoute("GET", "/api/html").handler(({ res }) => {
      return res.html("<h1>Hello World</h1>")
    })

    // Test redirect
    createRoute("GET", "/api/redirect").handler(({ res }) => {
      return res.redirect("/api/other", 302)
    })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(11)
  })

  test("should support res.ok with data", () => {
    routeRegistry.clear()

    createRoute("GET", "/api/data").handler(({ res }) => {
      return res.ok({ message: "success", data: [1, 2, 3] })
    })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(1)
  })

  test("should support res.created with location header", () => {
    routeRegistry.clear()

    createRoute("POST", "/api/items").handler(({ res }) => {
      return res.created({ id: "123", name: "New Item" }, "/api/items/123")
    })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(1)
  })

  test("should support res.noContent for DELETE operations", () => {
    routeRegistry.clear()

    createRoute("DELETE", "/api/items/:id").handler(({ res }) => {
      return res.noContent()
    })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(1)
  })

  test("should support error responses with codes", () => {
    routeRegistry.clear()

    createRoute("GET", "/api/protected").handler(({ res }) => {
      return res.unauthorized("Authentication required", "AUTH_REQUIRED")
    })

    createRoute("GET", "/api/forbidden").handler(({ res }) => {
      return res.forbidden("Insufficient permissions", "FORBIDDEN")
    })

    createRoute("GET", "/api/not-found").handler(({ res }) => {
      return res.notFound("Resource not found", "NOT_FOUND")
    })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(3)
  })

  test("should support content-type specific responses", () => {
    routeRegistry.clear()

    createRoute("GET", "/api/text").handler(({ res }) => {
      return res.text("Hello, World!")
    })

    createRoute("GET", "/api/html").handler(({ res }) => {
      return res.html("<html><body>Hello</body></html>")
    })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(2)
  })

  test("should support redirect responses", () => {
    routeRegistry.clear()

    createRoute("GET", "/api/old").handler(({ res }) => {
      return res.redirect("/api/new", 301)
    })

    createRoute("GET", "/api/temp").handler(({ res }) => {
      return res.redirect("/api/permanent", 302)
    })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(2)
  })
})
