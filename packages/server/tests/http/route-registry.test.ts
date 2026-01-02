import { beforeEach, describe, expect, test } from "bun:test"
import { RouteRegistry } from "../../src/http/route-registry"
import type { RouteDefinition } from "../../src/http/types/route"

const mockHandler = () => new Response("ok")

describe("RouteRegistry", () => {
  let registry: RouteRegistry

  beforeEach(() => {
    registry = new RouteRegistry()
  })

  describe("register", () => {
    test("should register a route", () => {
      const route: RouteDefinition = {
        method: "GET",
        path: "/api/test",
        handler: mockHandler,
      }

      registry.register(route)

      const routes = registry.getAll()
      expect(routes.length).toBe(1)
      expect(routes[0]?.method).toBe("GET")
      expect(routes[0]?.path).toBe("/api/test")
    })

    test("should register multiple routes", () => {
      registry.register({
        method: "GET",
        path: "/api/users",
        handler: mockHandler,
      })
      registry.register({
        method: "POST",
        path: "/api/users",
        handler: mockHandler,
      })
      registry.register({
        method: "GET",
        path: "/api/posts",
        handler: mockHandler,
      })

      const routes = registry.getAll()
      expect(routes.length).toBe(3)
    })

    test("should allow duplicate routes (same method and path)", () => {
      // This is allowed at registry level, validation should happen elsewhere
      registry.register({
        method: "GET",
        path: "/api/test",
        handler: mockHandler,
      })
      registry.register({
        method: "GET",
        path: "/api/test",
        handler: mockHandler,
      })

      const routes = registry.getAll()
      expect(routes.length).toBe(2)
    })
  })

  describe("match", () => {
    test("should match exact static path", () => {
      registry.register({
        method: "GET",
        path: "/api/users",
        handler: mockHandler,
      })

      const match = registry.match("GET", "/api/users")
      expect(match).not.toBeNull()
      expect(match?.definition.path).toBe("/api/users")
      expect(match?.params).toEqual({})
    })

    test("should not match wrong method", () => {
      registry.register({
        method: "GET",
        path: "/api/users",
        handler: mockHandler,
      })

      const match = registry.match("POST", "/api/users")
      expect(match).toBeNull()
    })

    test("should not match wrong path", () => {
      registry.register({
        method: "GET",
        path: "/api/users",
        handler: mockHandler,
      })

      const match = registry.match("GET", "/api/posts")
      expect(match).toBeNull()
    })

    test("should extract single path parameter", () => {
      registry.register({
        method: "GET",
        path: "/api/users/:id",
        handler: mockHandler,
      })

      const match = registry.match("GET", "/api/users/123")
      expect(match).not.toBeNull()
      expect(match?.params.id).toBe("123")
    })

    test("should extract multiple path parameters", () => {
      registry.register({
        method: "GET",
        path: "/api/users/:userId/posts/:postId",
        handler: mockHandler,
      })

      const match = registry.match("GET", "/api/users/123/posts/456")
      expect(match).not.toBeNull()
      expect(match?.params.userId).toBe("123")
      expect(match?.params.postId).toBe("456")
    })

    test("should extract parameters at different positions", () => {
      registry.register({
        method: "GET",
        path: "/:org/repos/:repo/issues/:issue",
        handler: mockHandler,
      })

      const match = registry.match("GET", "/myorg/repos/myrepo/issues/42")
      expect(match).not.toBeNull()
      expect(match?.params.org).toBe("myorg")
      expect(match?.params.repo).toBe("myrepo")
      expect(match?.params.issue).toBe("42")
    })

    test("should not match if segment count differs", () => {
      registry.register({
        method: "GET",
        path: "/api/users/:id",
        handler: mockHandler,
      })

      // Too few segments
      expect(registry.match("GET", "/api/users")).toBeNull()
      // Too many segments
      expect(registry.match("GET", "/api/users/123/extra")).toBeNull()
    })

    test("should handle root path", () => {
      registry.register({
        method: "GET",
        path: "/",
        handler: mockHandler,
      })

      const match = registry.match("GET", "/")
      expect(match).not.toBeNull()
      expect(match?.definition.path).toBe("/")
    })

    test("should match first registered route when multiple match", () => {
      registry.register({
        method: "GET",
        path: "/api/:type",
        handler: mockHandler,
      })
      registry.register({
        method: "GET",
        path: "/api/users",
        handler: mockHandler,
      })

      // Should match the first one (/:type) since it was registered first
      const match = registry.match("GET", "/api/users")
      expect(match).not.toBeNull()
      expect(match?.definition.path).toBe("/api/:type")
      expect(match?.params.type).toBe("users")
    })

    test("should handle URL-encoded parameters", () => {
      registry.register({
        method: "GET",
        path: "/api/search/:query",
        handler: mockHandler,
      })

      const match = registry.match("GET", "/api/search/hello%20world")
      expect(match).not.toBeNull()
      expect(match?.params.query).toBe("hello%20world")
    })

    test("should handle special characters in path", () => {
      registry.register({
        method: "GET",
        path: "/api/users/:id",
        handler: mockHandler,
      })

      const match = registry.match("GET", "/api/users/abc-123_xyz")
      expect(match).not.toBeNull()
      expect(match?.params.id).toBe("abc-123_xyz")
    })
  })

  describe("getAll", () => {
    test("should return a copy of routes array", () => {
      registry.register({
        method: "GET",
        path: "/api/test",
        handler: mockHandler,
      })

      const routes1 = registry.getAll()
      const routes2 = registry.getAll()

      // Should be different array instances
      expect(routes1).not.toBe(routes2)
      // But with same content
      expect(routes1).toEqual(routes2)
    })

    test("should return empty array when no routes registered", () => {
      const routes = registry.getAll()
      expect(routes).toEqual([])
    })
  })

  describe("clear", () => {
    test("should clear all routes", () => {
      registry.register({
        method: "GET",
        path: "/api/users",
        handler: mockHandler,
      })
      registry.register({
        method: "POST",
        path: "/api/users",
        handler: mockHandler,
      })

      expect(registry.getAll().length).toBe(2)

      registry.clear()

      expect(registry.getAll().length).toBe(0)
    })

    test("should allow registering after clear", () => {
      registry.register({
        method: "GET",
        path: "/api/old",
        handler: mockHandler,
      })

      registry.clear()

      registry.register({
        method: "GET",
        path: "/api/new",
        handler: mockHandler,
      })

      const routes = registry.getAll()
      expect(routes.length).toBe(1)
      expect(routes[0]?.path).toBe("/api/new")
    })
  })

  describe("all HTTP methods", () => {
    const testMethod = (
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD",
    ) => {
      registry.register({
        method,
        path: "/api/test",
        handler: mockHandler,
      })

      const match = registry.match(method, "/api/test")
      expect(match).not.toBeNull()
      expect(match?.definition.method).toBe(method)
    }

    test("should handle GET method", () => testMethod("GET"))
    test("should handle POST method", () => testMethod("POST"))
    test("should handle PUT method", () => testMethod("PUT"))
    test("should handle PATCH method", () => testMethod("PATCH"))
    test("should handle DELETE method", () => testMethod("DELETE"))
    test("should handle OPTIONS method", () => testMethod("OPTIONS"))
    test("should handle HEAD method", () => testMethod("HEAD"))
  })
})
