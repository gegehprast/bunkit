import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createRoute } from "../../src/http/route-builder"
import { routeRegistry } from "../../src/http/route-registry"
import { createServer } from "../../src/server"

describe("Route Specificity", () => {
  let server: ReturnType<typeof createServer> | null = null

  beforeEach(() => {
    routeRegistry.clear()
  })

  afterEach(async () => {
    if (server) {
      await server.stop()
      server = null
    }
    routeRegistry.clear()
  })

  test("should prioritize exact static routes over wildcards", async () => {
    // Register wildcard first
    createRoute("GET", "/:path*").handler(({ res }) =>
      res.ok({ matched: "wildcard" }),
    )

    // Register exact route after
    createRoute("GET", "/api/health").handler(({ res }) =>
      res.ok({ matched: "exact" }),
    )

    server = createServer({ port: 3800 })
    await server.start()

    const response = await fetch("http://localhost:3800/api/health")
    const data = (await response.json()) as { matched: string }

    expect(response.status).toBe(200)
    expect(data.matched).toBe("exact")
  })

  test("should prioritize parameterized routes over wildcards", async () => {
    // Register wildcard first
    createRoute("GET", "/:path*").handler(({ res }) =>
      res.ok({ matched: "wildcard" }),
    )

    // Register parameterized route after
    createRoute("GET", "/users/:id").handler(({ params, res }) =>
      res.ok({ matched: "param", id: params.id }),
    )

    server = createServer({ port: 3801 })
    await server.start()

    const response = await fetch("http://localhost:3801/users/123")
    const data = (await response.json()) as { matched: string; id: string }

    expect(response.status).toBe(200)
    expect(data.matched).toBe("param")
    expect(data.id).toBe("123")
  })

  test("should prioritize exact routes over parameterized routes", async () => {
    // Register parameterized first
    createRoute("GET", "/users/:id").handler(({ res }) =>
      res.ok({ matched: "param" }),
    )

    // Register exact route after
    createRoute("GET", "/users/me").handler(({ res }) =>
      res.ok({ matched: "exact" }),
    )

    server = createServer({ port: 3802 })
    await server.start()

    const response = await fetch("http://localhost:3802/users/me")
    const data = (await response.json()) as { matched: string }

    expect(response.status).toBe(200)
    expect(data.matched).toBe("exact")
  })

  test("should match wildcard when no exact or param route matches", async () => {
    createRoute("GET", "/api/users").handler(({ res }) =>
      res.ok({ matched: "exact" }),
    )

    createRoute("GET", "/:path*").handler(({ params, res }) =>
      res.ok({ matched: "wildcard", path: params.path }),
    )

    server = createServer({ port: 3803 })
    await server.start()

    const response = await fetch("http://localhost:3803/some/unknown/path")
    const data = (await response.json()) as { matched: string; path: string }

    expect(response.status).toBe(200)
    expect(data.matched).toBe("wildcard")
    expect(data.path).toBe("some/unknown/path")
  })

  test("should handle multiple static segments vs wildcard", async () => {
    // Wildcard
    createRoute("GET", "/:path*").handler(({ res }) =>
      res.ok({ matched: "wildcard" }),
    )

    // Multiple static segments (higher specificity)
    createRoute("GET", "/api/v1/users").handler(({ res }) =>
      res.ok({ matched: "static" }),
    )

    server = createServer({ port: 3804 })
    await server.start()

    const response = await fetch("http://localhost:3804/api/v1/users")
    const data = (await response.json()) as { matched: string }

    expect(response.status).toBe(200)
    expect(data.matched).toBe("static")
  })

  test("should handle mixed static and param segments vs wildcard", async () => {
    // Wildcard
    createRoute("GET", "/:path*").handler(({ res }) =>
      res.ok({ matched: "wildcard" }),
    )

    // Mixed route (higher specificity)
    createRoute("GET", "/api/users/:id").handler(({ params, res }) =>
      res.ok({ matched: "mixed", id: params.id }),
    )

    server = createServer({ port: 3805 })
    await server.start()

    const response = await fetch("http://localhost:3805/api/users/456")
    const data = (await response.json()) as { matched: string; id: string }

    expect(response.status).toBe(200)
    expect(data.matched).toBe("mixed")
    expect(data.id).toBe("456")
  })

  test("should correctly calculate specificity scores", async () => {
    // All registered in "wrong" order (wildcard first)
    createRoute("GET", "/:path*").handler(({ res }) =>
      res.ok({ matched: "wildcard" }),
    )

    createRoute("GET", "/api/:resource").handler(({ res }) =>
      res.ok({ matched: "one-static-one-param" }),
    )

    createRoute("GET", "/api/users").handler(({ res }) =>
      res.ok({ matched: "two-static" }),
    )

    createRoute("GET", "/api/users/:id").handler(({ res }) =>
      res.ok({ matched: "two-static-one-param" }),
    )

    server = createServer({ port: 3806 })
    await server.start()

    // Most specific: /api/users/:id (score: 3+3+2 = 8)
    const resp1 = await fetch("http://localhost:3806/api/users/123")
    const data1 = (await resp1.json()) as { matched: string }
    expect(data1.matched).toBe("two-static-one-param")

    // Second: /api/users (score: 3+3 = 6)
    const resp2 = await fetch("http://localhost:3806/api/users")
    const data2 = (await resp2.json()) as { matched: string }
    expect(data2.matched).toBe("two-static")

    // Third: /api/:resource (score: 3+2 = 5)
    const resp3 = await fetch("http://localhost:3806/api/posts")
    const data3 = (await resp3.json()) as { matched: string }
    expect(data3.matched).toBe("one-static-one-param")

    // Least specific: /:path* (score: 1)
    const resp4 = await fetch("http://localhost:3806/random/path")
    const data4 = (await resp4.json()) as { matched: string }
    expect(data4.matched).toBe("wildcard")
  })
})
