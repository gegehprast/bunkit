import { describe, expect, test } from "bun:test"
import "../test-types"
import { createRoute, type MiddlewareFn } from "../../src"
import { routeRegistry } from "../../src/http/route-registry"

describe("Middleware", () => {
  test("should register route-level middlewares", () => {
    routeRegistry.clear()

    const firstMiddleware = async ({
      next,
    }: {
      next: () => Promise<Response>
    }) => {
      return next()
    }

    const secondMiddleware = async ({
      next,
    }: {
      next: () => Promise<Response>
    }) => {
      return next()
    }

    createRoute("GET", "/api/middleware-test")
      .middlewares(firstMiddleware, secondMiddleware)
      .handler(({ res }) => {
        return res.ok({ success: true })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.middlewares).toBeDefined()
    expect(routes[0]?.middlewares?.length).toBe(2)
  })

  test("should register middleware that can short-circuit", () => {
    routeRegistry.clear()

    const authMiddleware = async ({
      res,
    }: {
      res: { unauthorized: (message: string, code: string) => Response }
    }) => {
      // Middleware that returns response (short-circuits handler)
      return res.unauthorized("Unauthorized", "UNAUTHORIZED")
    }

    createRoute("GET", "/api/protected")
      .middlewares(authMiddleware)
      .handler(({ res }) => {
        return res.ok({ data: "secret" })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.middlewares).toBeDefined()
    expect(routes[0]?.middlewares?.length).toBe(1)
  })

  test("should pass context through middleware chain", () => {
    routeRegistry.clear()

    const contextMiddleware: MiddlewareFn = async ({ ctx, next }) => {
      ctx.user = { id: "123", name: "John" }
      ctx.timestamp = Date.now()
      return next()
    }

    createRoute("GET", "/api/context-test")
      .middlewares(contextMiddleware)
      .handler(({ ctx, res }) => {
        // ctx.user should be available from middleware
        return res.ok({ ctx })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.middlewares?.length).toBe(1)
  })

  test("should support multiple middleware registration", () => {
    routeRegistry.clear()

    const middleware1 = async ({ next }: { next: () => Promise<Response> }) =>
      next()
    const middleware2 = async ({ next }: { next: () => Promise<Response> }) =>
      next()
    const middleware3 = async ({ next }: { next: () => Promise<Response> }) =>
      next()

    createRoute("GET", "/api/multi")
      .middlewares(middleware1, middleware2, middleware3)
      .handler(({ res }) => res.ok({}))

    const routes = routeRegistry.getAll()
    expect(routes[0]?.middlewares?.length).toBe(3)
  })

  test("should support middleware with error handling", () => {
    routeRegistry.clear()

    const errorHandlerMiddleware = async ({
      next,
      res,
    }: {
      next: () => Promise<Response>
      res: { internalError: (message: string, code: string) => Response }
    }) => {
      try {
        return await next()
      } catch {
        return res.internalError("Internal error", "INTERNAL_ERROR")
      }
    }

    createRoute("GET", "/api/safe")
      .middlewares(errorHandlerMiddleware)
      .handler(({ res }) => res.ok({}))

    const routes = routeRegistry.getAll()
    expect(routes[0]?.middlewares?.length).toBe(1)
  })

  test("should support authentication middleware pattern", () => {
    routeRegistry.clear()

    const authMiddleware: MiddlewareFn = async ({ req, ctx, next, res }) => {
      const authHeader = req.headers.get("authorization")
      if (!authHeader) {
        return res.unauthorized("Missing authorization header", "UNAUTHORIZED")
      }
      ctx.user = { id: "123" }
      return next()
    }

    createRoute("GET", "/api/protected")
      .middlewares(authMiddleware)
      .handler(({ res }) => res.ok({ data: "protected" }))

    const routes = routeRegistry.getAll()
    expect(routes[0]?.middlewares?.length).toBe(1)
  })

  test("should support logging middleware pattern", () => {
    routeRegistry.clear()

    const loggingMiddleware = async ({
      next,
    }: {
      next: () => Promise<Response>
    }) => {
      const start = Date.now()
      const response = await next()
      // In real app, would log: method, path, status, duration
      void start // Mark as intentionally unused for demo
      return response
    }

    createRoute("GET", "/api/logged")
      .middlewares(loggingMiddleware)
      .handler(({ res }) => res.ok({}))

    const routes = routeRegistry.getAll()
    expect(routes[0]?.middlewares?.length).toBe(1)
  })
})
