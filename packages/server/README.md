# @bunkit/server

Type-safe HTTP and WebSocket server with automatic OpenAPI 3.1 generation, built for Bun runtime.

## Features

- ✅ **Type-Safe Routes** - Full TypeScript inference with compile-time validation
- ✅ **Auto Path Parameters** - Parameters extracted and typed from route paths
- ✅ **OpenAPI 3.1 Generation** - Automatic spec generation via `zod-openapi`
- ✅ **Result Pattern** - Error handling without exceptions (`Result<T, E>`)
- ✅ **HTTP + WebSocket** - Both protocols on a single port with unified server API
- ✅ **Zod Validation** - Request/response validation with helpful error messages
- ✅ **Middleware System** - Global and route-level middleware with composition
- ✅ **CORS Built-in** - Configurable CORS with automatic preflight handling
- ✅ **Security Schemes** - Bearer auth, API keys, OAuth2, and custom schemes
- ✅ **Standard Errors** - Typed error schemas for HTTP error responses
- ✅ **WebSocket Type Generation** - Auto-generate TypeScript types for clients
- ✅ **Route Inspection** - Introspect registered routes at runtime
- ✅ **Multi-Server Support** - Run multiple servers with isolated route registries

## Installation

```bash
bun add @bunkit/server
```

## Quick Start

```typescript
import { createServer, createRoute } from "@bunkit/server"
import { z } from "zod"

// Define your schema
const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
})

// Create HTTP routes
createRoute("GET", "/api/todos/:id")
  .openapi({ 
    operationId: "getTodo",
    summary: "Get a todo by ID",
    tags: ["Todos"]
  })
  .response(TodoSchema)
  .errors([404])
  .handler(({ params, res }) => {
    const todo = findTodo(params.id) // params.id is typed as string
    if (!todo) return res.notFound("Todo not found")
    return res.ok(todo)
  })

createRoute("POST", "/api/todos")
  .body(z.object({ title: z.string().min(1) }))
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

const result = await server.start()
if (result.isErr()) {
  console.error("Failed to start:", result.error)
  process.exit(1)
}

console.log("Server running on http://localhost:3000")
```

## Core Concepts

### Result Pattern

All server operations return `Result<T, E>` instead of throwing exceptions:

```typescript
const server = createServer({ port: 3000 })

// Start returns Result<void, ServerStartError>
const result = await server.start()
if (result.isErr()) {
  console.error("Server failed:", result.error.message)
  process.exit(1)
}

// OpenAPI spec returns Result<OpenApiSpec, Error>
const specResult = await server.http.getOpenApiSpec()
if (specResult.isOk()) {
  console.log("Routes:", Object.keys(specResult.value.paths))
}
```

### Route Registration Modes

Routes can be registered globally or per-server:

```typescript
// Global registry (default) - available to all servers
createRoute("GET", "/health")
  .response(z.object({ status: z.string() }))
  .handler(({ res }) => res.ok({ status: "healthy" }))

// Server-specific - only available to this server instance
const adminServer = createServer({ port: 3001 })
createRoute("GET", "/admin/users", adminServer)
  .response(UsersSchema)
  .handler(({ res }) => res.ok(getUsers()))
```

### Namespaced Server API

HTTP and WebSocket methods are namespaced under `server.http.*` and `server.ws.*`:

```typescript
const server = createServer({ port: 3000 })

// HTTP methods
await server.http.getOpenApiSpec()
await server.http.exportOpenApiSpec("./openapi.json")
const httpRoutes = server.http.getRoutes()

// WebSocket methods  
server.ws.publish("room:123", { message: "Hello" })
server.ws.publishBinary("stream:1", buffer)
await server.ws.getWebSocketTypes()
await server.ws.exportWebSocketTypes({ outputPath: "./types.ts" })
const wsRoutes = server.ws.getRoutes()
```

## HTTP Features

### Automatic Path Parameters

Path parameters are extracted and typed automatically:

```typescript
createRoute("GET", "/api/users/:userId/posts/:postId")
  .response(PostSchema)
  .handler(({ params, res }) => {
    // params.userId and params.postId are typed as string
    const post = getPost(params.userId, params.postId)
    return res.ok(post)
  })
```

