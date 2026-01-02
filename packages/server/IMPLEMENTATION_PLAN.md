# @bunkit/server Implementation Plan

## Overview

Type-safe HTTP server with automatic OpenAPI 3.1 generation using `zod-openapi`, route management, and middleware support for BunKit applications.

## Core Principles

1. **Result Pattern** - All operations return `Result<T, E>`, no exceptions
2. **Type Safety** - Full TypeScript inference, handler returns validated at compile time
3. **Builder Pattern** - Fluent API with method chaining
4. **Auto OpenAPI** - Generated from Zod schemas via `zod-openapi`

> **⚠️ IMPORTANT:** This implementation MUST strongly utilize `zod-openapi` for all OpenAPI generation. The entire OpenAPI spec should be built using `zod-openapi`'s APIs (`.meta()`, `createDocument()`, etc.). Refer to `docs/ZOD_OPENAPI_DOCS.md` for complete documentation and usage patterns.

## API Reference

### createRoute()

```typescript
createRoute(method: HttpMethod, path: string, server?: Server)
  .openapi(metadata)           // OpenAPI docs
  .middlewares(...fns)         // Route middlewares
  .security(requirements?)     // Security requirements (defaults to bearerAuth)
  .query(schema)               // Query validation
  .body(schema)                // Body validation
  .response(schema, opts?)     // Single success response schema
  .errors([400, 401, 404])     // Standard error responses
  .errorResponses(responses)   // Custom error schemas
  .handler(async (ctx) => {}) // Handler (required)
```

**Note:** The `.responses()` method has been **removed**. Routes now support only **one success response** to maintain clear API contracts and improve type safety. Use `.response()` for the success case and `.errors()` or `.errorResponses()` for error cases.

**Path Parameters:** Auto-extracted via template literals
- `/todos/:id` → `params: { id: string }`
- `/users/:userId/posts/:postId` → `params: { userId: string, postId: string }`

**Path Parameter Extraction:**

Path parameters are **automatically extracted** from the route path string using TypeScript template literal types:

```typescript
// Path: "/api/todos/:id" → params type is { id: string }
// Path: "/api/users/:userId/posts/:postId" → params type is { userId: string, postId: string }

createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .handler(({ params, res }) => {
    // params.id is automatically typed as string
    // TypeScript knows about 'id' from the path string!
    const todo = getTodo(params.id)
    return res.ok(todo)
  })

// Multiple parameters
createRoute("GET", "/api/users/:userId/posts/:postId")
  .handler(({ params, res }) => {
    // params.userId and params.postId are both typed as string
    const post = getPost(params.userId, params.postId)
    return res.ok(post)
  })
```

**Type Safety for Handler Return Values:**

The handler's return type is **strictly validated at compile time** against the response schema:

```typescript
// ✅ CORRECT: Handler returns data matching TodoSchema
const TodoSchema = z.object({ id: z.string(), title: z.string() })

createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .handler(({ params, res }) => {
    // params.id is automatically typed as string (extracted from path)
    // TypeScript enforces that res.ok() receives TodoSchema type
    return res.ok({ id: params.id, title: "Buy milk" })  // ✅ Valid
  })

// ❌ WRONG: Type error - missing required field
createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .handler(({ res }) => {
    return res.ok({ id: "1" })  // ❌ TypeScript error: 'title' is missing
  })

// ❌ WRONG: Type error - wrong field type
createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .handler(({ res }) => {
    return res.ok({ id: 1, title: "Buy milk" })  // ❌ TypeScript error: 'id' must be string
  })
```

**Single Success Response Pattern:**

Routes support only one success response schema for clarity:

```typescript
const TodoSchema = z.object({ id: z.string(), title: z.string() })

// ✅ CORRECT: One success response, multiple error responses
createRoute("POST", "/api/todos")
  .body(z.object({ title: z.string() }))
  .response(TodoSchema, { status: 201, description: "Todo created" })
  .errors([400])  // Standard error responses
  .errorResponses({
    409: {
      description: "Todo already exists",
      content: {
        "application/json": { schema: ErrorResponseSchema }
      }
    }
  })
  .handler(({ body, res }) => {
    if (!body.title.trim()) {
      return res.badRequest("Title cannot be empty")
    }
    if (todoExists(body.title)) {
      return res.conflict("Todo already exists")
    }
    return res.created({ id: "1", title: body.title })
  })
```

