import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { routeRegistry } from "../../src/http/route-registry"
import { createRoute, createServer } from "../../src/index"
import type { Server } from "../../src/types/server"

// Helper to parse JSON response with type assertion
const json = <T = Record<string, unknown>>(response: Response): Promise<T> =>
  response.json() as Promise<T>

describe("CORS", () => {
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

  describe("Preflight requests", () => {
    test("should handle OPTIONS preflight request", async () => {
      createRoute("POST", "/api/data").handler(({ res }) => res.ok({}))

      server = createServer({
        port: 3400,
        cors: {
          origin: "*",
        },
      })
      await server.start()

      const response = await fetch("http://localhost:3400/api/data", {
        method: "OPTIONS",
        headers: { Origin: "http://example.com" },
      })

      expect(response.status).toBe(204)
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://example.com",
      )
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "POST",
      )
    })

    test("should include default allowed methods", async () => {
      server = createServer({
        port: 3401,
        cors: { origin: "*" },
      })
      await server.start()

      const response = await fetch("http://localhost:3401/api/test", {
        method: "OPTIONS",
        headers: { Origin: "http://example.com" },
      })

      const methods = response.headers.get("Access-Control-Allow-Methods")
      expect(methods).toContain("GET")
      expect(methods).toContain("POST")
      expect(methods).toContain("PUT")
      expect(methods).toContain("DELETE")
    })

    test("should include custom allowed methods", async () => {
      server = createServer({
        port: 3402,
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
        },
      })
      await server.start()

      const response = await fetch("http://localhost:3402/api/test", {
        method: "OPTIONS",
        headers: { Origin: "http://example.com" },
      })

      const methods = response.headers.get("Access-Control-Allow-Methods")
      expect(methods).toBe("GET, POST")
    })

    test("should include default allowed headers", async () => {
      server = createServer({
        port: 3403,
        cors: { origin: "*" },
      })
      await server.start()

      const response = await fetch("http://localhost:3403/api/test", {
        method: "OPTIONS",
        headers: { Origin: "http://example.com" },
      })

      const headers = response.headers.get("Access-Control-Allow-Headers")
      expect(headers).toContain("Content-Type")
      expect(headers).toContain("Authorization")
    })

    test("should include custom allowed headers", async () => {
      server = createServer({
        port: 3404,
        cors: {
          origin: "*",
          allowedHeaders: ["X-Custom-Header", "X-API-Key"],
        },
      })
      await server.start()

      const response = await fetch("http://localhost:3404/api/test", {
        method: "OPTIONS",
        headers: { Origin: "http://example.com" },
      })

      const headers = response.headers.get("Access-Control-Allow-Headers")
      expect(headers).toBe("X-Custom-Header, X-API-Key")
    })

    test("should include max age when specified", async () => {
      server = createServer({
        port: 3405,
        cors: {
          origin: "*",
          maxAge: 86400,
        },
      })
      await server.start()

      const response = await fetch("http://localhost:3405/api/test", {
        method: "OPTIONS",
        headers: { Origin: "http://example.com" },
      })

      expect(response.headers.get("Access-Control-Max-Age")).toBe("86400")
    })
  })

  describe("Origin validation", () => {
    test("should allow all origins with wildcard", async () => {
      createRoute("GET", "/api/data").handler(({ res }) =>
        res.ok({ data: "test" }),
      )

      server = createServer({
        port: 3406,
        cors: { origin: "*" },
      })
      await server.start()

      const response = await fetch("http://localhost:3406/api/data", {
        headers: { Origin: "http://any-origin.com" },
      })

      expect(response.status).toBe(200)
    })

    test("should allow specific origin", async () => {
      createRoute("GET", "/api/data").handler(({ res }) => res.ok({}))

      server = createServer({
        port: 3407,
        cors: { origin: "http://allowed.com" },
      })
      await server.start()

      // Allowed origin
      const allowedResponse = await fetch("http://localhost:3407/api/data", {
        headers: { Origin: "http://allowed.com" },
      })
      expect(allowedResponse.status).toBe(200)

      // Disallowed origin
      const disallowedResponse = await fetch("http://localhost:3407/api/data", {
        headers: { Origin: "http://forbidden.com" },
      })
      expect(disallowedResponse.status).toBe(403)
    })

    test("should allow array of origins", async () => {
      createRoute("GET", "/api/data").handler(({ res }) => res.ok({}))

      server = createServer({
        port: 3408,
        cors: {
          origin: ["http://app1.com", "http://app2.com", "http://app3.com"],
        },
      })
      await server.start()

      // First allowed origin
      const response1 = await fetch("http://localhost:3408/api/data", {
        headers: { Origin: "http://app1.com" },
      })
      expect(response1.status).toBe(200)

      // Third allowed origin
      const response3 = await fetch("http://localhost:3408/api/data", {
        headers: { Origin: "http://app3.com" },
      })
      expect(response3.status).toBe(200)

      // Not in array
      const notAllowed = await fetch("http://localhost:3408/api/data", {
        headers: { Origin: "http://app4.com" },
      })
      expect(notAllowed.status).toBe(403)
    })

    test("should allow custom origin validation function", async () => {
      createRoute("GET", "/api/data").handler(({ res }) => res.ok({}))

      server = createServer({
        port: 3409,
        cors: {
          origin: (origin) => origin.endsWith(".mycompany.com"),
        },
      })
      await server.start()

      // Matching subdomain
      const allowed = await fetch("http://localhost:3409/api/data", {
        headers: { Origin: "http://api.mycompany.com" },
      })
      expect(allowed.status).toBe(200)

      // Another matching subdomain
      const allowed2 = await fetch("http://localhost:3409/api/data", {
        headers: { Origin: "http://app.mycompany.com" },
      })
      expect(allowed2.status).toBe(200)

      // Non-matching origin
      const notAllowed = await fetch("http://localhost:3409/api/data", {
        headers: { Origin: "http://other.com" },
      })
      expect(notAllowed.status).toBe(403)
    })
  })

  describe("CORS headers on responses", () => {
    test("should add CORS headers to regular responses", async () => {
      createRoute("GET", "/api/data").handler(({ res }) =>
        res.ok({ message: "hello" }),
      )

      server = createServer({
        port: 3410,
        cors: {
          origin: "*",
          credentials: true,
        },
      })
      await server.start()

      const response = await fetch("http://localhost:3410/api/data", {
        headers: { Origin: "http://example.com" },
      })

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://example.com",
      )
    })

    test("should include credentials header when enabled", async () => {
      createRoute("GET", "/api/data").handler(({ res }) => res.ok({}))

      server = createServer({
        port: 3411,
        cors: {
          origin: "http://example.com",
          credentials: true,
        },
      })
      await server.start()

      const response = await fetch("http://localhost:3411/api/data", {
        headers: { Origin: "http://example.com" },
      })

      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true",
      )
    })

    test("should include exposed headers", async () => {
      createRoute("GET", "/api/data").handler(({ res }) => res.ok({}))

      server = createServer({
        port: 3412,
        cors: {
          origin: "*",
          exposedHeaders: ["X-Total-Count", "X-Page-Count"],
        },
      })
      await server.start()

      const response = await fetch("http://localhost:3412/api/data", {
        headers: { Origin: "http://example.com" },
      })

      const exposed = response.headers.get("Access-Control-Expose-Headers")
      expect(exposed).toBe("X-Total-Count, X-Page-Count")
    })
  })

  describe("No CORS configuration", () => {
    test("should work without CORS enabled", async () => {
      createRoute("GET", "/api/data").handler(({ res }) =>
        res.ok({ message: "no cors" }),
      )

      server = createServer({ port: 3413 })
      await server.start()

      const response = await fetch("http://localhost:3413/api/data")
      const data = await json(response)

      expect(response.status).toBe(200)
      expect(data.message).toBe("no cors")
      // No CORS headers
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
    })

    test("should not handle OPTIONS preflight without CORS", async () => {
      createRoute("GET", "/api/data").handler(({ res }) => res.ok({}))

      server = createServer({ port: 3414 })
      await server.start()

      const response = await fetch("http://localhost:3414/api/data", {
        method: "OPTIONS",
      })

      // Without CORS, OPTIONS returns 404 (no route for OPTIONS)
      expect(response.status).toBe(404)
    })
  })
})
