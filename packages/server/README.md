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
import { createRoute, createServer } from "@bunkit/server"

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

// Create routes (will register to global registry)
createRoute("GET", "/api/todos/:id")
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
createRoute("GET", "/api/users/:userId/posts/:postId", server)
  .handler(({ params, res }) => {
    // params.userId and params.postId are automatically typed as string
    return res.ok({ userId: params.userId, postId: params.postId })
  })
```

### Type-Safe Request/Response

```typescript
const TodoSchema = z.object({ id: z.string(), title: z.string() })

createRoute("POST", "/api/todos", server)
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
createRoute("GET", "/api/protected", server)
  .security()  // Defaults to bearerAuth
  .middlewares(authMiddleware())
  .response(DataSchema)
  .errors([401])
  .handler(({ ctx, res }) => {
    const userId = ctx.userId  // Set by auth middleware
    return res.ok(getUserData(userId))
  })

// Custom security schemes
createRoute("GET", "/api/custom", server)
  .security([{ apiKey: [] }])
  .handler(({ res }) => res.ok({ data: "protected" }))
```

### Standard Error Responses

```typescript
// Use .errors() for common error status codes
createRoute("GET", "/api/todos/:id", server)
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
createRoute("POST", "/api/todos", server)
  .body(TodoBodySchema)
  .response(TodoSchema)
  .errorResponses({
    409: {
      description: "Todo already exists",
      content: {
        "application/json": { 
          schema: z.object({
            message: z.string(),
            code: z.string(),
          })
        }
      }
    }
  })
  .handler(({ body, res }) => {
    // Custom error handling
    if (todoExists(body.title)) {
      return res.conflict("Todo already exists")
    }
    return res.created(createTodo(body))
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

### Multi-Server Setup

For advanced use cases, you can run multiple server instances with isolated route sets by passing the server instance to route builders:

```typescript
// Create two separate servers
const publicServer = createServer({ 
  port: 3000,
  cors: { origin: ["*"] }
})

const adminServer = createServer({ 
  port: 3001,
  cors: { origin: ["https://admin.example.com"] }
})

// Public API routes - only available on publicServer
createRoute("GET", "/api/todos", publicServer)
  .response(TodoSchema)
  .handler(({ res }) => res.ok(getTodos()))

createRoute("POST", "/api/todos", publicServer)
  .body(CreateTodoSchema)
  .response(TodoSchema)
  .handler(({ body, res }) => res.created(createTodo(body)))

// Admin API routes - only available on adminServer
createRoute("GET", "/admin/users", adminServer)
  .security()
  .middlewares(adminAuthMiddleware())
  .response(UsersSchema)
  .handler(({ res }) => res.ok(getAllUsers()))

createRoute("DELETE", "/admin/users/:id", adminServer)
  .security()
  .middlewares(adminAuthMiddleware())
  .response(z.object({ success: z.boolean() }))
  .handler(({ params, res }) => {
    deleteUser(params.id)
    return res.ok({ success: true })
  })

// Start both servers
await Promise.all([
  publicServer.start(),
  adminServer.start()
])
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
import { createWebSocketRoute, createTokenAuth } from "@bunkit/server"

// Define message schemas
const JoinRoomSchema = z.object({
  roomId: z.string(),
})

const ChatMessageSchema = z.object({
  roomId: z.string(),
  message: z.string(),
})

// Define server -> client message types
type ServerMessage =
  | { type: "room_joined"; roomId: string; userId: string }
  | { type: "message"; roomId: string; message: string; userId: string }

// Create WebSocket route (with server parameter to bind to this server)
createWebSocketRoute("/ws/chat", server)
  .serverMessages<ServerMessage>()
  .authenticate(createTokenAuth((token) => verifyToken(token)))
  .on("join", JoinRoomSchema, ({ message, ws, user }) => {
    // Subscribe to room topic
    ws.subscribe(`room:${message.data.roomId}`)
    
    // Broadcast to room
    server.ws.publish(`room:${message.data.roomId}`, {
      type: "room_joined",
      roomId: message.data.roomId,
      userId: user?.id,
    })
  })
  .on("chat", ChatMessageSchema, ({ message, ws, user }) => {
    // Broadcast message to room
    server.ws.publish(`room:${message.data.roomId}`, {
      type: "message",
      roomId: message.data.roomId,
      message: message.data.message,
      userId: user?.id,
    })
  })
  .onConnect(({ ws, user }) => {
    console.log(`User ${user?.id} connected`)
  })
  .build()

// Publish from anywhere in your app
server.ws.publish("room:123", { 
  type: "message",
  roomId: "123",
  message: "New user joined",
  userId: "system"
})
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

### Key Implementation Details

- **Route registration modes** - Routes can be registered in two ways:
  - **Global registry** (recommended for simple apps): Omit server parameter from `createRoute()` or `createWebSocketRoute()`. Routes are available to all server instances.
  - **Server-specific** (for multi-server setups): Pass a server instance to bind routes exclusively to that server. Useful when running multiple servers with different route sets (e.g., public API + admin API on different ports).
- **Single success response** - Routes support only **one success response** via `.response()`. Use `.errors()` or `.errorResponses()` for error cases
- **Namespaced methods** - HTTP methods are under `server.http.*` (e.g., `server.http.getOpenApiSpec()`), WebSocket methods under `server.ws.*` (e.g., `server.ws.publish()`)
- **Standard error schemas** - Built-in typed error response schemas for common HTTP errors (400, 401, 403, 404, 409, 500, etc.)
- **Type-safe WebSocket** - Define server message types with `.serverMessages<T>()` for compile-time validation of published messages

## Testing

```bash
bun test
```

## License

MIT
