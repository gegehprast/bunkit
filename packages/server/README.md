# @bunkit/server

Type-safe HTTP and WebSocket server with automatic OpenAPI 3.1 generation using `zod-openapi`, route management, and middleware support for BunKit applications.

## Features

### HTTP Features
- ✅ **Type-Safe** - Full TypeScript inference with compile-time validation
- ✅ **Auto Path Parameters** - Automatically extracted from route strings
- ✅ **OpenAPI Generation** - Automatic spec generation via `zod-openapi`
- ✅ **Zod Validation** - Request validation with helpful error messages
- ✅ **Middleware Support** - Global and route-level middlewares
- ✅ **CORS Built-in** - Configurable CORS with automatic preflight handling
- ✅ **Security Schemes** - Built-in support for Bearer auth, API keys, and OAuth2
- ✅ **Standard Error Responses** - Typed error schemas for common HTTP errors
- ✅ **Single Success Response** - Clear, type-safe API contracts

### WebSocket Features
- ✅ **Type-Safe WebSocket Routes** - Full TypeScript inference for messages
- ✅ **Message Validation** - Zod schemas for message validation
- ✅ **Path Parameters** - Same parameter extraction as HTTP routes
- ✅ **Authentication** - Token-based auth with helper utilities
- ✅ **External Broadcasting** - Publish to connections from anywhere
- ✅ **Client Type Generation** - Auto-generate TypeScript types for clients
- ✅ **Binary Messages** - Support for binary data streams with backpressure
- ✅ **Connection Lifecycle** - Hooks for open, close, drain, and error events
- ✅ **Server Message Validation** - Type-safe server-to-client messages

### Shared Features
- ✅ **Result Pattern** - Error handling without exceptions
- ✅ **Bun Native** - Uses `Bun.serve` for optimal performance
- ✅ **Single Port** - HTTP and WebSocket on the same port
- ✅ **Unified Server** - One server instance, namespaced methods (`http.*`, `ws.*`)

## Installation

```bash
bun add @bunkit/server
```

## Quick Start

```typescript
import { z } from "zod"
import { createRoute, createServer, ErrorResponseSchema } from "@bunkit/server"

// Define schemas with OpenAPI metadata
const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
}).meta({ 
  id: "Todo",
  title: "Todo Item",
  description: "A todo list item"
})

// Create a route with automatic type inference
createRoute("GET", "/api/todos/:id")
  .openapi({ 
    operationId: "getTodo",
    summary: "Get a todo by ID",
    tags: ["Todos"]
  })
  .response(TodoSchema)
  .errors([404])  // Uses standard error schemas
  .handler(({ params, res }) => {
    // params.id is automatically typed as string!
    const todo = findTodo(params.id)
    if (!todo) {
      return res.notFound("Todo not found")
    }
    return res.ok(todo)
  })

// Create POST endpoint with validation
createRoute("POST", "/api/todos")
  .body(z.object({ 
    title: z.string().min(1),
    description: z.string().optional()
  }))
  .response(TodoSchema, { status: 201 })
  .errors([400])
  .handler(({ body, res }) => {
    const todo = createTodo(body)
    return res.created(todo)
  })

// Create and start server
const server = createServer({ 
  port: 3000,
  cors: { origin: ["http://localhost:5173"] }
})
await server.start()

// Access HTTP methods via server.http namespace
const spec = await server.http.getOpenApiSpec()
await server.http.exportOpenApiSpec("./openapi.json")
```

## Documentation

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for complete API reference and usage examples.

## Key Features

### Automatic Path Parameter Extraction

Path parameters are automatically extracted and typed:

```typescript
createRoute("GET", "/api/users/:userId/posts/:postId")
  .handler(({ params, res }) => {
    // params.userId and params.postId are automatically typed as string
    return res.ok({ userId: params.userId, postId: params.postId })
  })
```

### Type-Safe Request/Response

```typescript
const TodoSchema = z.object({ id: z.string(), title: z.string() })

createRoute("POST", "/api/todos")
  .body(z.object({ title: z.string() }))
  .response(TodoSchema, { status: 201 })  // Single success response
  .errors([400])  // Standard error responses
  .handler(({ body, res }) => {
    // body.title is typed as string
    // Return type is validated at compile time
    return res.created({ id: "1", title: body.title })
  })
```

### Security & Authentication

```typescript
// Add bearer authentication to a route
createRoute("GET", "/api/protected")
  .security()  // Defaults to bearerAuth
  .middlewares(authMiddleware())
  .response(DataSchema)
  .errors([401])
  .handler(({ ctx, res }) => {
    const userId = ctx.userId  // Set by auth middleware
    return res.ok(getUserData(userId))
  })

// Custom security schemes
createRoute("GET", "/api/custom")
  .security([{ apiKey: [] }])
  .handler(({ res }) => res.ok({ data: "protected" }))
```

### Standard Error Responses

