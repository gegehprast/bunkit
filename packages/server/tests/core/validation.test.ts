import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { createRoute } from "../../src"
import { routeRegistry } from "../../src/http/route-registry"

describe("Validation", () => {
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

  test("should support optional query parameters", () => {
    routeRegistry.clear()

    const QuerySchema = z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sort: z.enum(["asc", "desc"]).optional(),
    })

    createRoute("GET", "/api/items")
      .query(QuerySchema)
      .handler(({ query, res }) => {
        return res.ok({ query })
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.querySchema).toBeDefined()
  })

  test("should support nested body schemas", () => {
    routeRegistry.clear()

    const AddressSchema = z.object({
      street: z.string(),
      city: z.string(),
      country: z.string(),
    })

    const UserSchema = z.object({
      name: z.string(),
      email: z.email(),
      address: AddressSchema,
    })

    createRoute("POST", "/api/users")
      .body(UserSchema)
      .handler(({ body, res }) => {
        return res.created(body)
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.bodySchema).toBeDefined()
  })

  test("should support array validation in body", () => {
    routeRegistry.clear()

    const BodySchema = z.object({
      name: z.string(),
      tags: z.array(z.string()),
      scores: z.array(z.number()),
    })

    createRoute("POST", "/api/items")
      .body(BodySchema)
      .handler(({ body, res }) => {
        return res.created(body)
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.bodySchema).toBeDefined()
  })

  test("should support union types in validation", () => {
    routeRegistry.clear()

    const BodySchema = z.object({
      value: z.union([z.string(), z.number()]),
      status: z.enum(["active", "inactive", "pending"]),
    })

    createRoute("POST", "/api/items")
      .body(BodySchema)
      .handler(({ body, res }) => {
        return res.created(body)
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.bodySchema).toBeDefined()
  })

  test("should support record/dictionary validation", () => {
    routeRegistry.clear()

    const BodySchema = z.object({
      metadata: z.record(z.string(), z.string()),
      settings: z.record(z.string(), z.boolean()),
    })

    createRoute("POST", "/api/config")
      .body(BodySchema)
      .handler(({ body, res }) => {
        return res.created(body)
      })

    const routes = routeRegistry.getAll()
    expect(routes[0]?.bodySchema).toBeDefined()
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
    expect(routes[0]?.response).toBeDefined()
  })
})
