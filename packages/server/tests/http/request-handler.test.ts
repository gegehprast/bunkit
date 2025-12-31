import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { createRoute, createServer, routeRegistry } from "../../src/index"
import type { Server } from "../../src/types/server"

// Helper to parse JSON response with type assertion
const json = <T = Record<string, unknown>>(response: Response): Promise<T> =>
  response.json() as Promise<T>

describe("HTTP Request Handling", () => {
  let server: Server | null = null

  beforeEach(() => {
    routeRegistry.clear()
  })

  afterEach(async () => {
    if (server) {
      await server.stop()
      server = null
    }
  })

  describe("Basic routing", () => {
    test("should handle GET request", async () => {
      createRoute("GET", "/api/hello").handler(({ res }) => {
        return res.ok({ message: "hello" })
      })

      server = createServer({ port: 3200 })
      await server.start()

      const response = await fetch("http://localhost:3200/api/hello")
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.message).toBe("hello")
    })

    test("should handle POST request with body", async () => {
      createRoute("POST", "/api/echo")
        .body(z.object({ text: z.string() }))
        .handler(({ body, res }) => {
          return res.ok({ echo: body.text })
        })

      server = createServer({ port: 3201 })
      await server.start()

      const response = await fetch("http://localhost:3201/api/echo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "test message" }),
      })
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.echo).toBe("test message")
    })

    test("should handle PUT request", async () => {
      createRoute("PUT", "/api/items/:id")
        .body(z.object({ name: z.string() }))
        .handler(({ params, body, res }) => {
          return res.ok({ id: params.id, name: body.name })
        })

      server = createServer({ port: 3202 })
      await server.start()

      const response = await fetch("http://localhost:3202/api/items/42", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "updated" }),
      })
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.id).toBe("42")
      expect(data.name).toBe("updated")
    })

    test("should handle DELETE request", async () => {
      createRoute("DELETE", "/api/items/:id").handler(({ res }) => {
        return res.noContent()
      })

      server = createServer({ port: 3203 })
      await server.start()

      const response = await fetch("http://localhost:3203/api/items/123", {
        method: "DELETE",
      })

      expect(response.status).toBe(204)
    })

    test("should return 404 for unregistered route", async () => {
      server = createServer({ port: 3204 })
      await server.start()

      const response = await fetch("http://localhost:3204/api/not-found")
      const data = await json(response)

      expect(response.status).toBe(404)
      expect(data.code).toBe("NOT_FOUND")
    })
  })

  describe("Path parameters", () => {
    test("should extract single path parameter", async () => {
      createRoute("GET", "/api/users/:userId").handler(({ params, res }) => {
        return res.ok({ userId: params.userId })
      })

      server = createServer({ port: 3205 })
      await server.start()

      const response = await fetch("http://localhost:3205/api/users/abc123")
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.userId).toBe("abc123")
    })

    test("should extract multiple path parameters", async () => {
      createRoute("GET", "/api/orgs/:orgId/repos/:repoId").handler(
        ({ params, res }) => {
          return res.ok({ orgId: params.orgId, repoId: params.repoId })
        },
      )

      server = createServer({ port: 3206 })
      await server.start()

      const response = await fetch(
        "http://localhost:3206/api/orgs/myorg/repos/myrepo",
      )
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.orgId).toBe("myorg")
      expect(data.repoId).toBe("myrepo")
    })
  })

  describe("Query parameters", () => {
    test("should parse query parameters", async () => {
      createRoute("GET", "/api/search")
        .query(z.object({ q: z.string(), limit: z.string().optional() }))
        .handler(({ query, res }) => {
          return res.ok({ query: query.q, limit: query.limit })
        })

      server = createServer({ port: 3207 })
      await server.start()

      const response = await fetch(
        "http://localhost:3207/api/search?q=test&limit=10",
      )
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.query).toBe("test")
      expect(data.limit).toBe("10")
    })

    test("should validate query parameters", async () => {
      createRoute("GET", "/api/page")
        .query(z.object({ page: z.string().min(1) }))
        .handler(({ res }) => res.ok({}))

      server = createServer({ port: 3208 })
      await server.start()

      // Missing required parameter
      const response = await fetch("http://localhost:3208/api/page")
      const data = await json(response)

      expect(response.status).toBe(400)
      expect(data.code).toBe("BAD_REQUEST")
    })
  })

  describe("Body validation", () => {
    test("should validate request body", async () => {
      createRoute("POST", "/api/users")
        .body(
          z.object({
            name: z.string().min(2),
            email: z.string().email(),
          }),
        )
        .handler(({ body, res }) => {
          return res.created({ name: body.name, email: body.email })
        })

      server = createServer({ port: 3209 })
      await server.start()

      // Invalid body
      const response = await fetch("http://localhost:3209/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "A", email: "not-an-email" }),
      })

      expect(response.status).toBe(400)
    })

    test("should accept valid body", async () => {
      createRoute("POST", "/api/users")
        .body(z.object({ name: z.string(), email: z.string().email() }))
        .handler(({ body, res }) => {
          return res.created({ id: "1", ...body })
        })

      server = createServer({ port: 3210 })
      await server.start()

      const response = await fetch("http://localhost:3210/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John", email: "john@example.com" }),
      })
      const data = await json(response)

      expect(response.status).toBe(201)
      expect(data.name).toBe("John")
      expect(data.email).toBe("john@example.com")
    })
  })

  describe("Response helpers", () => {
    test("should return 200 OK", async () => {
      createRoute("GET", "/api/ok").handler(({ res }) => {
        return res.ok({ status: "success" })
      })

      server = createServer({ port: 3211 })
      await server.start()

      const response = await fetch("http://localhost:3211/api/ok")
      expect(response.status).toBe(200)
    })

    test("should return 201 Created with Location header", async () => {
      createRoute("POST", "/api/items").handler(({ res }) => {
        return res.created({ id: "new-123" }, "/api/items/new-123")
      })

      server = createServer({ port: 3212 })
      await server.start()

      const response = await fetch("http://localhost:3212/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })

      expect(response.status).toBe(201)
      expect(response.headers.get("Location")).toBe("/api/items/new-123")
    })

    test("should return 204 No Content", async () => {
      createRoute("DELETE", "/api/resource").handler(({ res }) => {
        return res.noContent()
      })

      server = createServer({ port: 3213 })
      await server.start()

      const response = await fetch("http://localhost:3213/api/resource", {
        method: "DELETE",
      })

      expect(response.status).toBe(204)
    })

    test("should return 400 Bad Request", async () => {
      createRoute("POST", "/api/bad").handler(({ res }) => {
        return res.badRequest("Invalid input", "INVALID_INPUT")
      })

      server = createServer({ port: 3214 })
      await server.start()

      const response = await fetch("http://localhost:3214/api/bad", {
        method: "POST",
      })
      const data = await json(response)

      expect(response.status).toBe(400)
      expect(data.message).toBe("Invalid input")
      expect(data.code).toBe("INVALID_INPUT")
    })

    test("should return 401 Unauthorized", async () => {
      createRoute("GET", "/api/auth").handler(({ res }) => {
        return res.unauthorized("Missing token", "NO_TOKEN")
      })

      server = createServer({ port: 3215 })
      await server.start()

      const response = await fetch("http://localhost:3215/api/auth")
      expect(response.status).toBe(401)
    })

    test("should return 403 Forbidden", async () => {
      createRoute("GET", "/api/forbidden").handler(({ res }) => {
        return res.forbidden("Access denied", "FORBIDDEN")
      })

      server = createServer({ port: 3216 })
      await server.start()

      const response = await fetch("http://localhost:3216/api/forbidden")
      expect(response.status).toBe(403)
    })

    test("should return text response", async () => {
      createRoute("GET", "/api/text").handler(({ res }) => {
        return res.text("Plain text response")
      })

      server = createServer({ port: 3217 })
      await server.start()

      const response = await fetch("http://localhost:3217/api/text")
      const text = await response.text()

      expect(response.headers.get("Content-Type")).toBe(
        "text/plain; charset=utf-8",
      )
      expect(text).toBe("Plain text response")
    })

    test("should return HTML response", async () => {
      createRoute("GET", "/api/html").handler(({ res }) => {
        return res.html("<h1>Hello</h1>")
      })

      server = createServer({ port: 3218 })
      await server.start()

      const response = await fetch("http://localhost:3218/api/html")
      const html = await response.text()

      expect(response.headers.get("Content-Type")).toBe(
        "text/html; charset=utf-8",
      )
      expect(html).toBe("<h1>Hello</h1>")
    })

    test("should handle redirect", async () => {
      createRoute("GET", "/api/redirect").handler(({ res }) => {
        return res.redirect("/api/target", 302)
      })

      server = createServer({ port: 3219 })
      await server.start()

      const response = await fetch("http://localhost:3219/api/redirect", {
        redirect: "manual",
      })

      expect(response.status).toBe(302)
      expect(response.headers.get("Location")).toBe("/api/target")
    })
  })

  describe("Middleware", () => {
    test("should execute middleware before handler", async () => {
      const executionOrder: string[] = []

      const middleware = async ({
        next,
      }: {
        next: () => Promise<Response>
      }) => {
        executionOrder.push("middleware")
        return next()
      }

      createRoute("GET", "/api/middleware-test")
        .middlewares(middleware)
        .handler(({ res }) => {
          executionOrder.push("handler")
          return res.ok({ order: executionOrder })
        })

      server = createServer({ port: 3220 })
      await server.start()

      const response = await fetch("http://localhost:3220/api/middleware-test")
      const data = await json(response)

      expect(data.order).toEqual(["middleware", "handler"])
    })

    test("should allow middleware to short-circuit", async () => {
      const authMiddleware = async ({
        res,
      }: {
        res: { unauthorized: (m: string, c: string) => Response }
      }) => {
        return res.unauthorized("No auth", "UNAUTHORIZED")
      }

      createRoute("GET", "/api/protected")
        .middlewares(authMiddleware)
        .handler(({ res }) => {
          return res.ok({ secret: "data" })
        })

      server = createServer({ port: 3221 })
      await server.start()

      const response = await fetch("http://localhost:3221/api/protected")

      expect(response.status).toBe(401)
    })

    test("should pass context through middleware chain", async () => {
      const contextMiddleware = async ({
        ctx,
        next,
      }: {
        ctx: Record<string, unknown>
        next: () => Promise<Response>
      }) => {
        ctx.userId = "user-123"
        ctx.role = "admin"
        return next()
      }

      createRoute("GET", "/api/context")
        .middlewares(contextMiddleware)
        .handler(({ ctx, res }) => {
          return res.ok({ userId: ctx.userId, role: ctx.role })
        })

      server = createServer({ port: 3222 })
      await server.start()

      const response = await fetch("http://localhost:3222/api/context")
      const data = await json(response)

      expect(data.userId).toBe("user-123")
      expect(data.role).toBe("admin")
    })

    test("should execute multiple middlewares in order", async () => {
      const order: number[] = []

      const middleware1 = async ({
        next,
      }: {
        next: () => Promise<Response>
      }) => {
        order.push(1)
        return next()
      }

      const middleware2 = async ({
        next,
      }: {
        next: () => Promise<Response>
      }) => {
        order.push(2)
        return next()
      }

      const middleware3 = async ({
        next,
      }: {
        next: () => Promise<Response>
      }) => {
        order.push(3)
        return next()
      }

      createRoute("GET", "/api/multi-mw")
        .middlewares(middleware1, middleware2, middleware3)
        .handler(({ res }) => {
          order.push(4)
          return res.ok({ order })
        })

      server = createServer({ port: 3223 })
      await server.start()

      const response = await fetch("http://localhost:3223/api/multi-mw")
      const data = await json(response)

      expect(data.order).toEqual([1, 2, 3, 4])
    })
  })

  describe("Global middleware", () => {
    test("should execute global middleware for all routes", async () => {
      const requestCount = { value: 0 }

      createRoute("GET", "/api/a").handler(({ res }) => res.ok({ route: "a" }))
      createRoute("GET", "/api/b").handler(({ res }) => res.ok({ route: "b" }))

      server = createServer({
        port: 3224,
        globalMiddlewares: [
          async ({ next }) => {
            requestCount.value++
            return next()
          },
        ],
      })
      await server.start()

      await fetch("http://localhost:3224/api/a")
      await fetch("http://localhost:3224/api/b")

      expect(requestCount.value).toBe(2)
    })
  })
})
