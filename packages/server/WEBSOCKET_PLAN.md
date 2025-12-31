# WebSocket Implementation Plan

## Overview

Add type-safe WebSocket support to `@bunkit/server` with automatic message validation, connection management, and integration with existing authentication/middleware systems.

## Core Principles

1. **Type Safety** - Full TypeScript inference for messages and handlers
2. **Zod Validation** - Message schemas validated with Zod
3. **Builder Pattern** - Consistent with HTTP route API
4. **Bun Native** - Use `Bun.serve` WebSocket capabilities
5. **Integration** - Share auth/middleware with HTTP routes

## Design Decisions

### 1. Route Definition API

**Decision: Separate WebSocket Routes** ✅

WebSocket routes are completely separate from HTTP routes for clearer separation and simpler understanding.

```typescript
createWebSocketRoute("/api/chat")
  .authenticate(authMiddleware)
  .onConnect((ws, ctx) => {})
  .on("message", MessageSchema, (ws, data, ctx) => {})
  .onClose((ws, code, reason) => {})
```

### 2. Message Handling

**Decision: Multiple Typed Handlers** ✅

Each message type has its own handler with dedicated schema and type inference.

```typescript
const PingSchema = z.object({ timestamp: z.number() })
const ChatSchema = z.object({ text: z.string() })

createWebSocketRoute("/api/chat")
  .on("ping", PingSchema, (ws, data, ctx) => {
    // data is typed as { timestamp: number }
    ws.send({ type: "pong", timestamp: Date.now() })
  })
  .on("chat", ChatSchema, (ws, data, ctx) => {
    // data is typed as { text: string }
    ws.publish("room:general", { type: "message", text: data.text })
  })
```

### 3. Connection State Management

**Per-Connection State:**
```typescript
interface WebSocketContext<TUser = unknown> {
  connectionId: string
  connectedAt: Date
  user?: TUser  // From auth middleware
  data: Map<string, unknown>  // Custom state
}

createWebSocketRoute("/api/chat")
  .authenticate(authMiddleware)  // Sets ctx.user
  .onConnect((ws, ctx) => {
    ctx.data.set("room", "general")
  })
```

### 4. Room/Channel Management

**Decision: Use Bun's Native Pub/Sub** ✅

No built-in room manager. Use Bun's native `subscribe`/`publish` for topics.

```typescript
createWebSocketRoute("/api/chat")
  .onConnect((ws, ctx) => {
    // Subscribe to topics using Bun's native pub/sub
    ws.subscribe("room:general")
    ws.subscribe(`user:${ctx.user.id}`)
  })
  .on("message", MessageSchema, (ws, data, ctx) => {
    // Publish to all subscribers of a topic
    ws.publish("room:general", {
      type: "message",
      text: data.text,
      user: ctx.user.name,
    })
  })
```

Users can build their own room managers on top if needed.

### 5. Authentication

**Decision: Reuse HTTP Middleware** ✅

Authentication works the same as HTTP routes.

**Bearer Token Example:**
```typescript
createWebSocketRoute("/api/chat")
  .authenticate(authMiddleware)  // Checks token on upgrade
  .onConnect((ws, ctx) => {
    console.log("User connected:", ctx.user)
  })
```

**Query Parameter Token:**
```typescript
createWebSocketRoute("/api/chat")
  .authenticate((req, ctx) => {
    const token = new URL(req.url).searchParams.get("token")
    // Validate token, set ctx.user
  })
```

### 6. Error Handling

**Decision: Validation + Handler Errors** ✅

```typescript
createWebSocketRoute("/api/chat")
  .on("chat", ChatSchema, (ws, data, ctx) => {
    // Validated message - schema already checked
  })
  .onError((ws, error, ctx) => {
    // Handle validation and handler errors
    ws.send({ type: "error", message: error.message })
  })
```

**Error Handling Strategy:**
- Invalid upgrade request → Reject with HTTP error (before WebSocket upgrade)
- Validation failure → Send error message via `onError`, optionally close
- Handler exception → Log, send error via `onError`, close connection

