import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { createRoute, createServer, routeRegistry } from "../../src/index"
import type { Server } from "../../src/types/server"

// Helper to parse JSON response with type assertion
const json = <T = Record<string, unknown>>(response: Response): Promise<T> =>
  response.json() as Promise<T>

describe("Multiple Servers", () => {
  const servers: Server[] = []

  beforeEach(() => {
    routeRegistry.clear()
  })

  afterAll(async () => {
    // Clean up all servers
    for (const server of servers) {
      await server.stop()
    }
    servers.length = 0
  })

  describe("Server-scoped route registration", () => {
    test("should register routes to specific server using third argument", async () => {
      const server1 = createServer({ port: 3300 })
      const server2 = createServer({ port: 3301 })
      servers.push(server1, server2)

      // Register route to server1
      createRoute("GET", "/api/data", server1).handler(({ res }) => {
        return res.ok({ source: "server1" })
      })

      // Register route to server2
      createRoute("GET", "/api/data", server2).handler(({ res }) => {
        return res.ok({ source: "server2" })
      })

      await server1.start()
      await server2.start()

      // Request to server1
      const response1 = await fetch("http://localhost:3300/api/data")
      const data1 = await json(response1)

      // Request to server2
      const response2 = await fetch("http://localhost:3301/api/data")
      const data2 = await json(response2)

      expect(data1.source).toBe("server1")
      expect(data2.source).toBe("server2")
    })

    test("should keep server routes isolated", async () => {
      const server1 = createServer({ port: 3302 })
      const server2 = createServer({ port: 3303 })
      servers.push(server1, server2)

      // Register different routes to different servers
      createRoute("GET", "/api/only-on-server1", server1).handler(({ res }) => {
        return res.ok({ message: "found on server1" })
      })

      createRoute("GET", "/api/only-on-server2", server2).handler(({ res }) => {
        return res.ok({ message: "found on server2" })
      })

      await server1.start()
      await server2.start()

      // Server1 should have its route
      const response1 = await fetch("http://localhost:3302/api/only-on-server1")
      expect(response1.status).toBe(200)

      // Server1 should NOT have server2's route
      const response1Missing = await fetch(
        "http://localhost:3302/api/only-on-server2",
      )
      expect(response1Missing.status).toBe(404)

      // Server2 should have its route
      const response2 = await fetch("http://localhost:3303/api/only-on-server2")
      expect(response2.status).toBe(200)

      // Server2 should NOT have server1's route
      const response2Missing = await fetch(
        "http://localhost:3303/api/only-on-server1",
      )
      expect(response2Missing.status).toBe(404)
    })

    test("should prefer server-scoped routes over global routes", async () => {
      const server = createServer({ port: 3304 })
      servers.push(server)

      // Global route (no server argument) - not accessible when server has local registry
      createRoute("GET", "/api/global").handler(({ res }) => {
        return res.ok({ type: "global" })
      })

      // Server-scoped route - this creates the local registry
      createRoute("GET", "/api/scoped", server).handler(({ res }) => {
        return res.ok({ type: "scoped" })
      })

      await server.start()

      // Global route is NOT accessible because server has local registry that takes precedence
      const globalResponse = await fetch("http://localhost:3304/api/global")
      expect(globalResponse.status).toBe(404)

      // Scoped route should be accessible
      const scopedResponse = await fetch("http://localhost:3304/api/scoped")
      const scopedData = await json(scopedResponse)
      expect(scopedResponse.status).toBe(200)
      expect(scopedData.type).toBe("scoped")
    })

    test("should handle server-scoped routes with path parameters", async () => {
      const server = createServer({ port: 3305 })
      servers.push(server)

      createRoute("GET", "/api/users/:userId", server).handler(
        ({ params, res }) => {
          return res.ok({ userId: params.userId })
        },
      )

      await server.start()

      const response = await fetch("http://localhost:3305/api/users/user-abc")
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.userId).toBe("user-abc")
    })

    test("should handle server-scoped routes with body validation", async () => {
      const server = createServer({ port: 3306 })
      servers.push(server)

      createRoute("POST", "/api/items", server)
        .body(z.object({ name: z.string().min(1), value: z.number() }))
        .handler(({ body, res }) => {
          return res.created({ id: "new", name: body.name, value: body.value })
        })

      await server.start()

      // Valid request
      const validResponse = await fetch("http://localhost:3306/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test", value: 42 }),
      })
      const validData = await json(validResponse)

      expect(validResponse.status).toBe(201)
      expect(validData.name).toBe("test")

      // Invalid request
      const invalidResponse = await fetch("http://localhost:3306/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", value: "not-a-number" }),
      })

      expect(invalidResponse.status).toBe(400)
    })

    test("should handle server-scoped routes with query validation", async () => {
      const server = createServer({ port: 3307 })
      servers.push(server)

      createRoute("GET", "/api/search", server)
        .query(z.object({ q: z.string(), page: z.string().optional() }))
        .handler(({ query, res }) => {
          return res.ok({ query: query.q, page: query.page ?? "1" })
        })

      await server.start()

      const response = await fetch(
        "http://localhost:3307/api/search?q=hello&page=2",
      )
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.query).toBe("hello")
      expect(data.page).toBe("2")
    })

    test("should handle route-level middleware on server-scoped routes", async () => {
      const server = createServer({ port: 3308 })
      servers.push(server)

      const authMiddleware = async ({
        ctx,
        next,
      }: {
        ctx: Record<string, unknown>
        next: () => Promise<Response>
      }) => {
        ctx.authenticated = true
        return next()
      }

      createRoute("GET", "/api/protected", server)
        .middlewares(authMiddleware)
        .handler(({ ctx, res }) => {
          return res.ok({ authenticated: ctx.authenticated })
        })

      await server.start()

      const response = await fetch("http://localhost:3308/api/protected")
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.authenticated).toBe(true)
    })
  })

  describe("OpenAPI spec generation with server-scoped routes", () => {
    test("should generate OpenAPI spec for server-scoped routes only", async () => {
      const server1 = createServer({
        port: 3309,
        openapi: { title: "API 1", version: "1.0.0" },
      })
      const server2 = createServer({
        port: 3310,
        openapi: { title: "API 2", version: "2.0.0" },
      })
      servers.push(server1, server2)

      createRoute("GET", "/api/users", server1)
        .openapi({ operationId: "getUsers", tags: ["Users"] })
        .handler(({ res }) => res.ok([]))

      createRoute("GET", "/api/products", server2)
        .openapi({ operationId: "getProducts", tags: ["Products"] })
        .handler(({ res }) => res.ok([]))

      const spec1Result = await server1.getOpenApiSpec()
      const spec2Result = await server2.getOpenApiSpec()

      expect(spec1Result.isOk()).toBe(true)
      expect(spec2Result.isOk()).toBe(true)

      const spec1 = spec1Result.unwrap()
      const spec2 = spec2Result.unwrap()

      // Server1 should only have /api/users
      expect(spec1.paths["/api/users"]).toBeDefined()
      expect(spec1.paths["/api/products"]).toBeUndefined()
      expect(spec1.info.title).toBe("API 1")

      // Server2 should only have /api/products
      expect(spec2.paths["/api/products"]).toBeDefined()
      expect(spec2.paths["/api/users"]).toBeUndefined()
      expect(spec2.info.title).toBe("API 2")
    })

    test("should include global routes in OpenAPI spec when no local routes", async () => {
      // Global route
      createRoute("GET", "/api/global")
        .openapi({ operationId: "globalRoute", tags: ["Global"] })
        .handler(({ res }) => res.ok({}))

      const server = createServer({
        port: 3311,
        openapi: { title: "Mixed API" },
      })
      servers.push(server)

      const specResult = await server.getOpenApiSpec()
      expect(specResult.isOk()).toBe(true)

      const spec = specResult.unwrap()
      // Should include global route when no local registry
      expect(spec.paths["/api/global"]).toBeDefined()
    })
  })

  describe("Multiple servers concurrency", () => {
    test("should handle concurrent requests to multiple servers", async () => {
      const server1 = createServer({ port: 3312 })
      const server2 = createServer({ port: 3313 })
      const server3 = createServer({ port: 3314 })
      servers.push(server1, server2, server3)

      createRoute("GET", "/api/identify", server1).handler(({ res }) => {
        return res.ok({ server: 1 })
      })

      createRoute("GET", "/api/identify", server2).handler(({ res }) => {
        return res.ok({ server: 2 })
      })

      createRoute("GET", "/api/identify", server3).handler(({ res }) => {
        return res.ok({ server: 3 })
      })

      await Promise.all([server1.start(), server2.start(), server3.start()])

      // Make concurrent requests
      const responses = await Promise.all([
        fetch("http://localhost:3312/api/identify"),
        fetch("http://localhost:3313/api/identify"),
        fetch("http://localhost:3314/api/identify"),
      ])

      const data = await Promise.all(
        responses.map((r) => json<{ server: number }>(r)),
      )

      expect(data[0]?.server).toBe(1)
      expect(data[1]?.server).toBe(2)
      expect(data[2]?.server).toBe(3)
    })

    test("should handle rapid requests to same server-scoped route", async () => {
      const server = createServer({ port: 3315 })
      servers.push(server)

      let counter = 0
      createRoute("GET", "/api/count", server).handler(({ res }) => {
        counter++
        return res.ok({ count: counter })
      })

      await server.start()

      // Make 10 rapid requests
      const requests = Array.from({ length: 10 }, () =>
        fetch("http://localhost:3315/api/count"),
      )

      await Promise.all(requests)

      expect(counter).toBe(10)
    })
  })

  describe("Server lifecycle with scoped routes", () => {
    test("should allow registering routes before server start", async () => {
      const server = createServer({ port: 3316 })
      servers.push(server)

      // Register before start
      createRoute("GET", "/api/early", server).handler(({ res }) => {
        return res.ok({ registered: "before start" })
      })

      await server.start()

      const response = await fetch("http://localhost:3316/api/early")
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.registered).toBe("before start")
    })

    test("should handle server restart with same routes", async () => {
      const server = createServer({ port: 3317 })
      servers.push(server)

      createRoute("GET", "/api/persistent", server).handler(({ res }) => {
        return res.ok({ status: "alive" })
      })

      // First start
      await server.start()
      const response1 = await fetch("http://localhost:3317/api/persistent")
      expect(response1.status).toBe(200)

      // Stop
      await server.stop()

      // Wait a bit for port to be released
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Restart
      await server.start()
      const response2 = await fetch("http://localhost:3317/api/persistent")
      expect(response2.status).toBe(200)
    })
  })

  describe("Global registry isolation", () => {
    test("should not pollute global registry with server-scoped routes", async () => {
      const initialGlobalCount = routeRegistry.getAll().length

      const server = createServer({ port: 3318 })
      servers.push(server)

      // Register to server (not global)
      createRoute("GET", "/api/local-only", server).handler(({ res }) => {
        return res.ok({})
      })

      // Global registry should not change
      expect(routeRegistry.getAll().length).toBe(initialGlobalCount)
    })

    test("should register to global registry when no server provided", async () => {
      const initialGlobalCount = routeRegistry.getAll().length

      createRoute("GET", "/api/truly-global").handler(({ res }) => {
        return res.ok({})
      })

      // Global registry should have one more route
      expect(routeRegistry.getAll().length).toBe(initialGlobalCount + 1)
    })
  })

  describe("Different route configurations per server", () => {
    test("should allow same path with different methods on different servers", async () => {
      const getServer = createServer({ port: 3319 })
      const postServer = createServer({ port: 3320 })
      servers.push(getServer, postServer)

      createRoute("GET", "/api/resource", getServer).handler(({ res }) => {
        return res.ok({ method: "GET" })
      })

      createRoute("POST", "/api/resource", postServer).handler(({ res }) => {
        return res.ok({ method: "POST" })
      })

      await getServer.start()
      await postServer.start()

      // GET server only responds to GET
      const getOnGetServer = await fetch("http://localhost:3319/api/resource")
      expect(getOnGetServer.status).toBe(200)

      const postOnGetServer = await fetch(
        "http://localhost:3319/api/resource",
        {
          method: "POST",
        },
      )
      expect(postOnGetServer.status).toBe(404)

      // POST server only responds to POST
      const getOnPostServer = await fetch("http://localhost:3320/api/resource")
      expect(getOnPostServer.status).toBe(404)

      const postOnPostServer = await fetch(
        "http://localhost:3320/api/resource",
        { method: "POST" },
      )
      expect(postOnPostServer.status).toBe(200)
    })

    test("should allow different schemas for same path on different servers", async () => {
      const v1Server = createServer({ port: 3321 })
      const v2Server = createServer({ port: 3322 })
      servers.push(v1Server, v2Server)

      // V1 API with simple schema
      createRoute("POST", "/api/user", v1Server)
        .body(z.object({ name: z.string() }))
        .handler(({ body, res }) => {
          return res.ok({ version: 1, name: body.name })
        })

      // V2 API with extended schema
      createRoute("POST", "/api/user", v2Server)
        .body(z.object({ name: z.string(), email: z.string().email() }))
        .handler(({ body, res }) => {
          return res.ok({ version: 2, name: body.name, email: body.email })
        })

      await v1Server.start()
      await v2Server.start()

      // V1 accepts simple body
      const v1Response = await fetch("http://localhost:3321/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John" }),
      })
      expect(v1Response.status).toBe(200)

      // V2 requires email
      const v2InvalidResponse = await fetch("http://localhost:3322/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John" }),
      })
      expect(v2InvalidResponse.status).toBe(400)

      const v2ValidResponse = await fetch("http://localhost:3322/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John", email: "john@example.com" }),
      })
      expect(v2ValidResponse.status).toBe(200)
    })
  })
})