```typescript
import { ErrorResponseSchema } from "@bunkit/server"

// Use .errors() for common error status codes
createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .errors([400, 404])  // Auto-generates standard error schemas
  .handler(({ params, res }) => {
    if (!isValidId(params.id)) {
      return res.badRequest("Invalid ID format")
    }
    const todo = findTodo(params.id)
    if (!todo) {
      return res.notFound("Todo not found")
    }
    return res.ok(todo)
  })

// Or use .errorResponses() for custom error schemas
createRoute("POST", "/api/todos")
  .body(TodoBodySchema)
  .response(TodoSchema)
  .errorResponses({
    409: {
      description: "Todo already exists",
      content: {
        "application/json": { schema: ErrorResponseSchema }
      }
    }
  })
  .handler(({ body, res }) => {
    // Custom error handling
  })
```

### Middleware System

```typescript
const logger: MiddlewareFn = async ({ req, next }) => {
  console.log(`${req.method} ${new URL(req.url).pathname}`)
  return next()
}

const server = createServer({
  globalMiddlewares: [logger]
})
```

### OpenAPI Generation

Automatic OpenAPI 3.1 spec generation using `zod-openapi`:

```typescript
const server = createServer({
  openapi: {
    info: {
      title: "My API",
      version: "1.0.0",
      description: "API description"
    }
  }
})

// Access via server.http namespace
const specResult = await server.http.getOpenApiSpec()
if (specResult.isOk()) {
  console.log("OpenAPI spec:", specResult.value)
}

// Export to file
await server.http.exportOpenApiSpec("./openapi.json")
```

### WebSocket Support

```typescript
import { createWebSocketRoute } from "@bunkit/server"

// Define message schemas
const ChatMessageSchema = z.object({
  type: z.literal("chat"),
  message: z.string(),
  timestamp: z.number()
})

// Create WebSocket route with path parameters
createWebSocketRoute("/ws/chat/:roomId")
  .authenticate(createTokenAuth((token) => verifyToken(token)))
  .on("chat", ChatMessageSchema, ({ message, ws, user }) => {
    // Broadcast to room
    server.ws.publish(`room:${ws.data.params.roomId}`, message)
  })
  .onOpen(({ ws, user }) => {
    console.log(`User ${user?.id} joined room ${ws.data.params.roomId}`)
  })
  .build()

// Publish from anywhere in your app
server.ws.publish("room:123", { 
  type: "notification",
  message: "New user joined" 
})

// Generate client types
const typesResult = await server.ws.generateWebSocketTypes()
if (typesResult.isOk()) {
  await Bun.write("./client-types.ts", typesResult.value)
}
```

## Project Structure

The package is organized into distinct modules for better separation of concerns:

```
src/
├── core/                   # Shared utilities
│   ├── cors.ts             # CORS handling
│   ├── middleware.ts       # Middleware execution engine
│   ├── standard-errors.ts  # Standard error schemas & codes
│   └── validation.ts       # Zod validation utilities
├── http/                   # HTTP-specific functionality
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
├── websocket/              # WebSocket-specific functionality
│   ├── websocket-auth.ts   # Auth utilities (token extraction, etc.)
│   ├── websocket-handler.ts # WebSocket connection handling
│   ├── websocket-registry.ts # WebSocket route storage & matching
│   ├── websocket-route-builder.ts # WebSocket route builder
│   ├── websocket-type-generator.ts # Client TypeScript type generation
│   └── types/              # WebSocket-specific types
│       └── websocket.ts    # WebSocket types & interfaces
├── types/                  # Shared types
│   ├── cors.ts             # CORS configuration types
│   ├── middleware.ts       # Middleware types
│   └── server.ts           # Server configuration types
└── index.ts                # Public API exports
```

**Key Design Principles:**
- **Clear separation** between HTTP, WebSocket, and shared modules
- **Namespaced server methods** - `server.http.*` for HTTP, `server.ws.*` for WebSocket
- **Co-located types** with their respective modules
- **Centralized core** utilities used by both HTTP and WebSocket
- **Single server** orchestrates both protocols on one port
- **Type-safe by default** - Full TypeScript inference throughout

## API Reference

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for complete API documentation and implementation details.

### Key Changes from Earlier Versions

- **Removed `.responses()`** - Routes now support only **one success response** via `.response()`. Use `.errors()` or `.errorResponses()` for error cases. This simplifies the API contract and improves type safety.
- **Server method namespacing** - HTTP methods moved to `server.http.*` (e.g., `server.http.getOpenApiSpec()`), WebSocket methods to `server.ws.*` (e.g., `server.ws.publish()`)
- **Security helper** - `.security()` method now defaults to `bearerAuth` when called without arguments
- **Standard error schemas** - Built-in typed error schemas (`BadRequestErrorResponseSchema`, `UnauthorizedErrorResponseSchema`, etc.)
- **Relative imports** - Using relative paths instead of path aliases for better TypeScript compatibility

## Testing

```bash
bun test
```

## License

MIT