**Error Response Helpers:**

All error helpers are type-checked and use standard error schemas:

```typescript
createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .errors([400, 404])  // Automatically adds standard error schemas
  .handler(({ params, res }) => {
    if (!isValidId(params.id)) {
      // Uses BadRequestErrorResponseSchema
      return res.badRequest("Invalid ID format", "INVALID_ID")
    }
    const todo = findTodo(params.id)
    if (!todo) {
      // Uses NotFoundErrorResponseSchema
      return res.notFound("Todo not found", "TODO_NOT_FOUND")
    }
    return res.ok(todo)
  })

// Standard error response helpers:
// res.badRequest(message, code?)       // 400 - BadRequestErrorResponseSchema
// res.unauthorized(message, code?)     // 401 - UnauthorizedErrorResponseSchema
// res.forbidden(message, code?)        // 403 - ForbiddenErrorResponseSchema
// res.notFound(message, code?)         // 404 - NotFoundErrorResponseSchema
// res.conflict(message, code?)         // 409 - ConflictErrorResponseSchema
// res.internalError(message, code?)    // 500 - InternalServerErrorResponseSchema
```

**Security Requirements:**

```typescript
// Default bearerAuth when called without arguments
createRoute("GET", "/api/protected")
  .security()  // Defaults to [{ bearerAuth: [] }]
  .middlewares(authMiddleware())
  .response(DataSchema)
  .errors([401])
  .handler(({ ctx, res }) => {
    const userId = ctx.userId  // Set by auth middleware
    return res.ok(getUserData(userId))
  })

// Custom security schemes
createRoute("GET", "/api/admin")
  .security([{ apiKey: [], bearerAuth: [] }])  // Multiple schemes
  .handler(({ res }) => res.ok({ data: "admin" }))
```

### Handler Context

```typescript
{
  req: Request,
  res: ResponseHelpers,
  params: ExtractedFromPath,  // Auto-typed
  query: ValidatedQuery,       // From .query()
  body: ValidatedBody,         // From .body()
  ctx: Record<string, any>     // Middleware data
}
```

### Response Helpers

```typescript
// JSON (default)
res.ok(data, status?)
res.created(data, location?)
res.noContent()

// Errors (format: { message, code?, details? })
res.badRequest(error, code?)
res.unauthorized(error, code?)
res.forbidden(error, code?)
res.notFound(error, code?)
res.internalError(error, code?)

// Other types
res.text(content, status?)
res.html(content, status?)
res.file(path, contentType?)
res.stream(readable, contentType?)
res.redirect(url, status?)
res.custom(body, options)
```

### Middleware

```typescript
type MiddlewareFn = (context: MiddlewareArgs) => Promise<Response | void> | Response | void

interface MiddlewareArgs {
  req: Request
  params: Record<string, string>
  query: unknown  // Not validated yet
  body: unknown   // Not validated yet
  ctx: Record<string, any>
  res: ResponseHelpers
  next: () => Promise<Response | void>
}
```

**Middleware Execution:**
- Middlewares execute in order
- Can return Response to short-circuit
- Can call `next()` to continue chain
- Can modify `ctx` to pass data to handler
- Full access to request and response helpers

**Execution Order:**
1. CORS (if enabled)
2. Static files (if configured)
3. Global middlewares
4. Route middlewares
5. Handler

### Server