## Proposed API

### Basic Example

```typescript
import { createWebSocketRoute } from "@bunkit/server"
import { z } from "zod"

// Define message schemas
const ChatMessageSchema = z.object({
  text: z.string().min(1).max(500),
  room: z.string().optional(),
})

const PingSchema = z.object({
  timestamp: z.number(),
})

// Define server messages for type safety
type ServerMessage =
  | { type: "message", user: string, text: string }
  | { type: "pong", timestamp: number }
  | { type: "error", message: string }

// Create WebSocket route
createWebSocketRoute("/api/chat")
  .serverMessages<ServerMessage>()  // ✅ Enforce type safety on send/publish
  .authenticate(authMiddleware)
  .onConnect(async (ws, ctx) => {
    console.log(`User ${ctx.user.id} connected`)
    ws.data.room = "general"
  })
  .on("chat", ChatMessageSchema, async (ws, data, ctx) => {
    // Type-safe: data is inferred as { text: string, room?: string }
    const room = data.room ?? ws.data.room
    await saveMessage(ctx.user.id, data.text, room)
    
    // Broadcast to all connections
    ws.publish(room, {
      type: "message",
      user: ctx.user.name,
      text: data.text,
    })
  })
  .on("ping", PingSchema, (ws, data, ctx) => {
    ws.send({ type: "pong", timestamp: Date.now() })
  })
  .onClose((ws, code, reason, ctx) => {
    console.log(`User ${ctx.user.id} disconnected`)
  })
  .onError((ws, error, ctx) => {
    console.error("WebSocket error:", error)
  })
```

### Binary Messages

```typescript
import { z } from "zod"

createWebSocketRoute("/stream")
  .onConnect((ws, ctx) => {
    console.log("Stream connection established")
  })
  // Handle JSON messages
  .on("command", CommandSchema, (ws, data, ctx) => {
    console.log("Received command:", data.type)
  })
  // Handle binary data
  .onBinary((ws, buffer, ctx) => {
    console.log(`Received ${buffer.byteLength} bytes`)
    // Process binary data (images, video, etc.)
    processBuffer(buffer)
  })
```

### Backpressure Handling

```typescript
import { z } from "zod"

const UpdateSchema = z.object({ value: z.number() })

createWebSocketRoute("/live-data")
  .on("subscribe", SubscribeSchema, async (ws, data, ctx) => {
    // Check backpressure before sending large amounts of data
    const sendUpdate = (update: unknown) => {
      const buffered = ws.getBufferedAmount()
      
      // Skip update if buffer is too full (drop strategy)
      if (buffered > 1024 * 1024) { // 1MB threshold
        console.warn(`Skipping update, buffer: ${buffered} bytes`)
        return
      }
      
      ws.send({ type: "update", data: update })
    }
    
    // Use in interval/stream
    const interval = setInterval(() => {
      const update = getLatestData()
      sendUpdate(update)
    }, 100)
    
    ctx.data.set("interval", interval)
  })
  .onClose((ws, code, reason, ctx) => {
    const interval = ctx.data.get("interval") as NodeJS.Timeout
    clearInterval(interval)
  })
```

### Advanced: Full Type Safety (Send + Receive)

