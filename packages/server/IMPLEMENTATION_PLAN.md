# @bunkit/server Implementation Plan

## Recent Updates (Dec 30, 2025)

### 1. **Zod-OpenAPI Integration** ✅
- Leveraging `zod-openapi` library for automatic OpenAPI 3.1 generation
- Uses Zod's native `.meta()` method for schema metadata
- Schemas with `meta({ id: 'SchemaName' })` auto-register as components
- No monkey patching, fully type-safe

### 2. **CORS & Preflight Handling** ✅
- Built-in CORS support with flexible configuration
- Automatic OPTIONS preflight handling
- Origin validation (string, array, or function)
- Configurable headers, methods, credentials, and max-age
- CORS middleware applies headers to all responses

### 3. **Multiple Content Type Support** ✅
- **JSON** (default): `res.ok()`, `res.created()`, error helpers
- **Text/HTML**: `res.text()`, `res.html()`
- **Files**: `res.file()` using `Bun.file()` for efficient streaming
- **Streaming**: `res.stream()` for large responses and SSE
- **Custom**: `res.custom()` for any content type
- **Static files**: Built-in static file serving middleware

### 4. **Common Error Responses** ✅
- `.errors([400, 401, 404])` - Attach standard error responses
- `.errorResponses({ ... })` - Custom error schemas per route
- Reusable error response definitions
- Proper OpenAPI documentation for all error cases

## Overview

The `@bunkit/server` package will provide a type-safe HTTP and WebSocket server with automatic OpenAPI documentation generation, route management, and middleware support for BunKit applications.

## Core Design Principles

### 1. **Result Pattern Integration**
- All server operations return `Result<T, E>` types
- No exceptions in public API
- Type-safe error handling

### 2. **Type Safety First**
- Full TypeScript type inference
- Strongly typed request/response objects
- No `any` types in public API
- Infer types from Zod schemas
- **Handler return types validated against response schemas at compile time**

### 3. **Builder Pattern for Routes**
- Fluent API with method chaining
- Type-safe request handlers with full context
- Automatic schema validation and registration

### 4. **Zero-Config OpenAPI Generation**
- Automatic schema extraction from Zod schemas
- Schema component reuse via `meta.id`
- Tag-based organization
- Support for all HTTP methods

## Key Features

### 1. Route Definition API

```typescript
createRoute(method: HttpMethod, path: string)
  .openapi(metadata: OpenApiMetadata)           // Optional: OpenAPI documentation
  .middlewares(...middlewares: MiddlewareFn[])  // Optional: Apply middlewares
  .query(schema: ZodSchema)                     // Optional: Query params validation
  .body(schema: ZodSchema)                      // Optional: Request body validation
  .response(schema: ZodSchema, options?)        // Optional: Success response schema
  .responses(responses: ResponsesObject)        // Optional: Multiple response schemas
  .errors(statusCodes: number[])                // Optional: Common error responses
  .errorResponses(responses: ErrorResponsesObject) // Optional: Custom error responses
  .handler(async (context) => { ... })          // Required: Request handler
```

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

**Handler Context:**
```typescript
{
  req: Request,              // Bun Request object
  res: ResponseHelpers,      // Helper methods (ok, notFound, unauthorized, etc.)
  params: Record<string, string>,  // URL path parameters (typed)
  query: T,                  // Query parameters (validated & typed)
  body: T,                   // Request body (validated & typed)
  ctx: Record<string, any>   // Shared context (for middleware data)
}
```

**Response Helpers:**
```typescript
// JSON responses (application/json)
res.ok(data, statusCode?)           // 200 or custom 2xx
res.created(data, location?)        // 201
res.noContent()                     // 204
res.badRequest(message, code?)      // 400
res.unauthorized(message, code?)    // 401
res.forbidden(message, code?)       // 403
res.notFound(message, code?)        // 404
res.internalError(message, code?)   // 500
res.json(data, statusCode)          // Custom JSON response

// Other content types
res.text(content, statusCode?)      // text/plain
res.html(content, statusCode?)      // text/html
res.file(path, contentType?)        // Serve file with Bun.file()
res.stream(readable, contentType?)  // Streaming response
res.redirect(url, statusCode?)      // 302 or custom 3xx redirect

// Custom response (full control)
res.custom(body, options: {
  status?: number
  headers?: Record<string, string>
  contentType?: string
})
```

### 2. Middleware System

**Middleware Function Signature:**
```typescript
type MiddlewareFn = (context: MiddlewareArgs) => Promise<Response | void> | Response | void

interface MiddlewareArgs {
  req: Request
  params: Record<string, string>
  query: unknown  // Not validated yet at middleware stage
  body: unknown   // Not validated yet at middleware stage
  ctx: Record<string, any>
  res: ResponseHelpers
  next: () => Promise<Response | void>  // Call next middleware/handler
}
```