### Request Validation

```typescript
const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
})

createRoute("POST", "/api/todos")
  .body(CreateTodoSchema)
  .query(z.object({ notify: z.boolean().optional() }))
  .response(TodoSchema, { status: 201 })
  .errors([400])
  .handler(({ body, query, res }) => {
    // body and query are fully typed and validated
    const todo = createTodo(body)
    if (query.notify) sendNotification(todo)
    return res.created(todo)
  })
```

### Standard Error Responses

Use `.errors()` for standard HTTP error codes:

```typescript
createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .errors([400, 404]) // Generates standard error schemas
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
```

Available error helpers:
- `res.badRequest(message, details?)` - 400
- `res.unauthorized(message)` - 401  
- `res.forbidden(message)` - 403
- `res.notFound(message)` - 404
- `res.conflict(message)` - 409
- `res.internalServerError(message)` - 500

### Custom Error Responses

Use `.errorResponses()` for custom error schemas:

```typescript
createRoute("POST", "/api/todos")
  .body(CreateTodoSchema)
  .response(TodoSchema, { status: 201 })
  .errorResponses({
    409: {
      description: "Todo already exists",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            existingTodo: TodoSchema,
          })
        }
      }
    }
  })
  .handler(({ body, res }) => {
    const existing = findTodoByTitle(body.title)
    if (existing) {
      return res.conflict("Todo already exists")
    }
    return res.created(createTodo(body))
  })
```

### Authentication & Security

```typescript
// Add bearer authentication
createRoute("GET", "/api/protected")
  .security() // Defaults to bearerAuth
  .middlewares(authMiddleware())
  .response(DataSchema)
  .errors([401])
  .handler(({ ctx, res }) => {
    const userId = ctx.userId // Set by auth middleware
    return res.ok(getUserData(userId))
  })

// Custom security schemes
createRoute("GET", "/api/custom")
  .security([{ apiKey: [] }])
  .handler(({ res }) => res.ok({ data: "protected" }))
```

### Middleware

```typescript
import type { MiddlewareFn } from "@bunkit/server"

// Global middleware
const logger: MiddlewareFn = async ({ req, next }) => {
  const start = Date.now()
  const url = new URL(req.url)
  console.log(`→ ${req.method} ${url.pathname}`)
  
  const response = await next()
  
  const duration = Date.now() - start
  console.log(`← ${response.status} (${duration}ms)`)
  return response
}

const server = createServer({
  globalMiddlewares: [logger]
})

// Route-level middleware
const requireAdmin: MiddlewareFn = async ({ ctx, next }) => {
  if (!ctx.isAdmin) {
    return new Response("Forbidden", { status: 403 })
  }
  return next()
}

createRoute("DELETE", "/api/users/:id")
  .middlewares(authMiddleware(), requireAdmin)
  .response(z.object({ success: z.boolean() }))
  .handler(({ params, res }) => {
    deleteUser(params.id)
    return res.ok({ success: true })
  })
```

### CORS Configuration

```typescript
const server = createServer({
  cors: {
    origin: ["http://localhost:5173", "https://app.example.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
    maxAge: 86400, // 24 hours
  }
})
```

### Request Body Size Limit

Protect your server from large payload attacks by setting a maximum request body size:

```typescript
const server = createServer({
  port: 3000,
  maxRequestBodySize: 10 * 1024 * 1024, // 10MB (default)
})
```

The server will reject requests with a body larger than this limit with a 400 Bad Request error. This is checked via the `Content-Length` header before parsing the body, preventing memory exhaustion attacks.

### OpenAPI Generation

```typescript
const server = createServer({
  openapi: {
    title: "My API",
    version: "1.0.0",
    description: "API for managing todos",
    servers: [
      { url: "http://localhost:3000", description: "Development" },
      { url: "https://api.example.com", description: "Production" },
    ],
  }
})

// Get OpenAPI spec
const specResult = await server.http.getOpenApiSpec()
if (specResult.isOk()) {
  console.log(JSON.stringify(specResult.value, null, 2))
}

// Export to file
await server.http.exportOpenApiSpec("./openapi.json")
```

### Route Inspection