```typescript
import { z } from "zod"

// Define schemas for incoming messages
const ChatSchema = z.object({ text: z.string(), room: z.string().optional() })
const PingSchema = z.object({ timestamp: z.number() })
const JoinSchema = z.object({ room: z.string() })

// Define all possible client -> server messages (optional, for documentation)
type ClientMessage =
  | { type: "chat", data: { text: string, room?: string } }
  | { type: "ping", data: { timestamp: number } }
  | { type: "join", data: { room: string } }

// Define all possible server -> client messages
type ServerMessage =
  | { type: "message", user: string, text: string, room: string }
  | { type: "pong", timestamp: number }
  | { type: "joined", room: string, userCount: number }
  | { type: "error", message: string, code?: string }

createWebSocketRoute("/api/chat")
  .clientMessages<ClientMessage>()   // Optional: document client message contract
  .serverMessages<ServerMessage>()   // Required: type-safe outgoing messages
  .authenticate(authMiddleware)
  .on("chat", ChatSchema, (ws, data, ctx) => {
    const room = data.room ?? "general"
    
    // ✅ Type-safe - matches ServerMessage
    ws.publish(`room:${room}`, {
      type: "message",
      user: ctx.user.name,
      text: data.text,
      room,
    })
    
    // ❌ TypeScript error - "invalid" not in ServerMessage union
    ws.send({ type: "invalid", foo: "bar" })
    
    // ❌ TypeScript error - missing required field "room"
    ws.send({ type: "message", user: ctx.user.name, text: data.text })
  })
  .on("ping", PingSchema, (ws, data) => {
    // ✅ Type-safe
    ws.send({ type: "pong", timestamp: Date.now() })
  })
  .on("join", JoinSchema, (ws, data, ctx) => {
    ws.subscribe(`room:${data.room}`)
    
    // ✅ Type-safe
    ws.send({
      type: "joined",
      room: data.room,
      userCount: getRoomUserCount(data.room),
    })
  })
```

## Client Type Generation

**Auto-generate TypeScript types for client applications.**

### Generate Types Command

```typescript
// Server setup
import { createServer } from "@bunkit/server"
import "./routes/chat.websocket"  // Register routes

const server = createServer({ port: 3000 })

// Generate types for clients
await server.generateWebSocketTypes({
  outputPath: "./client/websocket-types.ts",
  // Optional: only generate for specific routes
  routes: ["/api/chat", "/api/notifications"],
})

await server.start()
```

### Generated Output

```typescript
// client/websocket-types.ts (auto-generated)

/**
 * WebSocket route: /api/chat
 * Generated from: routes/chat.websocket.ts
 */
export namespace ChatWebSocket {
  // Client -> Server messages
  export type ClientMessage =
    | { type: "chat", data: { text: string, room?: string } }
    | { type: "ping", data: { timestamp: number } }
    | { type: "join", data: { room: string } }
  
  // Server -> Client messages
  export type ServerMessage =
    | { type: "message", user: string, text: string, room: string }
    | { type: "pong", timestamp: number }
    | { type: "joined", room: string, userCount: number }
    | { type: "error", message: string, code?: string }
}

/**
 * WebSocket route: /api/notifications
 * Generated from: routes/notifications.websocket.ts
 */
export namespace NotificationsWebSocket {
  export type ClientMessage =
    | { type: "markRead", data: { id: string } }
  
  export type ServerMessage =
    | { type: "notification", id: string, title: string, body: string }
    | { type: "read", id: string }
}
```

### Client Usage

```typescript
// client/chat.ts
import type { ChatWebSocket } from "./websocket-types"

const ws = new WebSocket("ws://localhost:3000/api/chat?token=xxx")

// ✅ Type-safe send
const sendMessage = (text: string) => {
  const message: ChatWebSocket.ClientMessage = {
    type: "chat",
    data: { text, room: "general" },
  }
  ws.send(JSON.stringify(message))
}

// ✅ Type-safe receive with discriminated union
ws.onmessage = (event) => {
  const message = JSON.parse(event.data) as ChatWebSocket.ServerMessage
  
  // TypeScript narrows the type based on .type
  if (message.type === "message") {
    console.log(`${message.user}: ${message.text} in ${message.room}`)
  } else if (message.type === "pong") {
    console.log(`Latency: ${Date.now() - message.timestamp}ms`)
  } else if (message.type === "joined") {
    console.log(`Joined ${message.room} with ${message.userCount} users`)
  }
}
```

### Integration with Build Process

```json
// package.json
{
  "scripts": {
    "dev": "bun run generate:types && bun run --hot src/main.ts",
    "generate:types": "bun run scripts/generate-websocket-types.ts",
    "build": "bun run generate:types && bun build src/main.ts"
  }
}
```

