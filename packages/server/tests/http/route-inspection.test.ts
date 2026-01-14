import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { createRoute } from "../../src/http/route-builder"
import { routeRegistry } from "../../src/http/route-registry"
import { createServer } from "../../src/server"

describe("HTTP Route Inspection API", () => {
  beforeEach(() => {
    // Clear global registry before each test
    routeRegistry.clear()
  })

  afterEach(() => {
    routeRegistry.clear()
  })

  describe("getRoutes() - Global Registry", () => {
    test("should return empty array when no routes registered", () => {
      const server = createServer({ port: 3500 })
      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual([])
      }
    })

    test("should return basic route information", () => {
      const server = createServer({ port: 3501 })

      createRoute("GET", "/api/health")
        .response(z.object({ status: z.string() }))
        .handler(({ res }) => res.ok({ status: "ok" }))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]).toMatchObject({
          method: "GET",
          path: "/api/health",
          requiresAuth: false,
          hasQueryParams: false,
          hasRequestBody: false,
        })
      }
    })

    test("should include route metadata when provided", () => {
      const server = createServer({ port: 3502 })

      createRoute("GET", "/api/todos")
        .openapi({
          operationId: "listTodos",
          summary: "List all todos",
          description: "Returns a paginated list of todos",
          tags: ["Todos"],
        })
        .response(z.array(z.object({ id: z.string(), title: z.string() })))
        .handler(({ res }) => res.ok([]))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        const route = result.value[0]
        expect(route?.operationId).toBe("listTodos")
        expect(route?.summary).toBe("List all todos")
        expect(route?.description).toBe("Returns a paginated list of todos")
        expect(route?.tags).toEqual(["Todos"])
      }
    })

    test("should detect authenticated routes", () => {
      const server = createServer({ port: 3503 })

      createRoute("GET", "/api/protected")
        .security() // Adds authentication requirement
        .response(z.object({ data: z.string() }))
        .handler(({ res }) => res.ok({ data: "secret" }))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.requiresAuth).toBe(true)
      }
    })

    test("should detect routes with query parameters", () => {
      const server = createServer({ port: 3504 })

      createRoute("GET", "/api/search")
        .query(z.object({ q: z.string(), limit: z.number().optional() }))
        .response(z.array(z.string()))
        .handler(({ res }) => res.ok([]))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.hasQueryParams).toBe(true)
      }
    })

    test("should detect routes with request body", () => {
      const server = createServer({ port: 3505 })

      createRoute("POST", "/api/todos")
        .body(z.object({ title: z.string(), completed: z.boolean() }))
        .response(z.object({ id: z.string() }))
        .handler(({ res }) => res.ok({ id: "1" }))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.hasRequestBody).toBe(true)
      }
    })

    test("should return multiple routes", () => {
      const server = createServer({ port: 3506 })

      createRoute("GET", "/api/todos")
        .response(z.array(z.object({ id: z.string() })))
        .handler(({ res }) => res.ok([]))

      createRoute("POST", "/api/todos")
        .body(z.object({ title: z.string() }))
        .response(z.object({ id: z.string() }))
        .handler(({ res }) => res.ok({ id: "1" }))

      createRoute("DELETE", "/api/todos/:id")
        .response(z.object({ success: z.boolean() }))
        .handler(({ res }) => res.ok({ success: true }))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(3)
        expect(result.value.map((r) => r.method)).toEqual([
          "GET",
          "POST",
          "DELETE",
        ])
        expect(result.value.map((r) => r.path)).toEqual([
          "/api/todos",
          "/api/todos",
          "/api/todos/:id",
        ])
      }
    })

    test("should include path parameters in path", () => {
      const server = createServer({ port: 3507 })

      createRoute("GET", "/api/users/:userId/posts/:postId")
        .response(z.object({ id: z.string() }))
        .handler(({ res }) => res.ok({ id: "1" }))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.path).toBe("/api/users/:userId/posts/:postId")
      }
    })
  })

  describe("getRoutes() - Server-Scoped Registry", () => {
    test("should return only server-scoped routes", () => {
      const server1 = createServer({ port: 3510 })
      const server2 = createServer({ port: 3511 })

      // Global route
      createRoute("GET", "/global")
        .response(z.object({ data: z.string() }))
        .handler(({ res }) => res.ok({ data: "global" }))

      // Server1 scoped routes
      createRoute("GET", "/server1/route1", server1)
        .response(z.object({ data: z.string() }))
        .handler(({ res }) => res.ok({ data: "server1" }))

      createRoute("POST", "/server1/route2", server1)
        .response(z.object({ data: z.string() }))
        .handler(({ res }) => res.ok({ data: "server1" }))

      // Server2 scoped route
      createRoute("GET", "/server2/route", server2)
        .response(z.object({ data: z.string() }))
        .handler(({ res }) => res.ok({ data: "server2" }))

      const result1 = server1.http.getRoutes()
      const result2 = server2.http.getRoutes()

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      if (result1.isOk()) {
        expect(result1.value).toHaveLength(2)
        expect(result1.value.map((r) => r.path)).toEqual([
          "/server1/route1",
          "/server1/route2",
        ])
      }

      if (result2.isOk()) {
        expect(result2.value).toHaveLength(1)
        expect(result2.value[0]?.path).toBe("/server2/route")
      }
    })

    test("should return global routes when no local routes", () => {
      const server = createServer({ port: 3512 })

      // Only register global route
      createRoute("GET", "/global")
        .response(z.object({ data: z.string() }))
        .handler(({ res }) => res.ok({ data: "global" }))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.path).toBe("/global")
      }
    })
  })

  describe("getRoutes() - Complex Scenarios", () => {
    test("should handle routes with all features enabled", () => {
      const server = createServer({ port: 3515 })

      createRoute("PUT", "/api/todos/:id")
        .openapi({
          operationId: "updateTodo",
          summary: "Update a todo",
          description: "Updates an existing todo item",
          tags: ["Todos", "CRUD"],
        })
        .security([{ bearerAuth: [] }])
        .query(z.object({ notify: z.boolean().optional() }))
        .body(z.object({ title: z.string(), completed: z.boolean() }))
        .response(z.object({ id: z.string(), title: z.string() }))
        .handler(({ res }) => res.ok({ id: "1", title: "Updated" }))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        const route = result.value[0]
        expect(route).toMatchObject({
          method: "PUT",
          path: "/api/todos/:id",
          operationId: "updateTodo",
          summary: "Update a todo",
          description: "Updates an existing todo item",
          tags: ["Todos", "CRUD"],
          requiresAuth: true,
          hasQueryParams: true,
          hasRequestBody: true,
        })
      }
    })

    test("should handle different HTTP methods", () => {
      const server = createServer({ port: 3516 })

      const methods: Array<
        "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"
      > = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]

      for (const method of methods) {
        createRoute(method, `/api/${method.toLowerCase()}`)
          .response(z.object({ method: z.string() }))
          .handler(({ res }) => res.ok({ method }))
      }

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(methods.length)
        expect(result.value.map((r) => r.method).sort()).toEqual(
          methods.slice().sort(),
        )
      }
    })
  })

  describe("getRoutes() - Edge Cases", () => {
    test("should handle routes without OpenAPI metadata", () => {
      const server = createServer({ port: 3520 })

      createRoute("GET", "/simple")
        .response(z.string())
        .handler(({ res }) => res.ok("simple"))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.operationId).toBeUndefined()
        expect(result.value[0]?.tags).toBeUndefined()
        expect(result.value[0]?.summary).toBeUndefined()
        expect(result.value[0]?.description).toBeUndefined()
      }
    })

    test("should handle empty security array as not requiring auth", () => {
      const server = createServer({ port: 3521 })

      createRoute("GET", "/public")
        .response(z.string())
        .handler(({ res }) => res.ok("public"))

      const result = server.http.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value[0]?.requiresAuth).toBe(false)
      }
    })
  })
})