Inspect all registered routes at runtime:

```typescript
// Inspect HTTP routes
const httpRoutes = server.http.getRoutes()
if (httpRoutes.isOk()) {
  for (const route of httpRoutes.value) {
    console.log(`${route.method} ${route.path}`)
    console.log(`  Auth: ${route.requiresAuth}`)
    console.log(`  Tags: ${route.tags?.join(", ") ?? "none"}`)
    console.log(`  Has body: ${route.hasRequestBody}`)
    console.log(`  Has query: ${route.hasQueryParams}`)
  }
}
```

## WebSocket Features

### Basic WebSocket Route

```typescript
import { createWebSocketRoute, createTokenAuth } from "@bunkit/server"
import { z } from "zod"

const server = createServer({ port: 3000 })

// Define message schemas
const ChatMessageSchema = z.object({
  roomId: z.string(),
  message: z.string().max(500),
})

const JoinRoomSchema = z.object({
  roomId: z.string(),
})

// Define server -> client message types
type ServerMessage =
  | { type: "room_joined"; roomId: string; userId: string }
  | { type: "message"; roomId: string; message: string; userId: string }
  | { type: "user_left"; roomId: string; userId: string }

// Create WebSocket route
createWebSocketRoute("/ws/chat", server)
  .serverMessages<ServerMessage>() // Type-safe server messages
  .authenticate(createTokenAuth((token) => verifyUser(token)))
  .on("join", JoinRoomSchema, ({ message, ws, user }) => {
    // Subscribe to room topic
    ws.subscribe(`room:${message.data.roomId}`)
    
    // Broadcast join notification
    server.ws.publish(`room:${message.data.roomId}`, {
      type: "room_joined",
      roomId: message.data.roomId,
      userId: user.id,
    })
  })
  .on("chat", ChatMessageSchema, ({ message, ws, user }) => {
    // Broadcast message to room
    server.ws.publish(`room:${message.data.roomId}`, {
      type: "message",
      roomId: message.data.roomId,
      message: message.data.message,
      userId: user.id,
    })
  })
  .onConnect(({ ws, user }) => {
    console.log(`User ${user.id} connected`)
  })
  .onClose(({ ws, user }) => {
    console.log(`User ${user.id} disconnected`)
  })
  .build()

await server.start()
```

### WebSocket Authentication

```typescript
import { 
  createTokenAuth, 
  extractBearerToken,
  extractQueryToken,
  noAuth 
} from "@bunkit/server"

// Bearer token from Authorization header
const bearerAuth = createTokenAuth((token) => {
  const user = verifyJWT(token)
  return user ?? null // Return user object or null
})

// Token from query parameter
const queryAuth = createTokenAuth(
  (token) => verifyJWT(token),
  { strategy: "query", paramName: "token" }
)

// No authentication
const publicRoute = createWebSocketRoute("/ws/public")
  .authenticate(noAuth())
  .on("ping", z.object({}), ({ ws }) => {
    ws.send({ type: "pong" })
  })
  .build()

// Custom token extraction
const customAuth = createTokenAuth(
  async (token, req) => {
    const user = await validateToken(token)
    return user
  },
  { 
    strategy: "custom",
    extractor: (req) => {
      // Extract from custom header
      return req.headers.get("X-API-Token") ?? null
    }
  }
)
```

### Path Parameters in WebSocket

```typescript
createWebSocketRoute("/ws/rooms/:roomId", server)
  .authenticate(bearerAuth)
  .on("message", MessageSchema, ({ message, params, ws }) => {
    // params.roomId is typed as string
    const roomId = params.roomId
    ws.publish(`room:${roomId}`, message.data)
  })
  .build()
```

### Binary Messages

```typescript
createWebSocketRoute("/ws/stream", server)
  .authenticate(bearerAuth)
  .onBinary(({ data, ws, user }) => {
    // Process binary data (Buffer)
    console.log(`Received ${data.length} bytes from ${user.id}`)
    
    // Echo back
    ws.send(data)
    
    // Check backpressure
    if (ws.getBufferedAmount() > 1024 * 1024) {
      console.warn("High backpressure, consider throttling")
    }
  })
  .onDrain(({ ws }) => {
    console.log("Backpressure relieved, resume sending")
  })
  .build()
```