**Middleware Execution:**
- Middlewares execute in order
- Can return Response to short-circuit
- Can call `next()` to continue chain
- Can modify `ctx` to pass data to handler
- Full access to request and response helpers

### 3. Server Management

```typescript
interface ServerOptions {
  port?: number
  host?: string
  development?: boolean
  routes?: RouteRegistry  // Auto-populated via route discovery
  cors?: CorsOptions      // CORS configuration
  static?: Record<string, string>  // Static file mappings
  globalMiddlewares?: MiddlewareFn[]  // Global middlewares
}

createServer(options: ServerOptions): Server

interface Server {
  start(): Promise<Result<void, ServerError>>
  stop(): Promise<Result<void, ServerError>>
  getOpenApiSpec(): OpenApiSpec
  exportOpenApiSpec(path: string): Promise<Result<void, Error>>
}
```

### 4. OpenAPI Generation

**Schema Registration:**
- Leverage `zod-openapi`'s `createDocument()` for OpenAPI generation
- Schemas with `meta({ id: 'Name' })` auto-register as components
- Build paths from route registry
- Support multiple content types in request/response

**OpenAPI Metadata:**
```typescript
interface OpenApiMetadata {
  operationId: string
  summary: string
  description?: string
  tags?: string[]
  deprecated?: boolean
  security?: SecurityRequirement[]
}
```

**Common Error Responses:**

Routes can register common error responses that apply to multiple endpoints:

