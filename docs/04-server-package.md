# @bunkit/server - Complete Guide

The `@bunkit/server` package is the core framework of BunKit. It provides a type-safe HTTP and WebSocket server with automatic OpenAPI 3.1 generation, built specifically for Bun runtime.

## Table of Contents

- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [HTTP Routes](#http-routes)
- [WebSocket Routes](#websocket-routes)
- [Middleware System](#middleware-system)
- [OpenAPI Generation](#openapi-generation)
- [Type Generation](#type-generation)
- [Error Handling](#error-handling)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)

## Installation

> **Note**: `@bunkit/server` and `@bunkit/result` are internal packages in the BunKit monorepo, not published to npm. They're automatically available through Bun workspaces when working within the BunKit project.

If creating a new application within the BunKit monorepo:

```json
// Add to your package.json
{
  "dependencies": {
    "@bunkit/server": "workspace:*",
    "@bunkit/result": "workspace:*",
    "zod": "^4.1.11"
  }
}
```

Then run:
```bash
bun install
```

The package requires:
- `@bunkit/result` - For Result pattern
- `zod` - For schema validation

## Core Concepts

### Server Creation

Create a server instance with configuration:

```typescript
import { createServer } from "@bunkit/server"

const server = createServer({
  port: 3000,
  host: "0.0.0.0",
  development: true,
  cors: {
    origin: ["http://localhost:5173"],
    credentials: true
  },
  globalMiddlewares: [loggingMiddleware],
  websocket: {
    maxPayloadLength: 16 * 1024 * 1024, // 16MB
    idleTimeout: 120, // seconds
    compression: true
  },
  openapi: {
    title: "My API",
    version: "1.0.0",
    description: "API documentation",
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  }
})

// Start the server
const result = await server.start()
if (result.isErr()) {
  console.error("Failed to start:", result.error)
  process.exit(1)
}

console.log("Server running on http://localhost:3000")
```

### Result Pattern

All server operations return `Result<T, E>` instead of throwing exceptions:

```typescript
// Server operations
const startResult = await server.start()
const stopResult = await server.stop()
const specResult = await server.http.getOpenApiSpec()

// Check success or failure
if (startResult.isOk()) {
  console.log("Server started successfully")
} else {
  console.error("Error:", startResult.error.message)
}
```

## HTTP Routes

### Basic Route Definition

```typescript
import { createRoute } from "@bunkit/server"
import { z } from "zod"

createRoute("GET", "/api/users/:id")
  .openapi({
    operationId: "getUser",
    summary: "Get user by ID",
    tags: ["Users"]
  })
  .response(UserSchema)
  .handler(({ params, res }) => {
    // params.id is automatically typed as string
    const user = findUser(params.id)
    if (!user) {
      return res.notFound("User not found")
    }
    return res.ok(user)
  })
```

### HTTP Methods

Supported methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS

```typescript
createRoute("POST", "/api/users")
createRoute("PUT", "/api/users/:id")
createRoute("PATCH", "/api/users/:id")
createRoute("DELETE", "/api/users/:id")
```

### Path Parameters

Parameters are automatically extracted and typed:

```typescript
createRoute("GET", "/api/posts/:postId/comments/:commentId")
  .handler(({ params, res }) => {
    // params.postId: string
    // params.commentId: string
    const comment = findComment(params.postId, params.commentId)
    return res.ok(comment)
  })
```

### Query Parameters

Define query parameter schemas with Zod:

```typescript
const ListUsersQuery = z.object({
  search: z.string().optional(),
  page: z.string().default("1"),
  limit: z.string().default("10"),
  role: z.enum(["admin", "user"]).optional()
})

createRoute("GET", "/api/users")
  .query(ListUsersQuery)
  .response(z.array(UserSchema))
  .handler(({ query, res }) => {
    // query is fully typed and validated
    const page = parseInt(query.page)
    const limit = parseInt(query.limit)
    
    const users = searchUsers({
      search: query.search,
      role: query.role,
      page,
      limit
    })
    
    return res.ok(users)
  })
```

### Request Body

Define request body schemas:

```typescript
const CreateUserBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["admin", "user"]).default("user")
})

createRoute("POST", "/api/users")
  .body(CreateUserBody)
  .response(UserSchema, { status: 201 })
  .handler(async ({ body, res }) => {
    // body is fully typed and validated
    const result = await createUser(body)
    
    if (result.isErr()) {
      return res.badRequest(result.error.message)
    }
    
    return res.created(result.value)
  })
```

### Response Schemas

Define expected response schemas for documentation and validation:

```typescript
createRoute("GET", "/api/users/:id")
  .response(UserSchema, {
    description: "User found successfully",
    status: 200
  })
  .handler(({ params, res }) => {
    const user = findUser(params.id)
    return res.ok(user)
  })
```

### Error Responses

Specify possible error responses:

```typescript
createRoute("GET", "/api/users/:id")
  .response(UserSchema)
  .errors([400, 404, 500])
  .handler(({ params, res }) => {
    if (!isValidId(params.id)) {
      return res.badRequest("Invalid user ID format")
    }
    
    const user = findUser(params.id)
    if (!user) {
      return res.notFound("User not found")
    }
    
    return res.ok(user)
  })
```

Or with custom error schemas:

```typescript
const CustomError = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional()
})

createRoute("POST", "/api/users")
  .body(CreateUserBody)
  .response(UserSchema, { status: 201 })
  .errorResponses({
    400: { description: "Validation error", schema: CustomError },
    409: { description: "User already exists", schema: CustomError }
  })
  .handler(async ({ body, res }) => {
    const existing = await findUserByEmail(body.email)
    if (existing) {
      return res.conflict({
        code: "USER_EXISTS",
        message: "User with this email already exists",
        details: { email: body.email }
      })
    }
    
    const result = await createUser(body)
    return res.created(result.value)
  })
```

### Route Middleware

Add middleware specific to a route:

```typescript
createRoute("GET", "/api/admin/users")
  .middlewares(authMiddleware, adminMiddleware)
  .response(z.array(UserSchema))
  .handler(({ ctx, res }) => {
    // ctx contains data from middlewares
    const users = getAllUsers()
    return res.ok(users)
  })
```

### Security/Authentication

Mark routes as requiring authentication:

```typescript
createRoute("GET", "/api/profile")
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware)
  .response(UserSchema)
  .handler(({ ctx, res }) => {
    const userId = ctx.userId as string
    const user = findUser(userId)
    return res.ok(user)
  })
```

### Complete Example

```typescript
import { createRoute } from "@bunkit/server"
import { z } from "zod"

const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
})

const CreateTodoBody = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional()
})

const UpdateTodoBody = z.object({
  title: z.string().min(1).max(100).optional(),
  completed: z.boolean().optional()
})

// List todos
createRoute("GET", "/api/todos")
  .openapi({
    operationId: "listTodos",
    summary: "List all todos",
    tags: ["Todos"]
  })
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware)
  .response(z.array(TodoSchema))
  .handler(({ ctx, res }) => {
    const todos = getTodosForUser(ctx.userId)
    return res.ok(todos)
  })

// Get single todo
createRoute("GET", "/api/todos/:id")
  .openapi({
    operationId: "getTodo",
    summary: "Get todo by ID",
    tags: ["Todos"]
  })
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware)
  .response(TodoSchema)
  .errors([404])
  .handler(({ params, ctx, res }) => {
    const todo = getTodo(params.id, ctx.userId)
    if (!todo) {
      return res.notFound("Todo not found")
    }
    return res.ok(todo)
  })

// Create todo
createRoute("POST", "/api/todos")
  .openapi({
    operationId: "createTodo",
    summary: "Create a new todo",
    tags: ["Todos"]
  })
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware)
  .body(CreateTodoBody)
  .response(TodoSchema, { status: 201 })
  .handler(async ({ body, ctx, res }) => {
    const result = await createTodo({
      ...body,
      userId: ctx.userId
    })
    
    if (result.isErr()) {
      return res.internalError("Failed to create todo")
    }
    
    return res.created(result.value)
  })

// Update todo
createRoute("PATCH", "/api/todos/:id")
  .openapi({
    operationId: "updateTodo",
    summary: "Update a todo",
    tags: ["Todos"]
  })
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware)
  .body(UpdateTodoBody)
  .response(TodoSchema)
  .errors([404])
  .handler(async ({ params, body, ctx, res }) => {
    const result = await updateTodo(params.id, ctx.userId, body)
    
    if (result.isErr()) {
      return res.notFound("Todo not found")
    }
    
    return res.ok(result.value)
  })

// Delete todo
createRoute("DELETE", "/api/todos/:id")
  .openapi({
    operationId: "deleteTodo",
    summary: "Delete a todo",
    tags: ["Todos"]
  })
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware)
  .response(z.object({ message: z.string() }))
  .errors([404])
  .handler(async ({ params, ctx, res }) => {
    const result = await deleteTodo(params.id, ctx.userId)
    
    if (result.isErr()) {
      return res.notFound("Todo not found")
    }
    
    return res.ok({ message: "Todo deleted successfully" })
  })
```

## WebSocket Routes

### Basic WebSocket Route

```typescript
import { createWebSocketRoute, createTokenAuth } from "@bunkit/server"
import { z } from "zod"

// Define client messages
const ChatMessageSchema = z.object({
  message: z.string().min(1).max(1000)
})

// Define server messages
const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    userId: z.string(),
    message: z.string(),
    timestamp: z.number()
  }),
  z.object({
    type: z.literal("error"),
    message: z.string()
  })
])

// Create WebSocket route
createWebSocketRoute("/ws/chat")
  .serverMessages(ServerMessageSchema)
  .on("chat_message", ChatMessageSchema, (ws, ctx, data) => {
    // Broadcast to all connected clients
    ws.publish("chat", {
      type: "message",
      userId: ctx.user.id,
      message: data.message,
      timestamp: Date.now()
    })
  })
  .onConnect((ws, ctx) => {
    console.log("User connected:", ctx.user?.id)
    ws.subscribe("chat")
  })
  .onClose((ws, ctx, code, reason) => {
    console.log("User disconnected:", ctx.user?.id)
  })
  .build()
```

### WebSocket Authentication

```typescript
const wsAuth = createTokenAuth(async (token: string) => {
  const result = await verifyJWT(token)
  if (result.isErr()) {
    return null // Auth failed
  }
  
  return {
    id: result.value.userId,
    email: result.value.email
  }
})

createWebSocketRoute("/ws/chat")
  .authenticate(wsAuth)
  .serverMessages(ServerMessageSchema)
  .on("chat_message", ChatMessageSchema, (ws, ctx, data) => {
    // ctx.user is now typed and guaranteed to exist
    ws.publish("chat", {
      type: "message",
      userId: ctx.user.id,
      message: data.message,
      timestamp: Date.now()
    })
  })
  .build()
```

### Multiple Message Types

```typescript
const JoinRoomSchema = z.object({
  roomId: z.string()
})

const LeaveRoomSchema = z.object({
  roomId: z.string()
})

const ChatMessageSchema = z.object({
  roomId: z.string(),
  message: z.string()
})

createWebSocketRoute("/ws/chat")
  .serverMessages(ServerMessageSchema)
  .on("join_room", JoinRoomSchema, (ws, ctx, data) => {
    ws.subscribe(`room:${data.roomId}`)
    ws.send({
      type: "room_joined",
      roomId: data.roomId
    })
  })
  .on("leave_room", LeaveRoomSchema, (ws, ctx, data) => {
    ws.unsubscribe(`room:${data.roomId}`)
    ws.send({
      type: "room_left",
      roomId: data.roomId
    })
  })
  .on("chat_message", ChatMessageSchema, (ws, ctx, data) => {
    ws.publish(`room:${data.roomId}`, {
      type: "message",
      roomId: data.roomId,
      userId: ctx.user.id,
      message: data.message,
      timestamp: Date.now()
    })
  })
  .build()
```

### WebSocket Lifecycle Handlers

```typescript
createWebSocketRoute("/ws/chat")
  .serverMessages(ServerMessageSchema)
  // Called when connection opens
  .onConnect((ws, ctx) => {
    console.log("Connected:", ctx.user?.id)
    ws.subscribe("global")
  })
  // Called when connection closes
  .onClose((ws, ctx, code, reason) => {
    console.log("Disconnected:", ctx.user?.id, code, reason)
  })
  // Called on errors (validation failures, handler exceptions)
  .onError((ws, ctx, error) => {
    console.error("WebSocket error:", error)
    ws.send({
      type: "error",
      message: "An error occurred"
    })
  })
  // Called for binary messages
  .onBinary((ws, ctx, data) => {
    console.log("Received binary data:", data.byteLength)
  })
  .on("chat_message", ChatMessageSchema, (ws, ctx, data) => {
    ws.publish("global", {
      type: "message",
      userId: ctx.user.id,
      message: data.message,
      timestamp: Date.now()
    })
  })
  .build()
```

### WebSocket API

Inside handlers, the `ws` object provides:

```typescript
// Send message to this client
ws.send({ type: "message", content: "Hello" })

// Publish to all subscribers of a topic
ws.publish("topic", { type: "broadcast", data: "..." })

// Subscribe to a topic
ws.subscribe("room:123")

// Unsubscribe from a topic
ws.unsubscribe("room:123")

// Close the connection
ws.close(1000, "Goodbye")

// Access connection metadata
ws.data // WebSocketData with user, params, etc.
ws.remoteAddress // Client IP address
```

## Middleware System

### Creating Middleware

Middleware functions have access to request context and can modify it:

```typescript
import type { MiddlewareFn } from "@bunkit/server"

const loggingMiddleware: MiddlewareFn = async (req, ctx, next) => {
  const start = Date.now()
  const response = await next()
  const duration = Date.now() - start
  
  console.log(`${req.method} ${req.url} - ${response.status} (${duration}ms)`)
  
  return response
}
```

### Adding Context Data

Middleware can add data to context for downstream handlers:

```typescript
const authMiddleware: MiddlewareFn = async (req, ctx, next) => {
  const token = extractBearerToken(req)
  
  if (!token) {
    return new Response(
      JSON.stringify({ message: "Missing token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }
  
  const result = await verifyToken(token)
  if (result.isErr()) {
    return new Response(
      JSON.stringify({ message: "Invalid token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }
  
  // Add user data to context
  ctx.userId = result.value.userId
  ctx.email = result.value.email
  
  return next()
}
```

### Global Middleware

Applied to all routes:

```typescript
const server = createServer({
  port: 3000,
  globalMiddlewares: [
    loggingMiddleware,
    corsMiddleware,
    rateLimitMiddleware
  ]
})
```

### Route-Level Middleware

Applied to specific routes:

```typescript
createRoute("GET", "/api/admin/users")
  .middlewares(authMiddleware, adminMiddleware)
  .handler(({ ctx, res }) => {
    // Both auth and admin checks passed
    return res.ok(getAllUsers())
  })
```

### Middleware Execution Order

```
Request → Global Middlewares → Route Middlewares → Handler → Response
```

### Short-Circuiting

Middleware can short-circuit by returning a Response instead of calling `next()`:

```typescript
const rateLimitMiddleware: MiddlewareFn = async (req, ctx, next) => {
  const ip = req.headers.get("x-forwarded-for") || "unknown"
  
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ message: "Too many requests" }),
      { 
        status: 429,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
  
  return next()
}
```

## OpenAPI Generation

### Automatic Spec Generation

OpenAPI specification is automatically generated from your routes:

```typescript
const server = createServer({
  openapi: {
    title: "My API",
    version: "1.0.0",
    description: "API for my application",
    servers: [
      { url: "http://localhost:3000", description: "Development" },
      { url: "https://api.example.com", description: "Production" }
    ],
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  }
})

// Get OpenAPI spec
const specResult = await server.http.getOpenApiSpec()
if (specResult.isOk()) {
  console.log(JSON.stringify(specResult.value, null, 2))
}
```

### Export to File

```typescript
// Export OpenAPI JSON
await server.http.exportOpenApiSpec("./openapi.json")

// Export with types for frontend
await server.http.exportOpenApiSpec("./frontend/src/generated/openapi.json", {
  types: true,
  output: "./frontend/src/generated"
})
```

### Route Metadata

Enhance OpenAPI documentation with metadata:

```typescript
createRoute("POST", "/api/users")
  .openapi({
    operationId: "createUser",
    summary: "Create a new user",
    description: "Creates a new user account with the provided information",
    tags: ["Users"],
    externalDocs: {
      url: "https://docs.example.com/users",
      description: "User management documentation"
    }
  })
  .body(CreateUserBody)
  .response(UserSchema, { 
    status: 201,
    description: "User created successfully" 
  })
  .handler(({ body, res }) => {
    // ...
  })
```

### Schema Metadata

Add examples and descriptions to schemas:

```typescript
const UserSchema = z.object({
  id: z.string().meta({ example: "user_123" }),
  email: z.string().email().meta({ example: "user@example.com" }),
  name: z.string().meta({ example: "John Doe" }),
  role: z.enum(["admin", "user"]).meta({ example: "user" })
}).meta({
  id: "User",
  title: "User Object",
  description: "Represents a user in the system"
})
```

## Type Generation

### Frontend Type Generation

Generate TypeScript types for your frontend:

```typescript
// In a script file
import { createServer } from "@bunkit/server"
import "./routes" // Import to register routes

const server = createServer()

await server.http.exportOpenApiSpec("./frontend/src/generated/openapi.json", {
  types: true,
  output: "./frontend/src/generated"
})
```

### WebSocket Type Generation

Generate WebSocket types for clients:

```typescript
await server.ws.exportWebSocketTypes({
  output: "./frontend/src/generated/websocket-types.ts",
  format: "typescript"
})
```

This generates:

```typescript
// Generated file
export type ServerMessage = 
  | { type: "message"; userId: string; message: string; timestamp: number }
  | { type: "error"; message: string }

export type ClientMessage = 
  | { type: "chat_message"; message: string }
  | { type: "join_room"; roomId: string }
```

## Error Handling

### Response Helpers

The `res` object provides type-safe response helpers:

```typescript
handler(({ res }) => {
  // Success responses
  res.ok(data)              // 200
  res.created(data)         // 201
  res.noContent()           // 204
  
  // Client error responses
  res.badRequest(message)   // 400
  res.unauthorized(message) // 401
  res.forbidden(message)    // 403
  res.notFound(message)     // 404
  res.conflict(message)     // 409
  
  // Server error responses
  res.internalError(message) // 500
  
  // Custom response
  res.custom(data, { status: 418, headers: { ... } })
})
```

### Standard Error Format

All error responses follow a standard format:

```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Result Pattern in Handlers

Combine with `@bunkit/result`:

```typescript
createRoute("POST", "/api/users")
  .body(CreateUserBody)
  .response(UserSchema, { status: 201 })
  .handler(async ({ body, res }) => {
    const result = await userService.create(body)
    
    if (result.isErr()) {
      const error = result.error
      
      if (error.code === "USER_EXISTS") {
        return res.conflict(error.message)
      }
      
      if (error.code === "VALIDATION_ERROR") {
        return res.badRequest(error.message)
      }
      
      return res.internalError("Failed to create user")
    }
    
    return res.created(result.value)
  })
```

## Advanced Features

### Multiple Server Instances

Run multiple servers with isolated route registries:

```typescript
const apiServer = createServer({ port: 3000 })
const adminServer = createServer({ port: 3001 })

// Routes bound to specific servers
createRoute("GET", "/api/users", apiServer)
  .handler(({ res }) => res.ok(getUsers()))

createRoute("GET", "/admin/users", adminServer)
  .handler(({ res }) => res.ok(getAllUsersAdmin()))

await apiServer.start()
await adminServer.start()
```

### Route Inspection

Inspect registered routes at runtime:

```typescript
const routes = server.http.getRoutes()
routes.forEach(route => {
  console.log(`${route.method} ${route.path}`)
})

const wsRoutes = server.ws.getRoutes()
wsRoutes.forEach(route => {
  console.log(`WS ${route.path}`)
})
```

### Custom Error Handlers

Customize error response generation:

```typescript
createRoute("GET", "/api/users")
  .response(UserSchema)
  .errorResponses({
    404: {
      description: "User not found",
      schema: z.object({
        error: z.string(),
        suggestedAction: z.string()
      })
    }
  })
  .handler(({ res }) => {
    return res.custom(
      {
        error: "User not found",
        suggestedAction: "Check the user ID and try again"
      },
      { status: 404 }
    )
  })
```

### CORS Configuration

Fine-grained CORS control:

```typescript
const server = createServer({
  cors: {
    origin: ["http://localhost:5173", "https://app.example.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Total-Count"],
    maxAge: 86400 // 24 hours
  }
})
```

## API Reference

### Server Options

```typescript
interface ServerOptions {
  port?: number                    // Default: 3000
  host?: string                    // Default: "0.0.0.0"
  development?: boolean            // Default: false
  cors?: CorsOptions               // CORS configuration
  globalMiddlewares?: MiddlewareFn[] // Global middlewares
  websocket?: WebSocketOptions     // WebSocket configuration
  openapi?: OpenApiOptions         // OpenAPI configuration
}
```

### Route Context

```typescript
interface RouteContext<TParams, TQuery, TBody> {
  params: TParams      // Path parameters
  query: TQuery        // Query parameters
  body: TBody          // Request body
  req: Request         // Raw request object
  ctx: ContextData     // Middleware context data
  res: ResponseHelpers // Response helper methods
}
```

### WebSocket Context

```typescript
interface WebSocketContext<TServerMsg, TUser> {
  ws: TypedWebSocket<TServerMsg>  // Type-safe WebSocket
  user: TUser                     // Authenticated user
  params: Record<string, string>  // Path parameters
}
```

### Response Helpers

```typescript
interface ResponseHelpers {
  ok<T>(data: T): Response
  created<T>(data: T): Response
  noContent(): Response
  badRequest(message: string): Response
  unauthorized(message: string): Response
  forbidden(message: string): Response
  notFound(message: string): Response
  conflict(message: string): Response
  internalError(message: string): Response
  custom<T>(data: T, options: ResponseOptions): Response
}
```

## Best Practices

1. **Always define schemas** - Use Zod schemas for type safety and documentation
2. **Use Result pattern** - Return Result types from service layers
3. **Validate early** - Let the framework validate inputs before handlers
4. **Security by default** - Add `.security()` to protected routes
5. **Descriptive metadata** - Add meaningful OpenAPI metadata
6. **Error responses** - Document all possible error responses
7. **Type generation** - Generate types for frontend consistency
8. **Middleware composition** - Build reusable middleware functions
9. **WebSocket rooms** - Use pub/sub for scalable real-time features
10. **Test your routes** - Write integration tests for all endpoints

## Examples

See the [Backend Application Guide](./06-backend-application.md) for complete working examples from the BunKit starter template.

## Next Steps

- [WebSocket Development Guide](./07-websocket-guide.md)
- [Backend Application Guide](./06-backend-application.md)
- [Testing Guide](./13-testing.md)
