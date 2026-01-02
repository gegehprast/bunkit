import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { routeRegistry } from "../src/http/route-registry"
import { createRoute, createServer } from "../src/index"

describe("@bunkit/server - Basic functionality", () => {
  test("should register a route", () => {
    routeRegistry.clear()

    createRoute("GET", "/api/test").handler(({ res }) => {
      return res.ok({ message: "test" })
    })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(1)
    expect(routes[0]?.method).toBe("GET")
    expect(routes[0]?.path).toBe("/api/test")
  })

  test("should extract path parameters correctly", () => {
    routeRegistry.clear()

    createRoute("GET", "/api/users/:userId").handler(({ params, res }) => {
      return res.ok({ userId: params.userId })
    })

    const match = routeRegistry.match("GET", "/api/users/123")
    expect(match).not.toBeNull()
    expect(match?.params.userId).toBe("123")
  })

  test("should handle multiple path parameters", () => {
    routeRegistry.clear()

    createRoute("GET", "/api/users/:userId/posts/:postId").handler(
      ({ params, res }) => {
        return res.ok({
          userId: params.userId,
          postId: params.postId,
        })
      },
    )

    const match = routeRegistry.match("GET", "/api/users/123/posts/456")
    expect(match).not.toBeNull()
    expect(match?.params.userId).toBe("123")
    expect(match?.params.postId).toBe("456")
  })

  test("should validate query parameters with Zod", () => {
    routeRegistry.clear()

    const QuerySchema = z.object({
      page: z.string(),
      limit: z.string(),
    })

    createRoute("GET", "/api/items")
      .query(QuerySchema)
      .handler(({ query, res }) => {
        // query is typed as { page: string, limit: string }
        return res.ok({ page: query.page, limit: query.limit })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.querySchema).toBeDefined()
  })

  test("should validate body with Zod", () => {
    routeRegistry.clear()

    const BodySchema = z.object({
      title: z.string(),
      description: z.string(),
    })

    createRoute("POST", "/api/items")
      .body(BodySchema)
      .handler(({ body, res }) => {
        // body is typed as { title: string, description: string }
        return res.created(body)
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.bodySchema).toBeDefined()
  })

  test("should handle response schemas", () => {
    routeRegistry.clear()

    const ResponseSchema = z.object({
      id: z.string(),
      name: z.string(),
    })

    createRoute("GET", "/api/user")
      .response(ResponseSchema)
      .handler(({ res }) => {
        return res.ok({ id: "1", name: "John" })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.responseSchema).toBeDefined()
  })

  test("should create server instance", () => {
    const server = createServer({ port: 3001 })
    expect(server).toBeDefined()
    expect(server.start).toBeDefined()
    expect(server.stop).toBeDefined()
    expect(server.getOpenApiSpec).toBeDefined()
    expect(server.exportOpenApiSpec).toBeDefined()
  })

  test("should generate OpenAPI spec", async () => {
    routeRegistry.clear()

    const TodoSchema = z
      .object({
        id: z.string(),
        title: z.string(),
      })
      .meta({ id: "Todo" })

    createRoute("GET", "/api/todos/:id")
      .openapi({ operationId: "getTodo", tags: ["Todos"] })
      .response(TodoSchema)
      .errors([404])
      .handler(({ params, res }) => {
        return res.ok({ id: params.id, title: "Test" })
      })

    const server = createServer()
    const spec = await server.getOpenApiSpec()

    expect(spec.isOk()).toBe(true)
    const specValue = spec.unwrap()
    expect(specValue.openapi).toBe("3.1.0")
    expect(specValue.paths).toBeDefined()
    expect(specValue.paths["/api/todos/{id}"]).toBeDefined()
  })

  test("should handle multiple response schemas using .responses()", () => {
    routeRegistry.clear()

    const TodoSchema = z.object({
      id: z.string(),
      title: z.string(),
    })

    const ErrorSchema = z.object({
      message: z.string(),
      code: z.string(),
    })

    createRoute("POST", "/api/todos")
      .body(z.object({ title: z.string() }))
      .responses({
        201: {
          description: "Created",
          content: {
            "application/json": { schema: TodoSchema },
          },
        },
        400: {
          description: "Bad Request",
          content: {
            "application/json": { schema: ErrorSchema },
          },
        },
      })
      .handler(({ body, res }) => {
        if (!body.title.trim()) {
          return res.badRequest("Title cannot be empty", "INVALID_TITLE")
        }
        return res.created({ id: "1", title: body.title })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.responses).toBeDefined()
    expect(routes[0]?.responses?.[201]).toBeDefined()
    expect(routes[0]?.responses?.[400]).toBeDefined()
  })

  test("should handle custom error responses using .errorResponses()", () => {
    routeRegistry.clear()

    const NotFoundErrorSchema = z.object({
      message: z.string(),
      code: z.string(),
      resourceId: z.string(),
    })

    createRoute("GET", "/api/todos/:id")
      .response(
        z.object({
          id: z.string(),
          title: z.string(),
        }),
      )
      .errorResponses({
        404: {
          description: "Todo not found",
          content: {
            "application/json": { schema: NotFoundErrorSchema },
          },
        },
      })
      .handler(({ params, res }) => {
        const todo = null // simulate not found
        if (!todo) {
          return res.notFound("Todo not found", "TODO_NOT_FOUND")
        }
        return res.ok({ id: params.id, title: "Test" })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.errorResponses).toBeDefined()
    expect(routes[0]?.errorResponses?.[404]).toBeDefined()
    expect(routes[0]?.errorResponses?.[404]?.description).toBe("Todo not found")
  })

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

    const contextMiddleware = async ({
      ctx,
      next,
    }: {
      ctx: Record<string, unknown>
      next: () => Promise<Response>
    }) => {
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

  test("should demonstrate handler return type validation", () => {
    routeRegistry.clear()

    const UserSchema = z.object({
      id: z.string(),
      name: z.string(),
      email: z.email(),
    })

    // This should compile - handler returns correct type
    createRoute("GET", "/api/user/:id")
      .response(UserSchema)
      .handler(({ params, res }) => {
        // Valid response matching UserSchema
        return res.ok({
          id: params.id,
          name: "John Doe",
          email: "john@example.com",
        })
      })

    // Multiple response types
    createRoute("POST", "/api/user")
      .body(
        z.object({
          name: z.string(),
          email: z.email(),
        }),
      )
      .responses({
        201: {
          description: "Created",
          content: {
            "application/json": { schema: UserSchema },
          },
        },
        409: {
          description: "Conflict",
          content: {
            "application/json": {
              schema: z.object({
                message: z.string(),
                existingId: z.string(),
              }),
            },
          },
        },
      })
      .handler(({ body, res }) => {
        // Can return either 201 or 409
        const exists = false
        if (exists) {
          return res.custom(
            JSON.stringify({
              message: "User already exists",
              existingId: "123",
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            },
          )
        }
        return res.created({
          id: "new-id",
          name: body.name,
          email: body.email,
        })
      })

    const routes = routeRegistry.getAll()
    expect(routes.length).toBe(2)
    expect(routes[0]?.responseSchema).toBeDefined()
    expect(routes[1]?.responses).toBeDefined()
  })

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

  test("should work with complex nested schemas", () => {
    routeRegistry.clear()

    const AddressSchema = z.object({
      street: z.string(),
      city: z.string(),
      country: z.string(),
    })

    const UserSchema = z.object({
      id: z.string(),
      name: z.string(),
      email: z.email(),
      address: AddressSchema,
      tags: z.array(z.string()),
      metadata: z.record(z.string(), z.string()),
    })

    createRoute("POST", "/api/users")
      .body(
        z.object({
          name: z.string(),
          email: z.email(),
          address: AddressSchema,
          tags: z.array(z.string()).optional(),
        }),
      )
      .response(UserSchema)
      .handler(({ body, res }) => {
        return res.created({
          id: "new-id",
          name: body.name,
          email: body.email,
          address: body.address,
          tags: body.tags ?? [],
          metadata: { created: new Date().toISOString() },
        })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.bodySchema).toBeDefined()
    expect(routes[0]?.responseSchema).toBeDefined()
  })
})