### Broadcasting from Anywhere

```typescript
// Publish from route handlers, middleware, or anywhere in your app
createRoute("POST", "/api/notifications")
  .body(NotificationSchema)
  .response(z.object({ sent: z.boolean() }))
  .handler(({ body, res }) => {
    // Broadcast to all subscribers
    server.ws.publish("notifications", {
      type: "notification",
      title: body.title,
      message: body.message,
    })
    
    return res.ok({ sent: true })
  })

// Binary broadcast
const imageBuffer = await Bun.file("./image.png").arrayBuffer()
server.ws.publishBinary("images", Buffer.from(imageBuffer))
```

### Generate Client Types

Generate TypeScript types for your WebSocket routes:

```typescript
// Export types to a file
await server.ws.exportWebSocketTypes({
  outputPath: "./frontend/src/generated/websocket-types.ts"
})

// Or get types as a string
const typesResult = await server.ws.getWebSocketTypes()
if (typesResult.isOk()) {
  console.log(typesResult.value) // TypeScript type definitions
}
```

Generated types:

```typescript
// Auto-generated file
export type ClientToServerMessages = {
  join: { roomId: string }
  chat: { roomId: string; message: string }
}

export type ServerToClientMessages =
  | { type: "room_joined"; roomId: string; userId: string }
  | { type: "message"; roomId: string; message: string; userId: string }
  | { type: "user_left"; roomId: string; userId: string }
```

Use in your client:

```typescript
import type { 
  ClientToServerMessages,
  ServerToClientMessages 
} from "./generated/websocket-types"

const ws = new WebSocket("ws://localhost:3000/ws/chat")

ws.addEventListener("message", (event) => {
  const message: ServerToClientMessages = JSON.parse(event.data)
  
  // Type-safe message handling
  if (message.type === "room_joined") {
    console.log(`${message.userId} joined room ${message.roomId}`)
  }
})

// Type-safe sending
const send = <T extends keyof ClientToServerMessages>(
  type: T,
  data: ClientToServerMessages[T]
) => {
  ws.send(JSON.stringify({ type, data }))
}

send("join", { roomId: "general" })
send("chat", { roomId: "general", message: "Hello!" })
```

### WebSocket Route Inspection

```typescript
const wsRoutes = server.ws.getRoutes()
if (wsRoutes.isOk()) {
  for (const route of wsRoutes.value) {
    console.log(`WS ${route.path}`)
    console.log(`  Messages: ${route.messageTypes.join(", ")}`)
    console.log(`  Auth: ${route.requiresAuth}`)
    console.log(`  Binary: ${route.hasBinaryHandler}`)
    console.log(`  Lifecycle handlers:`)
    console.log(`    Connect: ${route.hasConnectHandler}`)
    console.log(`    Close: ${route.hasCloseHandler}`)
    console.log(`    Error: ${route.hasErrorHandler}`)
  }
}
```

### WebSocket Configuration

```typescript
const server = createServer({
  port: 3000,
  websocket: {
    maxPayloadLength: 16 * 1024 * 1024, // 16MB (default)
    idleTimeout: 120, // 120 seconds (default)
    compression: true, // per-message deflate (default)
    backpressureLimit: 16 * 1024 * 1024, // 16MB (default)
  }
})
```

## Multi-Server Setup

Run multiple servers with isolated route registries:

```typescript
// Public API server
const publicServer = createServer({ 
  port: 3000,
  cors: { origin: ["*"] },
  openapi: { title: "Public API", version: "1.0.0" }
})

// Admin API server
const adminServer = createServer({ 
  port: 3001,
  cors: { origin: ["https://admin.example.com"] },
  openapi: { title: "Admin API", version: "1.0.0" }
})

// Public routes - only on publicServer
createRoute("GET", "/api/todos", publicServer)
  .response(z.array(TodoSchema))
  .handler(({ res }) => res.ok(getTodos()))

createRoute("POST", "/api/todos", publicServer)
  .body(CreateTodoSchema)
  .response(TodoSchema, { status: 201 })
  .handler(({ body, res }) => res.created(createTodo(body)))

// Admin routes - only on adminServer
createRoute("GET", "/admin/users", adminServer)
  .security()
  .middlewares(adminAuthMiddleware())
  .response(z.array(UserSchema))
  .handler(({ res }) => res.ok(getAllUsers()))

createRoute("DELETE", "/admin/users/:id", adminServer)
  .security()
  .middlewares(adminAuthMiddleware())
  .response(z.object({ deleted: z.boolean() }))
  .handler(({ params, res }) => {
    deleteUser(params.id)
    return res.ok({ deleted: true })
  })

// Start both servers
await Promise.all([
  publicServer.start(),
  adminServer.start()
])

console.log("Public API: http://localhost:3000")
console.log("Admin API: http://localhost:3001")
```