```typescript
// scripts/generate-websocket-types.ts
import { createServer } from "@bunkit/server"
import "../src/routes/chat.websocket"
import "../src/routes/notifications.websocket"

const server = createServer({ port: 3000 })

await server.generateWebSocketTypes({
  outputPath: "./client/websocket-types.ts",
})

console.log("✅ WebSocket types generated")
process.exit(0)
```

### Type Generation Details

**What gets generated:**
- TypeScript types for all client -> server messages (from `.on()` schemas)
- TypeScript types for all server -> client messages (from `.serverMessages<T>()`)
- Namespaced by route path to avoid conflicts
- JSDoc comments with route path and source file
- Discriminated unions for easy type narrowing

**Benefits:**
- ✅ Type safety across server/client boundary
- ✅ Auto-completion in client code
- ✅ Catch mismatches at compile time
- ✅ Single source of truth (server defines contracts)
- ✅ Works with any TypeScript client (React, Vue, Svelte, React Native, etc.)

## Implementation Structure

```
src/
├── websocket.ts                    # Main WebSocket exports
├── websocket-route-builder.ts     # WebSocket route builder
├── websocket-registry.ts           # WebSocket route registry
├── websocket-handler.ts            # Connection/message handling
├── websocket-context.ts            # Connection context type
├── websocket-type-generator.ts    # Client type generation
└── types/
    └── websocket.ts                # WebSocket types
```

## Type System

```typescript
// Core WebSocket context
interface WebSocketContext<TUser = unknown> {
  connectionId: string
  connectedAt: Date
  user?: TUser
  data: Map<string, unknown>
}

// Enhanced WebSocket with context and type-safe messaging
interface TypedWebSocket<TServerMsg = unknown> extends ServerWebSocket {
  data: WebSocketContext
  send(message: TServerMsg): void              // ✅ Type-safe send
  publish(topic: string, message: TServerMsg): void  // ✅ Type-safe publish
  getBufferedAmount(): number                  // Backpressure monitoring
}

// Message handler type
type MessageHandler<TData, TUser = unknown, TServerMsg = unknown> = (
  ws: TypedWebSocket<TServerMsg>,
  data: TData,
  ctx: WebSocketContext<TUser>,
) => Promise<void> | void

// Lifecycle handlers
type ConnectHandler<TUser = unknown> = (
  ws: TypedWebSocket,
  ctx: WebSocketContext<TUser>,
) => Promise<void> | void

type CloseHandler<TUser = unknown> = (
  ws: TypedWebSocket,
  code: number,
  reason: string,
  ctx: WebSocketContext<TUser>,
) => Promise<void> | void
```

**Type Safety Methods:**

| Method | Purpose | Required? |
|--------|---------|----------|
| `.clientMessages<T>()` | Document client message contract, used for type generation | Optional |
| `.serverMessages<T>()` | Enforce type safety on `ws.send()` and `ws.publish()` | Required |

## Integration with HTTP Server

**Architecture: Single Bun.serve Instance**

HTTP and WebSocket routes are served from the **same** `Bun.serve()` instance:

```typescript
// Internally, the server uses a single Bun.serve:
Bun.serve({
  port: 3000,
  
  // Handle HTTP requests AND WebSocket upgrades
  fetch(req, server) {
    // Check if it's a WebSocket upgrade request
    const wsRoute = findWebSocketRoute(req.url)
    if (wsRoute && req.headers.get("upgrade") === "websocket") {
      // Upgrade to WebSocket
      if (server.upgrade(req, { data: { route: wsRoute } })) {
        return  // WebSocket connection established
      }
      return new Response("WebSocket upgrade failed", { status: 400 })
    }
    
    // Otherwise handle as HTTP request
    return handleHTTPRequest(req)
  },
  
  // WebSocket handlers
  websocket: {
    open(ws) { /* connection opened */ },
    message(ws, message) { /* dispatch to route handler */ },
    close(ws, code, reason) { /* connection closed */ },
  }
})
```