```typescript
interface ServerOptions {
  port?: number
  host?: string
  development?: boolean
  cors?: CorsOptions
  static?: Record<string, string>  // { '/public': './public' }
  globalMiddlewares?: MiddlewareFn[]
  openapi?: {
    info?: {
      title?: string
      version?: string
      description?: string
    }
    servers?: Array<{ url: string, description?: string }>
    securitySchemes?: Record<string, SecuritySchemeObject>
  }
  websocket?: {
    publishBehavior?: "server" | "client" | "both"
    compression?: boolean | { enabled: boolean }
    // ... other WebSocket options
  }
}

createServer(options: ServerOptions): Server

interface Server {
  start(): Promise<Result<void, ServerError>>
  stop(): Promise<Result<void, ServerError>>
  
  // HTTP methods (namespaced)
  http: {
    getOpenApiSpec(): Result<OpenApiSpec, Error>
    exportOpenApiSpec(path: string): Promise<Result<void, Error>>
  }
  
  // WebSocket methods (namespaced)
  ws: {
    publish(topic: string, message: unknown): void
    publishBinary(topic: string, data: ArrayBuffer | Uint8Array): void
    generateWebSocketTypes(options?: GenerateWebSocketTypesOptions): Result<string, Error>
  }
  
  // Internal (for advanced use)
  _routeRegistry?: RouteRegistry
  _wsRouteRegistry?: WebSocketRouteRegistry
}
```

### CORS

```typescript
interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean)
  methods?: HttpMethod[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}
```

## Implementation Structure

```
src/
├── index.ts                # Public API exports
├── server.ts               # Main server orchestration (HTTP + WebSocket)
├── core/                   # Shared core utilities
│   ├── cors.ts             # CORS handling
│   ├── middleware.ts       # Middleware execution engine
│   ├── standard-errors.ts  # Standard error definitions
│   └── validation.ts       # Zod validation utilities
├── http/                   # HTTP-specific modules
│   ├── request-handler.ts  # HTTP request routing & handling
│   ├── response-helpers.ts # Response builder methods
│   ├── route-builder.ts    # HTTP route builder (fluent API)
│   ├── route-registry.ts   # HTTP route storage & matching
│   ├── openapi/            # OpenAPI generation
│   │   ├── generator.ts    # OpenAPI spec generator
│   │   └── security-schemes.ts # Security scheme templates
│   └── types/              # HTTP-specific types
│       ├── context.ts      # Route handler context
│       ├── response.ts     # Response types
│       └── route.ts        # Route definition types
├── websocket/              # WebSocket-specific modules
│   ├── websocket-auth.ts   # WebSocket authentication utilities
│   ├── websocket-handler.ts # WebSocket connection handling
│   ├── websocket-registry.ts # WebSocket route storage & matching
│   ├── websocket-route-builder.ts # WebSocket route builder
│   ├── websocket-type-generator.ts # Client type generation
│   └── types/              # WebSocket-specific types
│       └── websocket.ts    # WebSocket types
└── types/                  # Shared types
    ├── cors.ts             # CORS configuration types
    ├── middleware.ts       # Middleware types
    └── server.ts           # Server configuration types
```

## Type System

### Path Parameter Extraction

```typescript
type ExtractParams<T extends string> = 
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParams<`/${Rest}`>]: string }
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>
```

### RouteBuilder Generics

```typescript
class RouteBuilder<
  TPath extends string,
  TQuery = unknown,
  TBody = unknown,
  TParams = ExtractParams<TPath>,  // Auto-inferred
  TResponse = unknown
> {
  middlewares(...fns: MiddlewareFn[]): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse>
  security(requirements?: Array<Record<string, string[]>>): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse>
  query<T extends z.ZodType>(schema: T): RouteBuilder<TPath, z.infer<T>, TBody, TParams, TResponse>
  body<T extends z.ZodType>(schema: T): RouteBuilder<TPath, TQuery, z.infer<T>, TParams, TResponse>
  response<T extends z.ZodType>(schema: T, opts?: { description?: string, status?: number }): RouteBuilder<TPath, TQuery, TBody, TParams, z.infer<T>>
  errors(statusCodes: number[]): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse>
  errorResponses(responses: Record<number, ResponseConfig>): RouteBuilder<TPath, TQuery, TBody, TParams, TResponse>
  handler(fn: RouteHandler<TQuery, TBody, TParams, TResponse>): void
}
```

**Note:** The `responses()` method (plural) has been removed. Use `response()` (singular) for the success case.

## Implementation Phases