Each server has its own:
- Route registry (HTTP and WebSocket)
- OpenAPI specification
- CORS configuration
- Middleware chain

## Advanced Examples

### File Upload

```typescript
createRoute("POST", "/api/upload")
  .handler(async ({ req, res }) => {
    const formData = await req.formData()
    const file = formData.get("file") as File
    
    if (!file) {
      return res.badRequest("No file uploaded")
    }
    
    const buffer = await file.arrayBuffer()
    await Bun.write(`./uploads/${file.name}`, buffer)
    
    return res.created({ 
      filename: file.name,
      size: file.size,
      type: file.type
    })
  })
```

### Streaming Response

```typescript
createRoute("GET", "/api/stream")
  .handler(({ res }) => {
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < 10; i++) {
          controller.enqueue(`data: ${i}\n\n`)
          await Bun.sleep(1000)
        }
        controller.close()
      }
    })
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }
    })
  })
```

### Static File Serving

```typescript
const server = createServer({
  static: {
    "/": "./public", // Serve ./public/* at /
    "/assets": "./dist/assets", // Serve ./dist/assets/* at /assets
  }
})
```

### Rate Limiting Middleware

```typescript
const rateLimit = (maxRequests: number, windowMs: number): MiddlewareFn => {
  const requests = new Map<string, number[]>()
  
  return async ({ req, next }) => {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const now = Date.now()
    const timestamps = requests.get(ip) ?? []
    
    // Remove old timestamps
    const recent = timestamps.filter(t => now - t < windowMs)
    
    if (recent.length >= maxRequests) {
      return new Response("Too many requests", { status: 429 })
    }
    
    recent.push(now)
    requests.set(ip, recent)
    
    return next()
  }
}

createRoute("POST", "/api/todos")
  .middlewares(rateLimit(10, 60000)) // 10 requests per minute
  .body(CreateTodoSchema)
  .response(TodoSchema, { status: 201 })
  .handler(({ body, res }) => res.created(createTodo(body)))
```

## API Reference

### Server

```typescript
interface ServerOptions {
  port?: number                    // Default: 3000
  host?: string                    // Default: "0.0.0.0"
  development?: boolean            // Default: false
  cors?: CorsOptions              
  static?: Record<string, string>  // URL prefix -> directory path
  globalMiddlewares?: MiddlewareFn[]
  openapi?: {
    title?: string
    version?: string
    description?: string
    servers?: Array<{ url: string; description?: string }>
    securitySchemes?: Record<string, SecurityScheme>
  }
  websocket?: {
    maxPayloadLength?: number      // Default: 16MB
    idleTimeout?: number           // Default: 120s
    compression?: boolean          // Default: true
    backpressureLimit?: number     // Default: 16MB
  }
}

interface Server {
  start(): Promise<Result<void, ServerStartError>>
  stop(): Promise<Result<void, ServerStopError>>
  
  http: {
    getOpenApiSpec(): Promise<Result<OpenApiSpec, Error>>
    exportOpenApiSpec(path: string): Promise<Result<void, Error>>
    getRoutes(): Result<RouteInfo[], Error>
  }
  
  ws: {
    publish(topic: string, message: unknown): void
    publishBinary(topic: string, data: Buffer): void
    getWebSocketTypes(options?: GetWebSocketTypesOptions): Promise<Result<string, Error>>
    exportWebSocketTypes(options: ExportWebSocketTypesOptions): Promise<Result<void, Error>>
    getRoutes(): Result<WebSocketRouteInfo[], Error>
  }
}
```