**Benefits:**
- ✅ **Same port** - HTTP and WebSocket on same port (e.g., `http://localhost:3000` + `ws://localhost:3000`)
- ✅ **Same origin** - No CORS issues between HTTP and WebSocket
- ✅ **Shared resources** - Same server instance, memory, auth system
- ✅ **Simple deployment** - One process handles everything

**Server Options:**
```typescript
interface ServerOptions {
  // ... existing HTTP options
  websocket?: {
    maxPayloadLength?: number      // Default: 16MB
    idleTimeout?: number            // Default: 120s
    compression?: boolean           // Default: true (perMessageDeflate)
    backpressureLimit?: number      // Default: 16MB
  }
}

const server = createServer({
  port: 3000,
  websocket: {
    maxPayloadLength: 1024 * 1024,  // 1MB
    idleTimeout: 120,                // 2 minutes
    compression: true,               // Enable compression (default)
  }
})
```

**Route Registration:**
```typescript
// HTTP routes
import './routes/api.routes'

// WebSocket routes
import './routes/chat.websocket'

// Server automatically handles both
await server.start()
```

## Message Protocol

**Standardized Message Format:**
```typescript
// Client -> Server
{
  type: string,      // Message type/event name
  data: unknown,     // Payload (validated by schema)
  id?: string,       // Optional request ID for RPC pattern
}

// Server -> Client
{
  type: string,
  data: unknown,
  id?: string,       // Echo request ID for responses
  error?: string,    // Error message if validation failed
}
```

**Example:**
```typescript
// Client sends
{ type: "chat", data: { text: "Hello!" } }

// Server validates, processes, broadcasts
{ type: "message", data: { user: "John", text: "Hello!" } }

// Validation error
{ type: "error", error: "Invalid message: text is required" }
```

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)
- WebSocket route builder with `.on()` pattern
- Route registry for WebSocket
- Basic connection handling (connect, message, close, error)
- Message dispatch system

### Phase 2: Validation & Type Safety (MVP)
- Zod schema validation for messages
- Type inference for handlers (client messages)
- `.serverMessages<T>()` for type-safe send/publish
- Error handling for validation failures
- Standardized error messages

### Phase 2.5: Client Type Generation (MVP)
- Extract message types from registered routes
- Generate TypeScript types file
- CLI command or server method for generation
- Watch mode for development

### Phase 3: Authentication & Context (MVP)
- Auth middleware support (reuse HTTP middleware)
- Connection context management
- User identification
- Path parameter extraction (like `/chat/:room`)

### Phase 4: External Broadcasting
- Server.publish() for topic-based messaging
- WebSocketRegistry for connection iteration/filtering
- Examples of background task integration

### Phase 5: Advanced Features (Post-MVP)
- Binary message support with `.onBinary(handler)`
- Compression configuration (enabled by default)
- Rate limiting per connection
- Heartbeat/ping-pong automatic
- Backpressure utilities and documentation

### Phase 6: Multi-Server Support (Future)
- Redis pub/sub adapter for horizontal scaling
- Shared state across server instances

## Broadcasting from Outside Routes

**Use Case:** Background jobs, scheduled tasks, or services that need to push updates to connected clients.

We provide two main mechanisms:

### Server-Level Publish

```typescript
// main.ts
const server = createServer({
  port: 3000,
})

// WebSocket route subscribes to topics
createWebSocketRoute("/notifications")
  .authenticate(authMiddleware)
  .onConnect((ws, ctx) => {
    ws.subscribe(`user:${ctx.user.id}`)
  })

await server.start()

// Later, from a background service
import { server } from './main'

// Background job
setInterval(async () => {
  const notifications = await checkNewNotifications()
  
  for (const notif of notifications) {
    // Publish to specific user's topic
    server.publish(`user:${notif.userId}`, {
      type: "notification",
      data: notif,
    })
  }
}, 5000)
```

### Global WebSocket Registry

