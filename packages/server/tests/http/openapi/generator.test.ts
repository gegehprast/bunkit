import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { routeRegistry } from "../../../src/http/route-registry"
import { createRoute, createServer } from "../../../src/index"
import type { Server } from "../../../src/types/server"

describe("OpenAPI Generator", () => {
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

  describe("Basic spec generation", () => {
    test("should generate valid OpenAPI 3.1.0 spec", async () => {
      createRoute("GET", "/api/test").handler(({ res }) => res.ok({}))

      server = createServer()
      const result = await server.http.getOpenApiSpec()

      expect(result.isOk()).toBe(true)
      const spec = result.unwrap()
      expect(spec.openapi).toBe("3.1.0")
    })

    test("should include info section", async () => {
      server = createServer({
        openapi: {
          title: "Test API",
          version: "2.0.0",
          description: "A test API",
        },
      })

      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      expect(spec.info.title).toBe("Test API")
      expect(spec.info.version).toBe("2.0.0")
      expect(spec.info.description).toBe("A test API")
    })

    test("should use default info when not specified", async () => {
      server = createServer()

      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      expect(spec.info.title).toBe("API")
      expect(spec.info.version).toBe("1.0.0")
    })
  })

  describe("Paths generation", () => {
    test("should include registered routes in paths", async () => {
      createRoute("GET", "/api/users").handler(({ res }) => res.ok([]))

      createRoute("POST", "/api/users").handler(({ res }) => res.created({}))

      createRoute("GET", "/api/users/:id").handler(({ res }) => res.ok({}))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      expect(spec.paths["/api/users"]).toBeDefined()
      expect(spec.paths["/api/users"]?.get).toBeDefined()
      expect(spec.paths["/api/users"]?.post).toBeDefined()
      expect(spec.paths["/api/users/{id}"]).toBeDefined()
    })

    test("should convert path parameters to OpenAPI format", async () => {
      createRoute(
        "GET",
        "/api/orgs/:orgId/repos/:repoId/issues/:issueId",
      ).handler(({ res }) => res.ok({}))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      expect(
        spec.paths["/api/orgs/{orgId}/repos/{repoId}/issues/{issueId}"],
      ).toBeDefined()
    })

    test("should include path parameters in operation", async () => {
      createRoute("GET", "/api/users/:userId").handler(({ res }) => res.ok({}))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      const operation = spec.paths["/api/users/{userId}"]?.get
      expect(operation?.parameters).toBeDefined()

      const param = operation?.parameters?.find(
        (p: { name: string }) => p.name === "userId",
      )
      expect(param).toBeDefined()
      expect(param?.in).toBe("path")
      expect(param?.required).toBe(true)
    })
  })

  describe("Operation metadata", () => {
    test("should include operationId from metadata", async () => {
      createRoute("GET", "/api/users")
        .openapi({ operationId: "listUsers" })
        .handler(({ res }) => res.ok([]))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      expect(spec.paths["/api/users"]?.get?.operationId).toBe("listUsers")
    })

    test("should include tags from metadata", async () => {
      createRoute("GET", "/api/users")
        .openapi({ tags: ["Users", "Admin"] })
        .handler(({ res }) => res.ok([]))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      expect(spec.paths["/api/users"]?.get?.tags).toEqual(["Users", "Admin"])
    })

    test("should include summary and description", async () => {
      createRoute("GET", "/api/users")
        .openapi({
          summary: "Get all users",
          description: "Returns a paginated list of all users in the system",
        })
        .handler(({ res }) => res.ok([]))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      const operation = spec.paths["/api/users"]?.get
      expect(operation?.summary).toBe("Get all users")
      expect(operation?.description).toBe(
        "Returns a paginated list of all users in the system",
      )
    })

    test("should work without operationId when not provided", async () => {
      createRoute("GET", "/api/users").handler(({ res }) => res.ok([]))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      // Operation should exist even without operationId
      expect(spec.paths["/api/users"]?.get).toBeDefined()
    })
  })

  describe("Request schemas", () => {
    test("should include query parameter schema", async () => {
      const QuerySchema = z.object({
        page: z.string(),
        limit: z.string(),
        search: z.string().optional(),
      })

      createRoute("GET", "/api/users")
        .query(QuerySchema)
        .handler(({ res }) => res.ok([]))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      const operation = spec.paths["/api/users"]?.get
      expect(operation?.parameters).toBeDefined()

      const params = operation?.parameters as Array<{
        name: string
        in: string
        required?: boolean
      }>

      const pageParam = params?.find((p) => p.name === "page")
      expect(pageParam?.in).toBe("query")
      expect(pageParam?.required).toBe(true)

      const searchParam = params?.find((p) => p.name === "search")
      // Optional params may have required=false or required undefined
      expect(searchParam?.required).not.toBe(true)
    })

    test("should include request body schema", async () => {
      const BodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().optional(),
      })

      createRoute("POST", "/api/users")
        .body(BodySchema)
        .handler(({ res }) => res.created({}))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      const operation = spec.paths["/api/users"]?.post
      expect(operation?.requestBody).toBeDefined()
      expect(
        operation?.requestBody?.content?.["application/json"],
      ).toBeDefined()
    })
  })

  describe("Response schemas", () => {
    test("should include response schema", async () => {
      const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
      })

      createRoute("GET", "/api/user")
        .response(UserSchema)
        .handler(({ res }) => res.ok({ id: "1", name: "John" }))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      const operation = spec.paths["/api/user"]?.get
      expect(operation?.responses?.["200"]).toBeDefined()
    })

    test("should include error responses", async () => {
      createRoute("GET", "/api/resource/:id")
        .errors([404, 500])
        .handler(({ res }) => res.ok({}))

      server = createServer()
      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      const operation = spec.paths["/api/resource/{id}"]?.get
      expect(operation?.responses?.["404"]).toBeDefined()
      expect(operation?.responses?.["500"]).toBeDefined()
    })
  })

  describe("Security schemes", () => {
    test("should include security schemes in spec", async () => {
      server = createServer({
        openapi: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      })

      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      const securitySchemes = spec.components?.securitySchemes as
        | Record<string, { type?: string; scheme?: string }>
        | undefined
      expect(securitySchemes?.bearerAuth).toBeDefined()
      expect(securitySchemes?.bearerAuth?.type).toBe("http")
      expect(securitySchemes?.bearerAuth?.scheme).toBe("bearer")
    })

    test("should include route-level security requirements", async () => {
      createRoute("GET", "/api/protected")
        .security([{ bearerAuth: [] }])
        .handler(({ res }) => res.ok({}))

      server = createServer({
        openapi: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
            },
          },
        },
      })

      const result = await server.http.getOpenApiSpec()
      const spec = result.unwrap()

      const operation = spec.paths["/api/protected"]?.get
      expect(operation?.security).toEqual([{ bearerAuth: [] }])
    })
  })

  describe("Server-scoped OpenAPI generation", () => {
    test("should generate spec for server-scoped routes only", async () => {
      const server1 = createServer({
        port: 3500,
        openapi: { title: "Server 1 API" },
      })
      const server2 = createServer({
        port: 3501,
        openapi: { title: "Server 2 API" },
      })

      // Register route only to server1
      createRoute("GET", "/api/server1-only", server1)
        .openapi({ operationId: "server1Route" })
        .handler(({ res }) => res.ok({}))

      // Register route only to server2
      createRoute("GET", "/api/server2-only", server2)
        .openapi({ operationId: "server2Route" })
        .handler(({ res }) => res.ok({}))

      const spec1Result = await server1.http.getOpenApiSpec()
      const spec2Result = await server2.http.getOpenApiSpec()

      const spec1 = spec1Result.unwrap()
      const spec2 = spec2Result.unwrap()

      // Server1 spec should only have server1 route
      expect(spec1.paths["/api/server1-only"]).toBeDefined()
      expect(spec1.paths["/api/server2-only"]).toBeUndefined()

      // Server2 spec should only have server2 route
      expect(spec2.paths["/api/server2-only"]).toBeDefined()
      expect(spec2.paths["/api/server1-only"]).toBeUndefined()

      // Cleanup
      await server1.stop()
      await server2.stop()
    })
  })

  describe("Complex schemas", () => {
    test("should handle nested object schemas", async () => {
      const AddressSchema = z.object({
        street: z.string(),
        city: z.string(),
        zip: z.string(),
      })

      const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
        address: AddressSchema,
      })

      createRoute("GET", "/api/user")
        .response(UserSchema)
        .handler(({ res }) =>
          res.ok({
            id: "1",
            name: "John",
            address: { street: "123 Main", city: "NYC", zip: "10001" },
          }),
        )

      server = createServer()
      const result = await server.http.getOpenApiSpec()

      expect(result.isOk()).toBe(true)
    })

    test("should handle array schemas", async () => {
      const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
      })

      const UsersListSchema = z.array(UserSchema)

      createRoute("GET", "/api/users")
        .response(UsersListSchema)
        .handler(({ res }) => res.ok([]))

      server = createServer()
      const result = await server.http.getOpenApiSpec()

      expect(result.isOk()).toBe(true)
    })

    test("should handle union schemas", async () => {
      const SuccessSchema = z.object({
        success: z.literal(true),
        data: z.string(),
      })
      const ErrorSchema = z.object({
        success: z.literal(false),
        error: z.string(),
      })
      const ResponseSchema = z.union([SuccessSchema, ErrorSchema])

      createRoute("GET", "/api/result")
        .response(ResponseSchema)
        .handler(({ res }) => res.ok({ success: true, data: "test" }))

      server = createServer()
      const result = await server.http.getOpenApiSpec()

      expect(result.isOk()).toBe(true)
    })
  })

  describe("Export functionality", () => {
    test("should export OpenAPI spec to file", async () => {
      createRoute("GET", "/api/test").handler(({ res }) => res.ok({}))

      server = createServer()

      const tempPath = `/tmp/openapi-test-${Date.now()}.json`
      const result = await server.http.exportOpenApiSpec(tempPath)

      expect(result.isOk()).toBe(true)

      // Verify file exists and is valid JSON
      const file = Bun.file(tempPath)
      const content = await file.text()
      const parsed = JSON.parse(content)

      expect(parsed.openapi).toBe("3.1.0")

      // Cleanup - write empty content to file
      try {
        await Bun.write(tempPath, "")
      } catch {
        // Ignore cleanup errors
      }
    })
  })

  describe("Integration with route builder", () => {
    test("should generate OpenAPI spec from route builder", async () => {
      const TaskSchema = z
        .object({
          id: z.string(),
          title: z.string(),
        })
        .meta({ id: "Task" })

      createRoute("GET", "/api/tasks/:id")
        .openapi({ operationId: "getTask", tags: ["Tasks"] })
        .response(TaskSchema)
        .errors([404])
        .handler(({ params, res }) => {
          return res.ok({ id: params.id, title: "Test" })
        })

      server = createServer()
      const spec = await server.http.getOpenApiSpec()

      expect(spec.isOk()).toBe(true)
      const specValue = spec.unwrap()
      expect(specValue.openapi).toBe("3.1.0")
      expect(specValue.paths).toBeDefined()
      expect(specValue.paths["/api/tasks/{id}"]).toBeDefined()
      expect(specValue.paths["/api/tasks/{id}"]?.get).toBeDefined()
    })

    test("should handle wildcard path parameters", async () => {
      // Test single wildcard
      createRoute("GET", "/files/:path*")
        .openapi({ operationId: "getFile", tags: ["Files"] })
        .handler(({ params, res }) => {
          return res.ok({ path: params.path })
        })

      // Test dynamic + wildcard
      createRoute("GET", "/repos/:owner/:rest*")
        .openapi({ operationId: "getRepoPath", tags: ["Repos"] })
        .handler(({ params, res }) => {
          return res.ok({ owner: params.owner, rest: params.rest })
        })

      server = createServer()
      const spec = await server.http.getOpenApiSpec()

      expect(spec.isOk()).toBe(true)
      const specValue = spec.unwrap()

      // Check wildcard paths are converted correctly
      expect(specValue.paths["/files/{path}*"]).toBeDefined()
      expect(specValue.paths["/repos/{owner}/{rest}*"]).toBeDefined()

      // Check parameters don't include * in their names
      const fileOperation = specValue.paths["/files/{path}*"]?.get as Record<
        string,
        unknown
      >
      const fileParams = fileOperation?.parameters as Array<{
        name: string
        in: string
      }>
      expect(fileParams).toBeDefined()
      expect(fileParams?.length).toBe(1)
      expect(fileParams?.[0]?.name).toBe("path") // Should be "path", not "path*"

      const repoOperation = specValue.paths["/repos/{owner}/{rest}*"]
        ?.get as Record<string, unknown>
      const repoParams = repoOperation?.parameters as Array<{
        name: string
        in: string
      }>
      expect(repoParams).toBeDefined()
      expect(repoParams?.length).toBe(2)
      expect(repoParams?.[0]?.name).toBe("owner")
      expect(repoParams?.[1]?.name).toBe("rest") // Should be "rest", not "rest*"
    })
  })
})
