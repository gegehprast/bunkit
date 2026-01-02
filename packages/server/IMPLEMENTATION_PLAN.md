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
createRoute(method: HttpMethod, path: string)
  .openapi(metadata)           // OpenAPI docs
  .middlewares(...fns)         // Route middlewares
  .query(schema)               // Query validation
  .body(schema)                // Body validation
  .response(schema, opts?)     // Success schema
  .responses(responses)        // Multiple responses
  .errors([400, 401, 404])     // Common errors
  .errorResponses(responses)   // Custom errors
  .handler(async (ctx) => {}) // Handler (required)
```

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

The handler's return type is **strictly validated at compile time** against the response schema(s):

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

**Multiple Response Schemas:**

When using `.responses()`, the handler can return any of the defined schema types:

```typescript
const TodoSchema = z.object({ id: z.string(), title: z.string() })
const ErrorSchema = z.object({ message: z.string() })

createRoute("POST", "/api/todos")
  .body(z.object({ title: z.string() }))
  .responses({
    201: {
      description: 'Created',
      content: { 'application/json': { schema: TodoSchema } }
    },
    400: {
      description: 'Bad Request',
      content: { 'application/json': { schema: ErrorSchema } }
    }
  })
  .handler(({ body, res }) => {
    if (!body.title.trim()) {
      // ✅ Can return ErrorSchema type with 400 status
      return res.badRequest({ message: "Title cannot be empty" })
    }
    // ✅ Can return TodoSchema type with 201 status
    return res.created({ id: "1", title: body.title })
  })
```

**Error Response Helpers:**

Error helpers (`res.notFound()`, `res.unauthorized()`, etc.) are also type-checked:

```typescript
createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .errorResponses({
    404: {
      description: 'Not Found',
      content: {
        'application/json': {
          schema: z.object({ message: z.string(), code: z.string() })
        }
      }
    }
  })
  .handler(({ params, res }) => {
    const todo = findTodo(params.id)
    if (!todo) {
      // ✅ Must match the 404 error schema
      return res.notFound({ message: "Todo not found", code: "TODO_NOT_FOUND" })
    }
    return res.ok(todo)
  })
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
}

createServer(options: ServerOptions): Server

interface Server {
  start(): Promise<Result<void, ServerError>>
  stop(): Promise<Result<void, ServerError>>
  getOpenApiSpec(): OpenApiSpec
  exportOpenApiSpec(path: string): Promise<Result<void, Error>>
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
  query<T extends ZodSchema>(schema: T): RouteBuilder<TPath, z.infer<T>, TBody, TParams, TResponse>
  body<T extends ZodSchema>(schema: T): RouteBuilder<TPath, TQuery, z.infer<T>, TParams, TResponse>
  response<T extends ZodSchema>(schema: T): RouteBuilder<TPath, TQuery, TBody, TParams, z.infer<T>>
  handler(fn: RouteHandler<TQuery, TBody, TParams, TResponse>): void
}
```

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
2. **OpenAPI** - Generated on demand, no caching
3. **Path Parameters** - Auto-extracted from path string, always strings
4. **Error Format** - Standardized `{ message, code?, details? }`
5. **Global Middlewares** - Required, runs after CORS before route middlewares
6. **CORS** - Disabled by default, explicit configuration required
7. **Static Files** - Built-in via `static` option
8. **WebSocket** - Defer to Phase 6 (HTTP first)

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