```typescript
// Background service can access all connections
import { webSocketRegistry } from "@bunkit/server"

setInterval(async () => {
  const systemStatus = await getSystemStatus()
  
  // Broadcast to all connections
  webSocketRegistry.broadcast({
    type: "system_status",
    data: systemStatus,
  })
  
  // Or filter connections
  const adminConnections = webSocketRegistry.filter(
    (ws) => ws.data.user?.role === "admin"
  )
  
  for (const ws of adminConnections) {
    ws.send({
      type: "admin_alert",
      data: { message: "System maintenance in 5 minutes" },
    })
  }
}, 10000)
```

This gives flexibility:
- Use `server.publish(topic, data)` for pub/sub (most common)
- Use `webSocketRegistry` when you need to filter/iterate connections

### Implementation

```typescript
// Server exposes publish method
interface Server {
  // ... existing methods
  publish(topic: string, message: unknown): void
  publishBinary(topic: string, data: Buffer): void
}

// WebSocket registry for advanced use cases
interface WebSocketRegistry {
  getAll(): ServerWebSocket[]
  filter(predicate: (ws: ServerWebSocket) => boolean): ServerWebSocket[]
  broadcast(message: unknown): void
  broadcastBinary(data: Buffer): void
}

// Usage in background service
import { server, webSocketRegistry } from '@/server-instance'

async function backgroundTask() {
  const updates = await fetchUpdates()
  
  // Pub/sub approach (recommended)
  for (const update of updates) {
    server.publish(`topic:${update.category}`, {
      type: "update",
      data: update,
    })
  }
  
  // Direct approach when you need filtering
  const premiumUsers = webSocketRegistry.filter(
    ws => ws.data.user?.isPremium
  )
  
  for (const ws of premiumUsers) {
    ws.send({ type: "premium_feature", data: someData })
  }
}
```

## Decisions

### 1. State Management
**Decision:** Leave it to users to implement.
- Framework won't include built-in Redis/multi-server support
- Users can implement their own pub/sub adapters if needed
- Keeps the core simple and flexible

### 2. Compression
**Decision:** Enable by default, make it configurable.
- `perMessageDeflate: true` by default in Bun.serve
- Users can disable via server options: `compression: false`
- Reduces bandwidth for text-heavy messages

### 3. Binary Messages
**Decision:** Support Buffer messages with different handlers.
- `.on(type, schema, handler)` for JSON/text messages
- `.onBinary(handler)` for raw Buffer messages
- Both can coexist in the same route

### 4. Backpressure Handling
**Decision:** Expose tools, let users handle it.
- Expose `ws.getBufferedAmount()` for checking queue size
- Document backpressure patterns in examples
- No automatic buffering/dropping - users decide the strategy

## Example Use Cases

### Real-time Chat
```typescript
createWebSocketRoute("/chat/:room")
  .authenticate(authMiddleware)
  .onConnect((ws, ctx) => {
    ws.subscribe(`room:${ctx.params.room}`)
  })
  .on("message", MessageSchema, (ws, data, ctx) => {
    ws.publish(`room:${ctx.params.room}`, {
      type: "message",
      user: ctx.user.name,
      text: data.text,
    })
  })
```

### Live Updates/Notifications
```typescript
createWebSocketRoute("/notifications")
  .authenticate(authMiddleware)
  .onConnect((ws, ctx) => {
    ws.subscribe(`user:${ctx.user.id}`)
  })
  .on("markRead", MarkReadSchema, async (ws, data, ctx) => {
    await markNotificationRead(data.id)
  })
```

### Collaborative Editing
```typescript
createWebSocketRoute("/document/:docId")
  .authenticate(authMiddleware)
  .onConnect(async (ws, ctx) => {
    const doc = await getDocument(ctx.params.docId)
    ws.send({ type: "init", content: doc.content })
    ws.subscribe(`doc:${ctx.params.docId}`)
  })
  .on("edit", EditSchema, (ws, data, ctx) => {
    ws.publish(`doc:${ctx.params.docId}`, {
      type: "edit",
      userId: ctx.user.id,
      changes: data.changes,
    })
  })
```

## Migration Path