### Route Builder

```typescript
createRoute(method: HttpMethod, path: string, server?: Server)
  .openapi(metadata: { operationId?, summary?, description?, tags? })
  .security(schemes?: Array<Record<string, string[]>>)
  .middlewares(...fns: MiddlewareFn[])
  .body(schema: ZodSchema)
  .query(schema: ZodSchema)
  .response(schema: ZodSchema, options?: { status?: number })
  .errors(codes: number[])
  .errorResponses(responses: Record<number, ResponseObject>)
  .handler(fn: RouteHandler)
```

### WebSocket Route Builder

```typescript
createWebSocketRoute(path: string, server?: Server)
  .serverMessages<T>()
  .authenticate(authFn: WebSocketAuthFn)
  .on(type: string, schema: ZodSchema, handler: MessageHandler)
  .onBinary(handler: BinaryMessageHandler)
  .onConnect(handler: ConnectHandler)
  .onClose(handler: CloseHandler)
  .onError(handler: ErrorHandler)
  .onDrain(handler: DrainHandler)
  .build()
```

### Response Helpers

The `res` object provides convenient methods for building responses:

```typescript
interface ResponseHelpers {
  // Cookie management (chainable)
  setCookie(name: string, value: string, options?: CookieOptions): this
  setCookie(cookie: Cookie): this
  
  // JSON responses
  ok<T>(data: T): Response                    // 200
  created<T>(data: T): Response               // 201
  noContent(): Response                       // 204
  
  // Error responses
  badRequest(message: string, details?): Response      // 400
  unauthorized(message: string): Response     // 401
  forbidden(message: string): Response        // 403
  notFound(message: string): Response         // 404
  conflict(message: string): Response         // 409
  internalServerError(message: string): Response // 500
}
```

#### Setting Cookies

You can set cookies using the `setCookie()` method, which is chainable:

```typescript
createRoute("POST", "/api/login")
  .body(z.object({ username: z.string(), password: z.string() }))
  .response(z.object({ success: z.boolean() }))
  .handler(({ body, res }) => {
    // Authenticate user...
    const token = generateToken(body.username)
    
    // Set multiple cookies (chainable)
    return res
      .setCookie("session", token, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        maxAge: 3600, // 1 hour in seconds
        path: "/",
      })
      .setCookie("user", body.username, {
        maxAge: 3600,
        path: "/",
      })
      .ok({ success: true })
  })

// Alternative object syntax
createRoute("POST", "/api/logout")
  .response(z.object({ success: z.boolean() }))
  .handler(({ res }) => {
    return res
      .setCookie({
        name: "session",
        value: "",
        options: {
          maxAge: 0, // Delete cookie
          path: "/",
        },
      })
      .ok({ success: true })
  })
```

Cookie options:
- `domain` - Cookie domain
- `path` - Cookie path (default: none)
- `expires` - Expiration date
- `maxAge` - Max age in seconds
- `httpOnly` - HTTP-only flag (recommended for security)
- `secure` - Secure flag (requires HTTPS)
- `sameSite` - SameSite policy: `'Strict'`, `'Lax'`, or `'None'`

### TypeScript Types

All types are exported and fully documented:

```typescript
import type {
  // Server
  Server,
  ServerOptions,
  OpenApiSpec,
  RouteInfo,
  WebSocketRouteInfo,
  
  // HTTP
  RouteContext,
  RouteHandler,
  HttpMethod,
  ExtractParams,
  ResponseHelpers,
  ErrorResponse,
  Cookie,
  CookieOptions,
  
  // WebSocket
  WebSocketContext,
  TypedWebSocket,
  WebSocketAuthFn,
  MessageHandler,
  BinaryMessageHandler,
  ConnectHandler,
  CloseHandler,
  
  // Middleware
  MiddlewareFn,
  MiddlewareArgs,
  
  // CORS
  CorsOptions,
  
  // Errors
  ErrorCode,
  ErrorResponseSchema,
} from "@bunkit/server"
```

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/http/routes.test.ts

# Run with coverage
bun test --coverage
```

## License

MIT