```typescript
// Define reusable error response schemas
const ErrorResponses = {
  400: {
    description: 'Bad Request',
    content: {
      'application/json': {
        schema: z.object({
          message: z.string(),
          code: z.string()
        }).meta({ id: 'BadRequestError' })
      }
    }
  },
  401: {
    description: 'Unauthorized',
    content: {
      'application/json': {
        schema: z.object({
          message: z.string(),
          code: z.string()
        }).meta({ id: 'UnauthorizedError' })
      }
    }
  },
  404: {
    description: 'Not Found',
    content: {
      'application/json': {
        schema: z.object({
          message: z.string(),
          code: z.string()
       CORS & Preflight Handling

**CORS Configuration:**

The server will provide built-in CORS support with configurable options:

```typescript
interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean)
  methods?: HttpMethod[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

createServer({
  port: 3000,
  cors: {
    origin: '*',  // or ['http://localhost:3000', 'https://app.example.com']
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400  // 24 hours
  }
})

// OR custom CORS logic
createServer({
  port: 3000,
  cors: {
    origin: (requestOrigin) => {
      // Custom logic to validate origin
      return allowedOrigins.includes(requestOrigin)
    }
  }
})
```

**Preflight (OPTIONS) Handling:**

The server will automatically handle OPTIONS preflight requests:

1. **Automatic OPTIONS handler:** When CORS is enabled, the server automatically responds to OPTIONS requests for all registered routes
2. **Route-specific OPTIONS:** Can also explicitly define OPTIONS handlers if custom logic is needed

```typescript
// Automatic preflight - no code needed
// Server automatically responds to OPTIONS /api/todos with COR (all content types)
    ├── request-handler.ts          # Request routing and handling
    ├── validation.ts               # Zod validation utilities
    ├── errors.ts                   # Server-specific error types
    ├── cors.ts                     # CORS handling and preflight
    ├── openapi/
    │   ├── generator.ts            # OpenAPI spec generation with zod-openapi
    │   ├── error-responses.ts      # Common error response schemas
    │   ├── types.ts                # OpenAPI type definitions
    │   └── utils.ts                # OpenAPI utilities
    └── types/
        ├── route.ts                # Route-related types
        ├── server.ts               # Server-related types
        ├── middleware.ts           # Middleware types
        ├── context.ts              # Request context types
        └── cors.ts                 # CORS-related

**CORS Headers Added:**
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`
- `Access-Control-Expose-Headers`
- `Access-Control-Allow-Credentials`
- `Access-Control-Max-Age`

**Implementation Strategy:**
1. CORS middleware applies headers to all responses
2. Preflight OPTIONS requests short-circuit before route handlers
3. Actual request proceeds to route handler after CORS validation
4. Failed CORS checks return 403 Forbidden

### 6.  }).meta({ id: 'NotFoundError' })
      }
    }
  }
}

// Apply to routes
createRoute("GET", "/api/todos/:id")
  .openapi({
    operationId: "getTodo",
    summary: "Get todo by ID"
  })
  .response(TodoSchema)
  .errors([400, 401, 404])  // Attach common error responses
  .handler(...)

// OR provide custom error responses per route
createRoute("POST", "/api/todos")
  .openapi({
    operationId: "createTodo",
    summary: "Create todo"
  })
  .response(TodoSchema, { status: 201 })
  .errorResponses({
    400: {
      description: 'Invalid todo data',
      content: {
        'application/json': {
          schema: ValidationErrorSchema
        }
      }
    },
    401: ErrorResponses[401]  // Reuse common error
  })
  .handler(...)
```

**Multiple Content Types:**

Routes can return different content types based on Accept header or explicit specification:

```typescript
// Single response type (default: application/json)
createRoute("GET", "/api/todos")
  .response(TodoArraySchema)
  .handler(({ res }) => res.ok(todos))

// Multiple response content types
createRoute("GET", "/api/export")
  .openapi({ operationId: "exportData" })
  .responses({
    200: {
      description: 'Successful export',
      content: {
        'application/json': { schema: TodoArraySchema },
        'text/csv': { schema: z.string() },
        'application/xml': { schema: z.string() }
      }
    }
  })
  .handler(({ req, res }) => {
    const accept = req.headers.get('accept')
    if (accept?.includes('text/csv')) {
      return res.text(convertToCsv(todos), 200)
    }
    if (accept?.includes('application/xml')) {
      return res.custom(convertToXml(todos), {
        status: 200,
        contentType: 'application/xml'
      })
    }
    return res.ok(todos)  // Default to JSON
  })

// File responses
createRoute("GET", "/api/files/:filename")
  .openapi({ operationId: "downloadFile" })
  .responses({
    200: {
      description: 'File download',
      content: {
        'application/octet-stream': {}
      }
    }
  })
  .handler(({ params, res }) => {
    return res.file(`./uploads/${params.filename}`)
  })
```

**Example Generated OpenAPI:**
```json
{
  "paths": {
    "/api/todos": {
      "post": {
        "operationId": "createTodo",
        "summary": "Create a new todo",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/CreateTodoBody" }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Todo" }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/BadRequestError" }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/UnauthorizedError" }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "CreateTodoBody": { /* Generated by zod-openapi */ },
      "Todo": { /* Generated by zod-openapi */ },
      "BadRequestError": { /* Generated by zod-openapi */ },
      "UnauthorizedError": { /* Generated by zod-openapi
          "200": {
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Todo" }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "CreateTodoBody": { /* Generated from Zod schema */ },
      "Todo": { /* Generated from Zod schema */ }
    }
  }
}
```

### 5. Route Discovery & Auto-loading

**Route Registry:**
- Global route registry for collecting routes
- Routes auto-register on module load
- Export routes for server initialization

```typescript
// Internal: Route registration
export function createRoute(method, path) {
  const route = new RouteBuilder(method, path)
  // Auto-register when .handler() is called
  return route
}

// Registry access
export function getRouteRegistry(): RouteRegistry
export function clearRouteRegistry(): void  // For testing
```

## Implementation Structure

```
packages/server/
├── package.json
├── tsconfig.json
├── README.md
├── IMPLEMENTATION_PLAN.md
└── src/
    ├── index.ts                    # Public API exports
    ├── server.ts                   # Server creation and management
    ├── route-builder.ts            # RouteBuilder class with fluent API
    ├── route-registry.ts           # Global route collection
    ├── middleware.ts               # Middleware types and utilities
    ├── response-helpers.ts         # Response helper functions
    ├── request-handler.ts          # Request routing and handling
    ├── validation.ts               # Zod validation utilities
    ├── errors.ts                   # Server-specific error types
    ├── openapi/
    │   ├── generator.ts            # OpenAPI spec generation
    │   ├── schema-converter.ts     # Zod to OpenAPI JSON Schema
    │   ├── types.ts                # OpenAPI type definitions
    │   └── utils.ts                # OpenAPI utilities
    └── types/
        ├── route.ts                # Route-related types
        ├── server.ts               # Server-related types
        ├── middleware.ts           # Middleware types
        └── context.ts              # Request context types
```

## Type Definitions

### Route Builder Type Flow

The RouteBuilder uses TypeScript generics and template literal types to extract params from the path:

```typescript
// Extract params from path string using template literal types
type ExtractParams<T extends string> = 
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParams<`/${Rest}`>]: string }
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>

// Examples:
// ExtractParams<"/api/todos/:id"> = { id: string }
// ExtractParams<"/api/users/:userId/posts/:postId"> = { userId: string, postId: string }

class RouteBuilder<
  TPath extends string,
  TQuery = unknown,
  TBody = unknown,
  TParams = ExtractParams<TPath>,  // Automatically inferred from path!
  TResponse = unknown
> {
  // Query schema sets TQuery type
  public query<T extends ZodSchema>(
    schema: T
  ): RouteBuilder<TPath, z.infer<T>, TBody, TParams, TResponse> {
    // Implementation
    return this as any
  }

  // Body schema sets TBody type
  public body<T extends ZodSchema>(
    schema: T
  ): RouteBuilder<TPath, TQuery, z.infer<T>, TParams, TResponse> {
    // Implementation
    return this as any
  }

  // Response schema sets TResponse type (constrains handler return)
  public response<T extends ZodSchema>(
    schema: T,
    options?: ResponseOptions
  ): RouteBuilder<TPath, TQuery, TBody, TParams, z.infer<T>> {
    // Implementation
    return this as any
  }

  // Handler must return Response with data matching TResponse
  // Params are typed based on path string!
  public handler(
    fn: RouteHandler<TQuery, TBody, TParams, TResponse>
  ): void {
    // Register route with typed handler
  }
}
```

**Example Type Flow:**
```typescript
const UserSchema = z.object({ id: z.string(), name: z.string() })
const QuerySchema = z.object({ page: z.string() })

// TypeScript extracts params from path string!
createRoute("GET", "/users/:userId")  
  // ↓ TPath = "/users/:userId"
  // ↓ TParams = { userId: string } (auto-extracted!)
  // ↓ RouteBuilder<"/users/:userId", unknown, unknown, {userId: string}, unknown>
  .query(QuerySchema)                 
  // ↓ RouteBuilder<"/users/:userId", {page: string}, unknown, {userId: string}, unknown>
  .response(UserSchema)               
  // ↓ RouteBuilder<"/users/:userId", {page: string}, unknown, {userId: string}, User>
  .handler(({ params, query, res }) => {
    // params is typed as { userId: string } - extracted from "/users/:userId"!
    // query is typed as { page: string }
    // res.ok() expects User type
    return res.ok({ id: params.userId, name: "John" })  // ✅ Type-safe!
  })

// Multiple parameters - all automatically extracted!
createRoute("GET", "/users/:userId/posts/:postId/comments/:commentId")
  .handler(({ params }) => {
    // params is { userId: string, postId: string, commentId: string }
    // All extracted from the path string!
  })
```

### Core Types

```typescript
// HTTP Methods
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD"

// Route Handler Context (fully typed based on schemas)
interface RouteHandlerContext<
  TQuery = unknown,
  TBody = unknown,
  TParams = Record<string, string>,
  TResponse = unknown  // Response data type inferred from schemas
> {
  req: Request
  res: ResponseHelpers<TResponse>  // Typed response helpers
  params: TParams
  query: TQuery
  body: TBody
  ctx: Record<string, any>
}

// Route Handler Function - return type constrained by TResponse
type RouteHandler<TQuery, TBody, TParams, TResponse> = (
  context: RouteHandlerContext<TQuery, TBody, TParams, TResponse>
) => Promise<Response> | Response

// Response Helpers - Generic type ensures type safety
interface ResponseHelpers<TData = any> {
  // Success responses must match TData type
  ok(data: TData, statusCode?: number): Response
  created(data: TData, location?: string): Response
  
  // Error responses can have their own types (defined in errorResponses)
  badRequest(error: unknown, code?: string): Response
  unauthorized(error: unknown, code?: string): Response
  forbidden(error: unknown, code?: string): Response
  notFound(error: unknown, code?: string): Response
  internalError(error: unknown, code?: string): Response
  
  // Other responses
  noContent(): Response
  json(data: unknown, statusCode: number): Response
  text(content: string, statusCode?: number): Response
  html(content: string, statusCode?: number): Response
  file(path: string, contentType?: string): Response
  stream(readable: ReadableStream, contentType?: string): Response
  redirect(url: string, statusCode?: number): Response
  custom(body: unknown, options: ResponseOptions): Response
}

// Route Definition
interface Route<TResponse = unknown> {
  method: HttpMethod
  path: string
  handler: RouteHandler<any, any, any, TResponse>
  middlewares: MiddlewareFn[]
  metadata?: OpenApiMetadata
  schemas: {
    query?: ZodSchema        // Query parameters schema
    body?: ZodSchema         // Request body schema
    response?: ZodSchema     // Used to infer TResponse type
    responses?: Record<number, ResponseSchema>  // Alternative to response
    errorResponses?: Record<number, ResponseSchema>
  }
  // Path parameters are extracted from the path string, not a schema
}
```

### Error Types

```typescript
class ServerError extends Error {
  public constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = "ServerError"
  }
}

class RouteNotFoundError extends Error {
  public constructor(public readonly path: string, public readonly method: string) {
    super(`Route not found: ${method} ${path}`)
    this.name = "RouteNotFoundError"
  }
}

class ValidationError extends Error {
  public constructor(
    message: string,
    public readonly issues: ZodIssue[]
  ) {
    super(message)
    this.name = "ValidationError"
  }
}
```

### Standardized Error Response Format

All error responses from `res.*` helper methods follow this structure:

```typescript
interface ErrorResponse {
  message: string      // Human-readable error message
  code?: string        // Machine-readable error code (e.g., "VALIDATION_ERROR")
  details?: unknown    // Additional context (validation errors, stack traces in dev mode)
}

// Default error schemas (auto-registered as components)
const BadRequestErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional()
}).meta({ id: 'BadRequestError' })

const UnauthorizedErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional()
}).meta({ id: 'UnauthorizedError' })

const ForbiddenErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional()
}).meta({ id: 'ForbiddenError' })

const NotFoundErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional()
}).meta({ id: 'NotFoundError' })

const InternalErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional()  // Stack trace in dev mode
}).meta({ id: 'InternalError' })
```

**Usage Examples:**

```typescript
// Simple error message
res.notFound({ message: "Resource not found" })

// With error code
res.unauthorized({ 
  message: "Invalid credentials", 
  code: "INVALID_CREDENTIALS" 
})

// With validation details
res.badRequest({
  message: "Validation failed",
  code: "VALIDATION_ERROR",
  details: {
    errors: zodError.issues
  }
})

// Backward compatibility - string message
res.notFound("Resource not found")  // Converted to { message: "..." }
```

## Implementation Phases

### Phase 1: Core Infrastructure ✅ PRIORITY
**Goal:** Basic route registration and handler execution

1. **Route Registry** (`route-registry.ts`)
   - Global route storage
   - Route registration/retrieval
   - Route matching with path parameters

2. **Route Builder** (`route-builder.ts`)
   - Fluent API implementation
   - Schema attachment
   - Handler registration

3. **Response Helpers** (`response-helpers.ts`)
   - All response helper methods
   - JSON serialization
   - Status code handling

4. **Basic Server** (`server.ts`)
   - Bun.serve integration
   - Route matching and dispatching
   - Basic error handling

**Deliverable:** Can register routes and handle requests (no validation/OpenAPI yet)

### Phase 2: Validation & Type Safety ✅ PRIORITY
**Goal:** Schema validation and type inference

1. **Validation Utilities** (`validation.ts`)
   - Query parameter validation
   - Body validation
   - Type extraction from schemas
   - Response type inference from schemas

2. **Path Parameter Extraction** (`route-registry.ts`)
   - Parse path string to extract parameter names (`:id`, `:userId`, etc.)
   - Use TypeScript template literal types for compile-time param typing
   - Runtime extraction using path-to-regexp or similar
   - Automatic OpenAPI parameter generation

3. **Enhanced Route Builder**
   - Type inference from schemas (query, body)
   - **Path param type inference** - extract from path string using template literal types
   - **Response type inference** - extract type from `.response()` or `.responses()`
   - Generic type propagation through builder chain
   - Validation integration
   - Error responses for validation failures (400 Bad Request)
   - **Compile-time type checking** for handler return values

4. **Type-Safe Response Helpers**
   - Generic `ResponseHelpers<TData>` interface
   - Constrain `res.ok()` and `res.created()` to match response schema
   - Error helpers accept their own error schema types
   - TypeScript enforces correct data shapes at compile time

**Deliverable:** Type-safe routes with automatic param extraction, validation (query, body), and compile-time handler return type checking

### Phase 3: Middleware System ✅ PRIORITY
**Goal:** Middleware support

1. **Middleware Types** (`middleware.ts`)
   - MiddlewareFn type
   - MiddlewareArgs interface
   - next() function implementation

2. **Middleware Execution**
   - Chain execution
   - Short-circuit on response
   - Context propagation

**Deliverable:** Working middleware system like authMiddleware example

### Phase 4: OpenAPI Generation 🔄 HIGH PRIORITY
**Goal:** Automatic OpenAPI spec generation

1. **OpenAPI Generator** (`openapi/generator.ts`)
   - Use `zod-openapi`'s `createDocument()` for generation
   - Build paths structure from route registry
   - Convert route schemas to OpenAPI format
   - Handle multiple content types
   - Register common error schemas

2. **Error Response Schemas** (`openapi/error-responses.ts`)
   - Define standard error response schemas
   - Export common error responses
   - Support custom error schemas per route

3. **Spec Export**
   - Generate complete OpenAPI 3.1 spec
   - Export to JSON file
   - Integrate with server

**Deliverable:** Auto-generated OpenAPI spec using zod-openapi

### Phase 5: CORS & Content Types 🔄 HIGH PRIORITY
**Goal:** Production-ready request handling

1. **CORS Support** (`cors.ts`)
   - Configurable CORS options
   - Automatic preflight handling
   - Origin validation
   - Header management

2. **Response Helpers Extension** (`response-helpers.ts`)
   - Text/HTML responses
   - File serving with Bun.file()
   - Streaming responses
   - Custom content types
7: Advanced Features 🔮 FUTURE
**Goal:** Additional production features

1. **Rate limiting**
2. **Request logging**
3. **Compression (gzip, brotli)**
4. **Request body size limits**
5. **Multipart form data / file uploads**
6. **Cookie parsing**
7. **ETag support**

**Deliverable:** Enterprise-ready features
1. **WebSocket Route Builder**
   - Similar fluent API for WS routes
   - Message validation
   - Connection lifecycle

2. **WebSocket Server**
   - Bun WebSocket integration
   - Connection management
   - Broadcast utilities

**Deliverable:** WebSocket support (deferred to v2)

### Phase 6: Advanced Features 🔮 FUTURE
**Goal:** Production-ready features

1. **CORS support**
2. **Rate limiting**
3. **Request logging**
4. **Static file serving**
5. **File upload handling**
6. **Streaming responses**

**Deliverable:** Production-ready server

## Zod-OpenAPI Integration

### Why zod-openapi?

The `zod-openapi` library provides automatic OpenAPI 3.1 schema generation from Zod schemas using Zod's native `.meta()` method. This approach:

- ✅ **No monkey patching** - Uses Zod's built-in metadata functionality
- ✅ **Type-safe** - Full TypeScript support with IDE autocomplete
- ✅ **Component reuse** - Auto-registration of schemas with `meta({ id: 'SchemaName' })`
- ✅ **Flexible overrides** - Can customize schema generation via `override` option
- ✅ **OpenAPI 3.1 compliant** - Schemas are fully compatible with JSON Schema

### Usage in @bunkit/server

We'll leverage `createDocument()` from zod-openapi to generate the final OpenAPI spec. The route builder will internally build up the paths structure that gets passed to `createDocument()`:

```typescript
import { createDocument } from 'zod-openapi'

// Server internally collects routes and builds paths
const paths = buildPathsFromRoutes(routeRegistry)

// Generate final OpenAPI document
const openApiSpec = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'BunKit API',
    version: '0.0.1',
    description: 'API documentation for BunKit'
  },
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
})
```

### Schema Registration

Schemas will be automatically registered as components when they include `meta({ id: 'SchemaName' })`:

```typescript
const TodoSchema = z.object({
  id: z.string(),
  title: z.string()
}).meta({
  id: 'Todo',  // Auto-registers as #/components/schemas/Todo
  description: 'A todo item'
})

// Anywhere this schema is used, it will become a $ref
createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)  // Renders as { "$ref": "#/components/schemas/Todo" }
  .handler(...)
```

## Dependencies

```json
{
  "name": "@bunkit/server",
  "Content Type Handling Strategy

### JSON Responses (Default)
- All `res.ok()`, `res.created()`, error helpers default to `application/json`
- Automatic JSON serialization
- Schema validation on response bodies (dev mode only)

### Text & HTML
- `res.text(content)` → `text/plain`
- `res.html(content)` → `text/html`
- No validation, direct string output

### File Serving
- `res.file(path)` uses `Bun.file()` for efficient streaming
- Auto-detect content type from file extension
- Support `Content-Disposition` for downloads
- Proper error handling for missing files

```typescript
createRoute("GET", "/api/avatar/:userId")
  .handler(async ({ params, res }) => {
    const avatarPath = `./uploads/avatars/${params.userId}.png`
    const file = Bun.file(avatarPath)
    
    const exists = await file.exists()
    if (!exists) {
      return res.notFound('Avatar not found')
    }
    
    return res.file(avatarPath, 'image/png')
  })
```

### Streaming Responses
- `res.stream(readable)` for large responses
- Server-sent events (SSE)
- Real-time data streaming

```typescript
createRoute("GET", "/api/logs/stream")
  .handler(({ res }) => {
    const stream = new ReadableStream({
      start(controller) {
        // Push data chunks
        controller.enqueue('Log line 1\n')
        controller.enqueue('Log line 2\n')
        controller.close()
      }
    })
    
    return res.stream(stream, 'text/plain')
  })
```

### Static File Middleware
- Optional middleware for serving static files
- Configure static directories

```typescript
createServer({
  port: 3000,
  static: {
    '/public': './public',
    '/uploads': './uploads'
  }
})

// Automatically serves:
// GET /public/logo.png → ./public/logo.png
// GET /uploads/file.pdf → ./uploads/file.pdf
```

### Custom Content Types
- `res.custom()` for full control
- Support any content type
- Manual header management

```typescript
createRoute("GET", "/api/data.xml")
  .handler(({ res }) => {
    const xml = generateXML(data)
    return res.custom(xml, {
      status: 200,
      contentType: 'application/xml',
      headers: {
        'X-Generated-At': new Date().toISOString()
      }
    })
  })
```

## Open Questions & Decisions Needed

1. **Route Discovery:** ✅ DECIDED
   - Routes auto-register globally when `.handler()` is called
   - Route files must be imported after server creation
   - Server collects all registered routes from the global registry
   - Example: `import './routes/todos.routes'` after `createServer()`

2. **OpenAPI Spec Location:** ✅ DECIDED
   - Generated on demand when `server.getOpenApiSpec()` or `server.exportOpenApiSpec()` is called
   - No caching/storing in the library - consumer handles persistence
   - Allows for dynamic spec generation reflecting current route state

3. **Path Parameter Typing:** ✅ DECIDED
   - Path parameters automatically extracted from route path string using TypeScript template literal types
   - Example: `createRoute("GET", "/todos/:id")` → `params: { id: string }`
   - No manual schema definition needed - parameters are always strings
   - Runtime extraction using path-to-regexp or similar library
   - Automatic OpenAPI parameter generation with type information
   - For validation (UUID, regex, etc.), use query params or handle in handler

4. **Error Response Format:** ✅ DECIDED
   - All `res.*` error methods return standardized JSON structure:
     ```typescript
     {
       message: string,      // Human-readable error message
       code?: string,        // Machine-readable error code (e.g., "VALIDATION_ERROR")
       details?: unknown     // Additional error context (validation errors, stack traces in dev)
     }
     ```
   - Customizable via `.errorResponses()` when non-standard format is needed
   - Default error schemas provided for common status codes (400, 401, 403, 404, 500)

5. **WebSocket Priority:** 🤔 RECOMMENDATION
   - **Recommendation:** Defer to Phase 6 (after CORS & content types)
   - **Reasoning:**
     - HTTP API is the foundation and more commonly used
     - WebSocket patterns differ significantly (connection-based vs request/response)
     - Better to have solid HTTP implementation first
     - Can learn from HTTP implementation when designing WS API
     - Many apps don't need WebSockets initially
   - **Alternative:** If real-time features are critical, move to Phase 4 after OpenAPI
   - **Suggested approach:** Start with HTTP, add WebSocket when clear use cases emerge

6. **Middleware Ordering:** ✅ DECIDED
   - **Global middlewares are required** - configured in `createServer({ globalMiddlewares: [...] })`
   - **Execution order:**
     1. CORS middleware (if enabled)
     2. Global middlewares (in array order)
     3. Route-level middlewares (in array order)
     4. Route handler
   - **Common global middleware use cases:**
     - Request ID generation (`ctx.requestId = uuid()`)
     - Logging (request start/end)
     - Security headers (CSP, HSTS, X-Frame-Options)
     - Rate limiting
     - Request body size limits
     - Error handling/recovery
   - **Short-circuit behavior:** Any middleware can return Response to stop chain

7. **CORS Default Behavior:** ✅ DECIDED
   - Disabled by default - must be explicitly configured via `cors` option
   - When enabled, runs as first middleware (before global middlewares)
   - Security-first approach - developers must consciously enable CORS
   - Prevents accidental exposure of API to unauthorized origins

8. **Static File Serving:** ✅ DECIDED
   - Built-in feature via `static` option in `createServer()`
   - Handled early in request processing (after CORS, before global middlewares)
   - Efficient serving using `Bun.file()` for zero-copy streaming
   - Supports content-type detection, caching headers, range requests
   - Middleware execution
   - Error handling
   - Server start/stop

3. **Type Tests**
   - Verify type inference
   - Test schema type extraction

## Usage Example (Target API)

```typescript
// apps/backend/src/main.ts
import { createServer } from "@bunkit/server"
import { config } from "@/config"
import { logger } from "@/core/logger"

// Create server first
const server = createServer({
  port: config.PORT,
  host: config.HOST,
  development: config.NODE_ENV === "development",
  cors: {
    origin: ['http://localhost:3000', 'https://app.example.com'],
    credentials: true
  },
  globalMiddlewares: [
    requestIdMiddleware,
    loggingMiddleware,
    securityHeadersMiddleware
  ]
})

// Import route files AFTER server creation
// Routes auto-register when their .handler() is called
import './routes/todos.routes'
import './routes/users.routes'
import './routes/auth.routes'

// Start the server
const result = await server.start()
if (result.isErr()) {
  logger.error("Failed to start server", { error: result.error })
  process.exit(1)
}

// Export OpenAPI spec (generated on demand)
await server.exportOpenApiSpec("./openapi.json")
```

```typescript
// apps/backend/src/routes/todos.routes.ts
import { createRoute } from "@bunkit/server"
import { z } from "zod"

const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean()
}).meta({ id: "Todo" })