1. **Non-breaking Addition** - WebSocket routes are completely separate
2. **Opt-in** - Users don't need to use WebSocket if they don't need it
3. **Gradual Adoption** - Can add WebSocket routes alongside existing HTTP routes
4. **Shared Infrastructure** - Reuse auth, middleware, error handling patterns

## Next Steps

1. Review and discuss this plan
2. Decide on API design choices (Option A vs B for each decision point)
3. Start with Phase 1 implementation
4. Create examples and tests
5. Document best practices

## Design Decisions Summary

1. **Route API:** Separate WebSocket Routes (not HTTP upgrade) ✅
2. **Server Instance:** Same `Bun.serve()` for HTTP + WebSocket ✅
3. **Message Handling:** Multiple Typed Handlers (`.on(type, schema, handler)`) ✅
4. **Type Safety:** `.serverMessages<T>()` for send/publish, `.clientMessages<T>()` optional ✅
5. **Client Types:** Auto-generate TypeScript types file ✅
6. **Rooms/Channels:** Bun's native subscribe/publish (no built-in manager) ✅
7. **Broadcasting:** `server.publish()` + `webSocketRegistry` for filtering ✅
8. **State Management:** Users implement their own (no built-in Redis) ✅
9. **Compression:** Enabled by default, configurable ✅
10. **Binary Messages:** Support with separate `.onBinary(handler)` ✅
11. **Backpressure:** Expose `getBufferedAmount()`, document patterns ✅
12. **AsyncAPI Generation:** Skip for now ✅

## Next Steps

1. ✅ **Plan Complete** - All design decisions made
2. 🚀 **Ready to Implement** - Start with Phase 1 (Core Infrastructure)
3. 📝 **Implementation Order:**
   - ✅ Phase 1: Core Infrastructure (route builder, registry, handlers)
   - ✅ Phase 2: Validation & Type Safety (Zod + `.serverMessages<T>()`)
   - ✅ Phase 2.5: Client Type Generation (auto-generate types)
   - ✅ Phase 3: Authentication & Context (reuse HTTP middleware)
   - Phase 4: External Broadcasting (server.publish, registry)
   - Phase 5: Advanced Features (binary, compression, backpressure)
4. 🧪 **Create tests** alongside each phase
5. 📚 **Document patterns** (especially type generation and backpressure)
6. 🎯 **Example apps** showing client/server type safety in action

---

## Phase 3 Implementation Notes: Authentication & Context

### Authentication Utilities

Phase 3 adds authentication helpers in `websocket-auth.ts`:

```typescript
import {
  extractBearerToken,   // Extract Bearer token from Authorization header
  extractQueryToken,    // Extract token from URL query parameter
  extractToken,         // Combined: checks header first, then query
  createTokenAuth,      // Create auth function from token verifier
  noAuth,               // No auth (public endpoints)
  extractRequestInfo,   // Extract IP, origin, user-agent
} from "@bunkit/server"
```

### Token Extraction Patterns

**Bearer Token (Header)**
```typescript
// Client sends: ws://localhost:3000/chat
// Headers: Authorization: Bearer <token>

const wsAuth = createTokenAuth(async (token) => {
  const payload = await verifyJWT(token)
  return { id: payload.sub, email: payload.email }
})

createWebSocketRoute("/api/chat")
  .authenticate(wsAuth)
  .onConnect((ws, ctx) => {
    console.log(`User ${ctx.user?.id} connected`)
  })
  .build()
```

