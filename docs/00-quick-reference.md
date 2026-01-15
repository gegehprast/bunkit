# BunKit Server Package - Quick Reference

Quick reference guide for the `@bunkit/server` package. For complete documentation, see [Server Package Guide](./04-server-package.md).

## Installation

> **Note**: `@bunkit/server` and `@bunkit/result` are internal packages in the BunKit monorepo, not published to npm. They're automatically available through Bun workspaces.

If adding to a new app in the monorepo:

```bash
# Add to your package.json dependencies
{
  "dependencies": {
    "@bunkit/server": "workspace:*",
    "@bunkit/result": "workspace:*",
    "zod": "^4.1.11"
  }
}
```

## Server Setup

```typescript
import { createServer } from "@bunkit/server"

const server = createServer({
  port: 3000,
  host: "0.0.0.0",
  cors: { origin: ["http://localhost:5173"] },
  openapi: {
    title: "My API",
    version: "1.0.0"
  }
})

await server.start()
```

## HTTP Routes

### Basic GET

```typescript
import { createRoute } from "@bunkit/server"
import { z } from "zod"

createRoute("GET", "/api/users/:id")
  .response(UserSchema)
  .handler(({ params, res }) => {
    const user = findUser(params.id)
    return res.ok(user)
  })
```

### POST with Body

```typescript
createRoute("POST", "/api/users")
  .body(z.object({
    email: z.string().email(),
    name: z.string()
  }))
  .response(UserSchema, { status: 201 })
  .handler(async ({ body, res }) => {
    const user = await createUser(body)
    return res.created(user)
  })
```

### With Query Parameters

```typescript
createRoute("GET", "/api/users")
  .query(z.object({
    page: z.string().default("1"),
    limit: z.string().default("10")
  }))
  .response(z.array(UserSchema))
  .handler(({ query, res }) => {
    const users = getUsers({
      page: parseInt(query.page),
      limit: parseInt(query.limit)
    })
    return res.ok(users)
  })
```

### With Authentication

```typescript
createRoute("GET", "/api/profile")
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware)
  .response(UserSchema)
  .handler(({ ctx, res }) => {
    const user = findUser(ctx.userId)
    return res.ok(user)
  })
```

## WebSocket Routes

### Basic WebSocket

```typescript
import { createWebSocketRoute } from "@bunkit/server"

const ServerMsgSchema = z.object({
  type: z.literal("message"),
  content: z.string()
})

createWebSocketRoute("/ws/chat")
  .serverMessages(ServerMsgSchema)
  .on("chat", z.object({ message: z.string() }), (ws, ctx, data) => {
    ws.send({ type: "message", content: data.message })
  })
  .build()
```

### With Authentication

```typescript
import { createTokenAuth } from "@bunkit/server"

const auth = createTokenAuth(async (token: string) => {
  const payload = await verifyJWT(token)
  return payload ? { id: payload.userId } : null
})

createWebSocketRoute("/ws/chat")
  .authenticate(auth)
  .serverMessages(ServerMsgSchema)
  .on("chat", MessageSchema, (ws, ctx, data) => {
    // ctx.user is guaranteed and typed
    ws.publish("global", { type: "message", content: data.message })
  })
  .build()
```

### With Rooms

```typescript
createWebSocketRoute("/ws/rooms/:roomId")
  .on("message", MessageSchema, (ws, ctx, data) => {
    const roomId = ctx.params.roomId
    ws.subscribe(`room:${roomId}`)
    ws.publish(`room:${roomId}`, { type: "message", content: data.message })
  })
  .build()
```

## Response Helpers

```typescript
handler(({ res }) => {
  // Success
  res.ok(data)              // 200
  res.created(data)         // 201
  res.noContent()           // 204
  
  // Errors
  res.badRequest(msg)       // 400
  res.unauthorized(msg)     // 401
  res.forbidden(msg)        // 403
  res.notFound(msg)         // 404
  res.conflict(msg)         // 409
  res.internalError(msg)    // 500
  
  // Custom
  res.custom(data, { status: 418 })
})
```

## Middleware

```typescript
import type { MiddlewareFn } from "@bunkit/server"

const authMiddleware: MiddlewareFn = async (req, ctx, next) => {
  const token = extractToken(req)
  if (!token) {
    return new Response("Unauthorized", { status: 401 })
  }
  
  ctx.userId = verifyToken(token)
  return next()
}

// Use globally
const server = createServer({
  globalMiddlewares: [authMiddleware]
})

// Use per-route
createRoute("GET", "/api/protected")
  .middlewares(authMiddleware)
  .handler(({ ctx, res }) => {
    // ctx.userId is set by middleware
  })
```

## OpenAPI

```typescript
// Generate spec
const specResult = await server.http.getOpenApiSpec()

// Export to file
await server.http.exportOpenApiSpec("./openapi.json")

// With types for frontend
await server.http.exportOpenApiSpec("./openapi.json", {
  types: true,
  output: "./frontend/src/generated"
})
```

## WebSocket Types

```typescript
// Generate types
await server.ws.exportWebSocketTypes({
  output: "./frontend/src/generated/websocket-types.ts"
})
```

## Error Handling

```typescript
import { ok, err, type Result } from "@bunkit/result"

async function getUser(id: string): Promise<Result<User, Error>> {
  const user = await db.findUser(id)
  if (!user) {
    return err(new Error("User not found"))
  }
  return ok(user)
}

// In route handler
createRoute("GET", "/api/users/:id")
  .handler(async ({ params, res }) => {
    const result = await getUser(params.id)
    
    if (result.isErr()) {
      return res.notFound(result.error.message)
    }
    
    return res.ok(result.value)
  })
```