createRoute("GET", "/api/todos/:id")
  .openapi({
    operationId: "getTodo",
    summary: "Get todo by ID",
    tags: ["Todos"]
  })
  .response(TodoSchema)
  .errors([404])  // Auto-attach standard 404 error response
  .handler(async ({ params, res }) => {
    // params.id is automatically typed as string (extracted from path)
    const result = await getTodo(params.id)
    
    if (result.isErr()) {
      return res.notFound({
        message: "Todo not found",
        code: "TODO_NOT_FOUND"
      })
    }
    
    return res.ok(result.value)
  })
```

## Open Questions & Decisions Needed

1. **Route Discovery:**
   - Should routes auto-register globally on import, or be explicitly registered?
   - Current implementation assumes auto-registration (via .handler() call)

2. **OpenAPI Spec Location:**
   - Should the spec be stored in memory and exported on demand?
   - Or should it be a build-time generation step?

3. **Path Parameter Typing:**
   - Can we type path parameters from the route path string?
   - E.g., `/todos/:id` → `{ id: string }`

4. **Error Response Format:**
   - Should we standardize error response JSON structure?
   - Current assumption: `{ message: string, code?: string }`

5. **WebSocket Priority:**
   - Should WS support be in Phase 1 or deferred?
   - Current plan: Defer to Phase 5

6. **Middleware Ordering:**
   - Should global middlewares be supported?
   - If yes, how do they interact with route-level middlewares?

## Success Criteria

- ✅ Can define routes with type-safe handlers
- ✅ **Handler return types validated at compile time against response schemas**
- ✅ Full type inference from Zod schemas (query, body, params, response)
- ✅ TypeScript errors when handler returns wrong type
- ✅ Request validation works with helpful error messages
- ✅ Middleware system supports auth and other use cases
- ✅ OpenAPI spec is automatically generated and matches expected format
- ✅ Response helpers provide convenient API
- ✅ All operations use Result pattern
- ✅ No `any` types in public API
- ✅ Works seamlessly with existing backend code

## Next Steps

1. **Plan Finalized** - All architectural decisions made
2. **Begin Phase 1** - Core infrastructure (routes, registry, response helpers, basic server)
3. **Continue to Phase 2** - Validation & type safety (params, query, body, response types)
4. **Add Phase 3** - Middleware system (global + route-level)
5. **Implement Phase 4** - OpenAPI generation with zod-openapi
6. **Complete Phase 5** - CORS & content types (text, HTML, files, streaming, static files)
7. **Evaluate Phase 6** - WebSocket support (based on project needs)
8. **Iterate** - Build incrementally with testing at each step

---

## Summary of Key Decisions

### Confirmed Decisions

1. **Route Discovery:** Auto-register on import, files imported after server creation
2. **OpenAPI:** Generated on demand, no internal caching
3. **Path Parameters:** Fully typed via `.params()`, validated with Zod, exported to OpenAPI
4. **Error Format:** Standardized `{ message, code?, details? }` structure
5. **Global Middlewares:** Required feature, runs after CORS but before route middlewares
6. **Middleware Order:** CORS → Static Files → Global → Route → Handler

### WebSocket Recommendation

**My recommendation: Defer WebSocket to Phase 6 (after HTTP is solid)**

**Reasoning:**
- HTTP API foundation is more critical and universally needed
- WebSocket patterns are fundamentally different (stateful connections vs stateless requests)
- Learning from HTTP implementation will inform better WebSocket design
- Most applications start with HTTP and add WebSockets later when needed
- Allows time to design WebSocket API thoughtfully without rushing

**When to prioritize WebSocket:**
- Real-time features are a core requirement (chat, live updates, multiplayer games)
- Project timeline requires WebSocket functionality early
- Team has specific WebSocket use cases already defined

**Suggested WebSocket approach when implemented:**
```typescript
createWebSocketRoute("/ws/chat")
  .onConnect((socket, ctx) => { /* ... */ })
  .onMessage(MessageSchema, (socket, data, ctx) => { /* ... */ })
  .onDisconnect((socket, ctx) => { /* ... */ })
  .register()
```

This can be a future enhancement once the HTTP foundation is rock-solid.

---

**Questions for Final Review:**
- ✅ Architecture aligns with vision
- ✅ All critical decisions documented
- ✅ Type safety requirements clear
- ✅ Implementation phases prioritized
- Ready to begin implementation? 🚀