### Phase 1: Core Infrastructure (PRIORITY)
- Route registry (global storage, matching, registration)
- Route builder (fluent API, schema attachment)
- Response helpers (all methods, JSON serialization)
- Basic server (Bun.serve, routing, error handling)

**Deliverable:** Routes work without validation/OpenAPI

### Phase 2: Validation & Type Safety (PRIORITY)
- Validation utilities (query, body, type extraction)
- Path parameter extraction (template literals, runtime parsing)
- Enhanced route builder (type inference, validation integration)
- Type-safe response helpers (generic constraints)

**Deliverable:** Full type safety with compile-time checking

### Phase 3: Middleware System (PRIORITY)
- Middleware types and execution
- Chain management (short-circuit, context propagation)

**Deliverable:** Working middleware system

### Phase 4: OpenAPI Generation (HIGH PRIORITY)
- Use `zod-openapi`'s `createDocument()`
- Build paths from route registry
- Handle multiple content types
- Standard error schemas

**Deliverable:** Auto-generated OpenAPI spec

### Phase 5: CORS & Content Types (HIGH PRIORITY)
- CORS support (configurable, automatic preflight)
- Extended response helpers (text, HTML, files, streams)
- Static file serving

**Deliverable:** Production-ready request handling

### Phase 6: WebSocket (FUTURE)
- WebSocket route builder
- Connection lifecycle
- Message validation

**Deliverable:** Real-time features (deferred)

### Phase 7: Advanced Features (FUTURE)
- Rate limiting, logging, compression
- File uploads, cookie parsing, ETags

## Key Decisions

1. **Route Discovery** - Auto-register on import, files imported after `createServer()`
2. **OpenAPI** - Generated on demand using `zod-openapi`, no caching
3. **Path Parameters** - Auto-extracted from path string, always strings
4. **Error Format** - Standardized with typed schemas (BadRequestErrorResponseSchema, etc.)
5. **Single Success Response** - Routes support only one success response via `.response()`
6. **Security Defaults** - `.security()` without arguments defaults to bearerAuth
7. **Global Middlewares** - Optional, runs after CORS before route middlewares
8. **CORS** - Disabled by default, explicit configuration required
9. **Static Files** - Built-in via `static` option
10. **Namespaced Server Methods** - HTTP methods under `server.http.*`, WebSocket under `server.ws.*`
11. **Relative Imports** - Use relative paths instead of path aliases for better compatibility

## Usage Example

```typescript
// main.ts
const server = createServer({
  port: 3000,
  cors: { origin: ['http://localhost:3000'], credentials: true },
  globalMiddlewares: [requestIdMiddleware, loggingMiddleware]
})

// Import routes AFTER server creation
import './routes/todos.routes'

await server.start()
await server.exportOpenApiSpec('./openapi.json')
```

```typescript
// routes/todos.routes.ts
const TodoSchema = z.object({ 
  id: z.string(), 
  title: z.string() 
}).meta({ id: 'Todo' })

createRoute("GET", "/api/todos/:id")
  .openapi({ operationId: "getTodo", tags: ["Todos"] })
  .response(TodoSchema)
  .errors([404])
  .handler(async ({ params, res }) => {
    const result = await getTodo(params.id)  // params.id is typed!
    return result.isOk() 
      ? res.ok(result.value)
      : res.notFound({ message: "Not found", code: "TODO_NOT_FOUND" })
  })
```

## Success Criteria

- ✅ Type-safe handlers with compile-time validation
- ✅ Full type inference (params, query, body, response)
- ✅ TypeScript errors for wrong return types
- ✅ Request validation with helpful errors
- ✅ Middleware system (auth, logging, etc.)
- ✅ Auto-generated OpenAPI spec
- ✅ All operations use Result pattern
- ✅ No `any` types in public API

## Dependencies

```json
{
  "name": "@bunkit/server",
  "version": "0.1.0",
  "dependencies": {
    "@bunkit/result": "workspace:*",
    "zod": "catalog:",
    "zod-openapi": "catalog:"
  },
  "peerDependencies": {
    "typescript": "^5"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```
