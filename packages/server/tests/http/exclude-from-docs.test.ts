import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createRoute } from "../../src/http/route-builder"
import { routeRegistry } from "../../src/http/route-registry"
import { createServer } from "../../src/server"

describe("Exclude from Docs", () => {
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

  test("should exclude route from OpenAPI spec", async () => {
    // Public route (included in docs)
    createRoute("GET", "/api/public")
      .openapi({
        operationId: "getPublic",
        summary: "Public endpoint",
        tags: ["Public"],
      })
      .handler(({ res }) => res.ok({ public: true }))

    // Internal route (excluded from docs)
    createRoute("GET", "/api/internal")
      .excludeFromDocs()
      .openapi({
        operationId: "getInternal",
        summary: "Internal endpoint",
        tags: ["Internal"],
      })
      .handler(({ res }) => res.ok({ internal: true }))

    server = createServer({
      port: 3900,
      openapi: {
        title: "Test API",
        version: "1.0.0",
      },
    })

    const specResult = await server.http.getOpenApiSpec()

    expect(specResult.isOk()).toBe(true)

    if (specResult.isOk()) {
      const spec = specResult.value
      const paths = spec.paths as Record<string, unknown>

      // Public route should be in the spec
      expect(paths["/api/public"]).toBeDefined()

      // Internal route should NOT be in the spec
      expect(paths["/api/internal"]).toBeUndefined()
    }
  })

  test("excluded route should still be accessible", async () => {
    createRoute("GET", "/api/hidden")
      .excludeFromDocs()
      .handler(({ res }) => res.ok({ message: "hidden but accessible" }))

    server = createServer({ port: 3901 })
    await server.start()

    const response = await fetch("http://localhost:3901/api/hidden")
    const data = (await response.json()) as { message: string }

    expect(response.status).toBe(200)
    expect(data.message).toBe("hidden but accessible")
  })

  test("excludeFromDocs can be toggled", async () => {
    // Route excluded from docs
    createRoute("GET", "/api/route1")
      .excludeFromDocs(true)
      .handler(({ res }) => res.ok({ route: 1 }))

    // Route included in docs (explicitly set to false)
    createRoute("GET", "/api/route2")
      .excludeFromDocs(false)
      .handler(({ res }) => res.ok({ route: 2 }))

    server = createServer({
      port: 3902,
      openapi: {
        title: "Test API",
        version: "1.0.0",
      },
    })

    const specResult = await server.http.getOpenApiSpec()

    expect(specResult.isOk()).toBe(true)

    if (specResult.isOk()) {
      const spec = specResult.value
      const paths = spec.paths as Record<string, unknown>

      expect(paths["/api/route1"]).toBeUndefined()
      expect(paths["/api/route2"]).toBeDefined()
    }
  })

  test("routes without excludeFromDocs should be included by default", async () => {
    createRoute("GET", "/api/default")
      .openapi({
        operationId: "getDefault",
        summary: "Default behavior",
      })
      .handler(({ res }) => res.ok({ default: true }))

    server = createServer({
      port: 3903,
      openapi: {
        title: "Test API",
        version: "1.0.0",
      },
    })

    const specResult = await server.http.getOpenApiSpec()

    expect(specResult.isOk()).toBe(true)

    if (specResult.isOk()) {
      const spec = specResult.value
      const paths = spec.paths as Record<string, unknown>

      expect(paths["/api/default"]).toBeDefined()
    }
  })

  test("can exclude multiple routes with different patterns", async () => {
    // Wildcard route excluded
    createRoute("GET", "/:path*")
      .excludeFromDocs()
      .handler(({ res }) => res.ok({ wildcard: true }))

    // Parameterized route excluded
    createRoute("GET", "/internal/:id")
      .excludeFromDocs()
      .handler(({ res }) => res.ok({ internal: true }))

    // Static route included
    createRoute("GET", "/api/public")
      .openapi({
        operationId: "getPublic",
        summary: "Public endpoint",
      })
      .handler(({ res }) => res.ok({ public: true }))

    server = createServer({
      port: 3904,
      openapi: {
        title: "Test API",
        version: "1.0.0",
      },
    })

    const specResult = await server.http.getOpenApiSpec()

    expect(specResult.isOk()).toBe(true)

    if (specResult.isOk()) {
      const spec = specResult.value
      const paths = spec.paths as Record<string, unknown>

      expect(paths["/{path}"]).toBeUndefined()
      expect(paths["/internal/{id}"]).toBeUndefined()
      expect(paths["/api/public"]).toBeDefined()
    }
  })
})
