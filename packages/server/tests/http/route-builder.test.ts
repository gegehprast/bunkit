import { beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { routeRegistry } from "../../src/http/route-registry"
import { createRoute } from "../../src/index"

describe("RouteBuilder", () => {
  beforeEach(() => {
    routeRegistry.clear()
  })

  describe("createRoute", () => {
    test("should create a GET route", () => {
      createRoute("GET", "/api/test").handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes.length).toBe(1)
      expect(routes[0]?.method).toBe("GET")
      expect(routes[0]?.path).toBe("/api/test")
    })

    test("should create routes for all HTTP methods", () => {
      createRoute("GET", "/get").handler(({ res }) => res.ok({}))
      createRoute("POST", "/post").handler(({ res }) => res.ok({}))
      createRoute("PUT", "/put").handler(({ res }) => res.ok({}))
      createRoute("PATCH", "/patch").handler(({ res }) => res.ok({}))
      createRoute("DELETE", "/delete").handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes.length).toBe(5)
      expect(routes.map((r) => r.method)).toEqual([
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
      ])
    })
  })

  describe("query schema", () => {
    test("should register query schema", () => {
      const QuerySchema = z.object({
        page: z.string(),
        limit: z.string(),
      })

      createRoute("GET", "/api/items")
        .query(QuerySchema)
        .handler(({ query, res }) => {
          // Type check: query should be typed
          return res.ok({ page: query.page, limit: query.limit })
        })

      const routes = routeRegistry.getAll()
      expect(routes[0]?.querySchema).toBeDefined()
    })

    test("should allow optional query parameters", () => {
      const QuerySchema = z.object({
        search: z.string().optional(),
        filter: z.string().optional(),
      })

      createRoute("GET", "/api/search")
        .query(QuerySchema)
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.querySchema).toBeDefined()
    })
  })

  describe("body schema", () => {
    test("should register body schema", () => {
      const BodySchema = z.object({
        title: z.string(),
        content: z.string(),
      })

      createRoute("POST", "/api/posts")
        .body(BodySchema)
        .handler(({ body, res }) => {
          return res.created({ title: body.title, content: body.content })
        })

      const routes = routeRegistry.getAll()
      expect(routes[0]?.bodySchema).toBeDefined()
    })

    test("should support nested body schemas", () => {
      const AddressSchema = z.object({
        street: z.string(),
        city: z.string(),
      })

      const UserSchema = z.object({
        name: z.string(),
        address: AddressSchema,
      })

      createRoute("POST", "/api/users")
        .body(UserSchema)
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.bodySchema).toBeDefined()
    })
  })

  describe("response schema", () => {
    test("should register response schema", () => {
      const ResponseSchema = z.object({
        id: z.string(),
        name: z.string(),
      })

      createRoute("GET", "/api/user")
        .response(ResponseSchema)
        .handler(({ res }) => res.ok({ id: "1", name: "Test" }))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.response).toBeDefined()
      expect(routes[0]?.response?.content).toBeDefined()
      expect(
        routes[0]?.response?.content["application/json"]?.schema,
      ).toBeDefined()
    })

    test("should accept response options", () => {
      const ResponseSchema = z.object({ id: z.string() })

      createRoute("POST", "/api/items")
        .response(ResponseSchema, { description: "Created item", status: 201 })
        .handler(({ res }) => res.created({ id: "1" }))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.response).toBeDefined()
      expect(routes[0]?.response?.status).toBe(201)
      expect(routes[0]?.response?.description).toBe("Created item")
      expect(routes[0]?.response?.content).toBeDefined()
    })
  })

  describe("errors", () => {
    test("should register common error responses by status code", () => {
      createRoute("GET", "/api/resource/:id")
        .errors([400, 404, 500])
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.errorResponses?.[400]).toBeDefined()
      expect(routes[0]?.errorResponses?.[404]).toBeDefined()
      expect(routes[0]?.errorResponses?.[500]).toBeDefined()
    })

    test("should handle multiple calls to errors()", () => {
      createRoute("GET", "/api/test")
        .errors([400])
        .errors([404])
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.errorResponses?.[400]).toBeDefined()
      expect(routes[0]?.errorResponses?.[404]).toBeDefined()
    })
  })

  describe("errorResponses (custom)", () => {
    test("should register custom error response schemas", () => {
      const CustomErrorSchema = z.object({
        message: z.string(),
        errorCode: z.number(),
      })

      createRoute("GET", "/api/data")
        .errorResponses({
          422: {
            description: "Validation Error",
            content: { "application/json": { schema: CustomErrorSchema } },
          },
        })
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.errorResponses?.[422]).toBeDefined()
      expect(routes[0]?.errorResponses?.[422]?.description).toBe(
        "Validation Error",
      )
    })

    test("should merge with errors()", () => {
      createRoute("GET", "/api/test")
        .errors([400])
        .errorResponses({
          422: { description: "Custom Error" },
        })
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.errorResponses?.[400]).toBeDefined()
      expect(routes[0]?.errorResponses?.[422]).toBeDefined()
    })
  })

  describe("openapi metadata", () => {
    test("should register openapi metadata", () => {
      createRoute("GET", "/api/users")
        .openapi({
          operationId: "getUsers",
          tags: ["Users"],
          summary: "Get all users",
          description: "Returns a list of all users",
        })
        .handler(({ res }) => res.ok([]))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.metadata?.operationId).toBe("getUsers")
      expect(routes[0]?.metadata?.tags).toEqual(["Users"])
      expect(routes[0]?.metadata?.summary).toBe("Get all users")
      expect(routes[0]?.metadata?.description).toBe(
        "Returns a list of all users",
      )
    })
  })

  describe("middlewares", () => {
    test("should register single middleware", () => {
      const middleware = async ({ next }: { next: () => Promise<Response> }) =>
        next()

      createRoute("GET", "/api/test")
        .middlewares(middleware)
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.middlewares?.length).toBe(1)
    })

    test("should register multiple middlewares", () => {
      const middleware1 = async ({ next }: { next: () => Promise<Response> }) =>
        next()
      const middleware2 = async ({ next }: { next: () => Promise<Response> }) =>
        next()
      const middleware3 = async ({ next }: { next: () => Promise<Response> }) =>
        next()

      createRoute("GET", "/api/test")
        .middlewares(middleware1, middleware2, middleware3)
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.middlewares?.length).toBe(3)
    })

    test("should accumulate middlewares across multiple calls", () => {
      const middleware1 = async ({ next }: { next: () => Promise<Response> }) =>
        next()
      const middleware2 = async ({ next }: { next: () => Promise<Response> }) =>
        next()

      createRoute("GET", "/api/test")
        .middlewares(middleware1)
        .middlewares(middleware2)
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.middlewares?.length).toBe(2)
    })
  })

  describe("security", () => {
    test("should register security requirements", () => {
      createRoute("GET", "/api/protected")
        .security([{ bearerAuth: [] }])
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.security).toEqual([{ bearerAuth: [] }])
    })

    test("should support multiple security schemes", () => {
      createRoute("GET", "/api/multi-auth")
        .security([{ bearerAuth: [] }, { apiKey: [] }])
        .handler(({ res }) => res.ok({}))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.security?.length).toBe(2)
    })
  })

  describe("fluent API chaining", () => {
    test("should support full chain", () => {
      const QuerySchema = z.object({ page: z.string() })
      const BodySchema = z.object({ data: z.string() })
      const ResponseSchema = z.object({ result: z.string() })
      const middleware = async ({ next }: { next: () => Promise<Response> }) =>
        next()

      createRoute("POST", "/api/complete")
        .openapi({ operationId: "complete", tags: ["Test"] })
        .middlewares(middleware)
        .security([{ bearerAuth: [] }])
        .query(QuerySchema)
        .body(BodySchema)
        .response(ResponseSchema)
        .errors([400, 401])
        .handler(({ res }) => res.ok({ result: "ok" }))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.metadata?.operationId).toBe("complete")
      expect(routes[0]?.middlewares?.length).toBe(1)
      expect(routes[0]?.security).toBeDefined()
      expect(routes[0]?.querySchema).toBeDefined()
      expect(routes[0]?.bodySchema).toBeDefined()
      expect(routes[0]?.response).toBeDefined()
      expect(routes[0]?.errorResponses?.[400]).toBeDefined()
      expect(routes[0]?.errorResponses?.[401]).toBeDefined()
    })

    test("should allow any order of chained methods", () => {
      const QuerySchema = z.object({ q: z.string() })
      const ResponseSchema = z.object({ r: z.string() })

      // Different order than typical
      createRoute("GET", "/api/flexible")
        .errors([404])
        .response(ResponseSchema)
        .query(QuerySchema)
        .openapi({ operationId: "flexible" })
        .handler(({ res }) => res.ok({ r: "ok" }))

      const routes = routeRegistry.getAll()
      expect(routes[0]?.querySchema).toBeDefined()
      expect(routes[0]?.response).toBeDefined()
      expect(routes[0]?.metadata?.operationId).toBe("flexible")
    })
  })
})