## Common Patterns

### CRUD Operations

```typescript
// List
createRoute("GET", "/api/items")
  .response(z.array(ItemSchema))
  .handler(({ res }) => res.ok(getItems()))

// Get one
createRoute("GET", "/api/items/:id")
  .response(ItemSchema)
  .handler(({ params, res }) => {
    const item = getItem(params.id)
    if (!item) return res.notFound("Item not found")
    return res.ok(item)
  })

// Create
createRoute("POST", "/api/items")
  .body(CreateItemSchema)
  .response(ItemSchema, { status: 201 })
  .handler(async ({ body, res }) => {
    const item = await createItem(body)
    return res.created(item)
  })

// Update
createRoute("PATCH", "/api/items/:id")
  .body(UpdateItemSchema)
  .response(ItemSchema)
  .handler(async ({ params, body, res }) => {
    const item = await updateItem(params.id, body)
    if (!item) return res.notFound("Item not found")
    return res.ok(item)
  })

// Delete
createRoute("DELETE", "/api/items/:id")
  .response(z.object({ message: z.string() }))
  .handler(async ({ params, res }) => {
    await deleteItem(params.id)
    return res.ok({ message: "Deleted" })
  })
```

### Authentication Flow

```typescript
// Register
createRoute("POST", "/api/auth/register")
  .body(RegisterSchema)
  .response(AuthResponseSchema)
  .handler(async ({ body, res }) => {
    const result = await authService.register(body)
    if (result.isErr()) {
      return res.badRequest(result.error.message)
    }
    return res.created(result.value)
  })

// Login
createRoute("POST", "/api/auth/login")
  .body(LoginSchema)
  .response(AuthResponseSchema)
  .handler(async ({ body, res }) => {
    const result = await authService.login(body)
    if (result.isErr()) {
      return res.unauthorized(result.error.message)
    }
    return res.ok(result.value)
  })

// Get profile (protected)
createRoute("GET", "/api/auth/profile")
  .security([{ bearerAuth: [] }])
  .middlewares(authMiddleware)
  .response(UserSchema)
  .handler(({ ctx, res }) => {
    const user = findUser(ctx.userId)
    return res.ok(user)
  })
```

### WebSocket Chat

```typescript
createWebSocketRoute("/ws/chat/:roomId")
  .authenticate(wsAuth)
  .serverMessages(ServerMessageSchema)
  
  .onConnect((ws, ctx) => {
    const roomId = ctx.params.roomId
    ws.subscribe(`room:${roomId}`)
    ws.publish(`room:${roomId}`, {
      type: "user_joined",
      userId: ctx.user.id
    })
  })
  
  .on("message", MessageSchema, (ws, ctx, data) => {
    const roomId = ctx.params.roomId
    ws.publish(`room:${roomId}`, {
      type: "message",
      userId: ctx.user.id,
      content: data.message,
      timestamp: Date.now()
    })
  })
  
  .onClose((ws, ctx) => {
    const roomId = ctx.params.roomId
    ws.publish(`room:${roomId}`, {
      type: "user_left",
      userId: ctx.user.id
    })
  })
  
  .build()
```

## Type Inference

Path parameters are automatically typed:

```typescript
// Single param
createRoute("GET", "/users/:id")
  .handler(({ params }) => {
    params.id // string
  })

// Multiple params
createRoute("GET", "/posts/:postId/comments/:commentId")
  .handler(({ params }) => {
    params.postId    // string
    params.commentId // string
  })
```

Query and body are typed from schemas:

```typescript
const QuerySchema = z.object({
  page: z.string(),
  limit: z.string()
})

const BodySchema = z.object({
  name: z.string(),
  age: z.number()
})

createRoute("POST", "/api/users")
  .query(QuerySchema)
  .body(BodySchema)
  .handler(({ query, body }) => {
    query.page   // string
    query.limit  // string
    body.name    // string
    body.age     // number
  })
```

## Multiple Servers

```typescript
const apiServer = createServer({ port: 3000 })
const adminServer = createServer({ port: 3001 })

// API routes
createRoute("GET", "/api/users", apiServer)
  .handler(({ res }) => res.ok(getUsers()))

// Admin routes
createRoute("GET", "/admin/users", adminServer)
  .handler(({ res }) => res.ok(getAllUsers()))

await apiServer.start()
await adminServer.start()
```

## Useful Links

- [Full Server Documentation](./04-server-package.md)
- [WebSocket Guide](./07-websocket-guide.md)
- [Result Pattern](./05-result-package.md)
- [Examples](../apps/backend/src/routes/)

## Common Issues

### Route Not Found
- Check route is imported in `routes/index.ts`
- Verify path matches exactly (including `/api` prefix)
- Check HTTP method matches

### CORS Errors
- Add origin to `cors.origin` in server config
- Check `CORS_ORIGIN` environment variable
- Ensure credentials match on client and server

### WebSocket Connection Failed
- Check authentication token is valid
- Verify WebSocket URL includes protocol (`ws://` or `wss://`)
- Check firewall/proxy WebSocket support

### Types Not Generated
- Run `bun run backend:openapi:generate:to-frontend`
- Check output path is correct
- Verify OpenAPI metadata is complete

## Support

For more help:
- Check [full documentation](./04-server-package.md)
- Review [example code](../apps/backend/src/routes/)
- See [development workflow](./12-development-workflow.md)