**Query Parameter Token (WebSocket clients that can't set headers)**
```typescript
// Client sends: ws://localhost:3000/chat?token=<token>

const wsAuth = createTokenAuth(
  async (token) => {
    const payload = await verifyJWT(token)
    return { id: payload.sub }
  },
  { checkHeader: false, queryParamName: "token" }
)

createWebSocketRoute("/api/chat")
  .authenticate(wsAuth)
  .build()
```

**Both Header and Query (recommended for flexibility)**
```typescript
// Tries header first, falls back to query param
const wsAuth = createTokenAuth(
  verifyToken,
  { checkHeader: true, checkQuery: true }
)
```

### Custom Authentication

**Direct auth function (for custom logic)**
```typescript
createWebSocketRoute("/api/admin")
  .authenticate(async (req: Request) => {
    // Extract token from any source
    const token = extractBearerToken(req) || extractQueryToken(req, "auth")
    if (!token) return null
    
    // Verify and return user data
    const user = await verifyAndGetUser(token)
    if (!user || user.role !== "admin") return null
    
    return user  // Type flows to ctx.user in handlers
  })
  .build()
```

**Using request metadata (public endpoints)**
```typescript
createWebSocketRoute("/public/stream")
  .authenticate(extractRequestInfo())
  .onConnect((ws, ctx) => {
    // ctx.user has: { ip, origin, userAgent }
    console.log(`Connection from ${ctx.user?.ip}`)
  })
  .build()
```

### Path Parameters

Path parameters work like HTTP routes:

```typescript
createWebSocketRoute("/api/rooms/:roomId/chat/:chatId")
  .onConnect((ws, ctx) => {
    // ctx.params contains extracted values
    console.log(`Room: ${ctx.params.roomId}, Chat: ${ctx.params.chatId}`)
    ws.subscribe(`room:${ctx.params.roomId}`)
  })
  .build()
```

### WebSocket Context

Every handler receives a `WebSocketContext`:

```typescript
interface WebSocketContext<TUser = unknown> {
  connectionId: string              // Unique ID for this connection
  connectedAt: Date                 // When connection was established
  user?: TUser                      // User from auth function
  params: Record<string, string>    // Path parameters
  data: Map<string, unknown>        // Custom connection state
}
```

**Using connection state:**
```typescript
createWebSocketRoute("/api/chat")
  .authenticate(wsAuth)
  .onConnect((ws, ctx) => {
    ctx.data.set("lastActivity", Date.now())
    ctx.data.set("messageCount", 0)
  })
  .on("chat", ChatSchema, (ws, data, ctx) => {
    ctx.data.set("lastActivity", Date.now())
    const count = (ctx.data.get("messageCount") as number) + 1
    ctx.data.set("messageCount", count)
  })
  .onClose((ws, code, reason, ctx) => {
    console.log(`User sent ${ctx.data.get("messageCount")} messages`)
  })
  .build()
```

### Auth Rejection Behavior

When auth returns `null`, `undefined`, or throws, the upgrade is rejected:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"message":"Unauthorized","code":"UNAUTHORIZED"}
```

When auth function throws:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"message":"Authentication failed","code":"AUTH_ERROR"}
```

### Integration with HTTP Auth

Reuse existing JWT verification:

```typescript
// Shared auth service
import { verifyToken } from "@/auth/auth.service"

// HTTP middleware
export function authMiddleware(): MiddlewareFn {
  return async ({ req, ctx, next }) => {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ message: "No token" }), { status: 401 })
    }
    const result = await verifyToken(authHeader.slice(7))
    if (result.isErr()) {
      return new Response(JSON.stringify({ message: "Invalid token" }), { status: 401 })
    }
    ctx.userId = result.value.userId
    return next()
  }
}

// WebSocket auth (reuses verifyToken)
export const wsAuth = createTokenAuth(async (token) => {
  const result = await verifyToken(token)
  return result.isOk() ? { id: result.value.userId, email: result.value.email } : null
})
```

### Type Safety

User types flow through the entire handler chain:

```typescript
interface User {
  id: string
  role: "admin" | "user"
}

createWebSocketRoute("/api/admin")
  .authenticate((req): User | null => {
    // Return strongly typed user
    return { id: "123", role: "admin" }
  })
  .onConnect((ws, ctx) => {
    // ctx.user is User | undefined
    if (ctx.user?.role === "admin") {
      ws.subscribe("admin-channel")
    }
  })
  .on("command", CommandSchema, (ws, data, ctx) => {
    // ctx.user is still User | undefined
    if (ctx.user?.role !== "admin") {
      ws.close(4003, "Admin only")
      return
    }
    // Handle admin command
  })
  .build()
```

