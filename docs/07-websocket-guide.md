# WebSocket Development Guide

Complete guide to building real-time features with type-safe WebSockets in BunKit.

## Overview

BunKit's WebSocket implementation provides:
- **Type-Safe Messages** - Full TypeScript inference for client and server messages
- **Automatic Validation** - Schema validation with Zod
- **Authentication** - Flexible auth with token extraction
- **Pub/Sub** - Built-in topic subscription and broadcasting
- **Type Generation** - Auto-generate types for client applications
- **Error Handling** - Graceful error handling with fallbacks

## Quick Start

### Basic WebSocket Route

```typescript
import { createWebSocketRoute } from "@bunkit/server"
import { z } from "zod"

// Define message schemas
const ClientMessageSchema = z.object({
  message: z.string()
})

const ServerMessageSchema = z.object({
  type: z.literal("message"),
  content: z.string(),
  timestamp: z.number()
})

// Create route
createWebSocketRoute("/ws/echo")
  .serverMessages(ServerMessageSchema)
  .on("echo", ClientMessageSchema, (ws, ctx, data) => {
    ws.send({
      type: "message",
      content: data.message,
      timestamp: Date.now()
    })
  })
  .build()
```

### With Authentication

```typescript
import { createWebSocketRoute, createTokenAuth } from "@bunkit/server"

const wsAuth = createTokenAuth(async (token: string) => {
  const result = await verifyJWT(token)
  if (result.isErr()) return null
  
  return {
    id: result.value.userId,
    email: result.value.email
  }
})

createWebSocketRoute("/ws/chat")
  .authenticate(wsAuth)
  .serverMessages(ServerMessageSchema)
  .on("message", MessageSchema, (ws, ctx, data) => {
    // ctx.user is guaranteed to exist and typed
    console.log(`Message from ${ctx.user.email}`)
  })
  .build()
```

## Message Schemas

### Client Messages

Define messages sent from client to server:

```typescript
// Simple message
const PingSchema = z.object({
  timestamp: z.number()
})

// Multiple message types
const JoinRoomSchema = z.object({
  roomId: z.string().min(1)
})

const LeaveRoomSchema = z.object({
  roomId: z.string().min(1)
})

const ChatMessageSchema = z.object({
  roomId: z.string(),
  message: z.string().min(1).max(1000)
})

// Register handlers
createWebSocketRoute("/ws/chat")
  .on("ping", PingSchema, (ws, ctx, data) => {
    ws.send({ type: "pong", timestamp: data.timestamp })
  })
  .on("join_room", JoinRoomSchema, (ws, ctx, data) => {
    ws.subscribe(`room:${data.roomId}`)
  })
  .on("leave_room", LeaveRoomSchema, (ws, ctx, data) => {
    ws.unsubscribe(`room:${data.roomId}`)
  })
  .on("chat_message", ChatMessageSchema, (ws, ctx, data) => {
    ws.publish(`room:${data.roomId}`, {
      type: "message",
      content: data.message
    })
  })
  .build()
```

### Server Messages

Define messages sent from server to client:

```typescript
// Discriminated union for type-safe messages
const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    userId: z.string(),
    content: z.string(),
    timestamp: z.number()
  }),
  z.object({
    type: z.literal("user_joined"),
    userId: z.string(),
    userName: z.string()
  }),
  z.object({
    type: z.literal("user_left"),
    userId: z.string()
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    code: z.string().optional()
  })
])

createWebSocketRoute("/ws/chat")
  .serverMessages(ServerMessageSchema)
  .onConnect((ws, ctx) => {
    // Send typed message
    ws.publish("chat", {
      type: "user_joined",
      userId: ctx.user.id,
      userName: ctx.user.name
    })
  })
  .build()
```

## Authentication

### Token Authentication

Extract and verify JWT tokens:

```typescript
import { createTokenAuth } from "@bunkit/server"

// Create auth function
const wsAuth = createTokenAuth(async (token: string) => {
  // Verify token
  const payload = await verifyJWT(token)
  if (!payload) return null
  
  // Return user data
  return {
    id: payload.userId,
    email: payload.email,
    role: payload.role
  }
})

// Use in route
createWebSocketRoute("/ws/protected")
  .authenticate(wsAuth)
  .on("message", MessageSchema, (ws, ctx, data) => {
    // ctx.user is typed and guaranteed
    console.log(ctx.user.id, ctx.user.email)
  })
  .build()
```

### Token Extraction Modes

```typescript
// From query parameter (default: ?token=...)
const auth1 = createTokenAuth(verifyFn)

// From Authorization header (Bearer token)
const auth2 = createTokenAuth(verifyFn, {
  mode: "header"
})

// From cookie
const auth3 = createTokenAuth(verifyFn, {
  mode: "cookie",
  cookieName: "auth_token"
})

// Custom extraction
const auth4 = createTokenAuth(verifyFn, {
  mode: "custom",
  extract: (req: Request) => {
    // Extract token from custom header
    return req.headers.get("x-auth-token")
  }
})
```

### No Authentication

For public WebSocket endpoints:

```typescript
import { noAuth } from "@bunkit/server"

createWebSocketRoute("/ws/public")
  .authenticate(noAuth)
  .on("message", MessageSchema, (ws, ctx, data) => {
    // ctx.user is undefined
  })
  .build()
```

## Lifecycle Handlers

### onConnect

Called when connection is established:

```typescript
createWebSocketRoute("/ws/chat")
  .onConnect((ws, ctx) => {
    console.log(`User ${ctx.user.id} connected`)
    
    // Subscribe to default room
    ws.subscribe("lobby")
    
    // Send welcome message
    ws.send({
      type: "welcome",
      message: `Welcome, ${ctx.user.name}!`
    })
    
    // Notify others
    ws.publish("lobby", {
      type: "user_joined",
      userId: ctx.user.id
    })
  })
  .build()
```

### onClose

Called when connection closes:

```typescript
createWebSocketRoute("/ws/chat")
  .onClose((ws, ctx, code, reason) => {
    console.log(`User ${ctx.user.id} disconnected: ${code} ${reason}`)
    
    // Notify others
    ws.publish("lobby", {
      type: "user_left",
      userId: ctx.user.id
    })
    
    // Cleanup resources
    cleanupUserResources(ctx.user.id)
  })
  .build()
```

### onError

Called on validation errors or handler exceptions:

```typescript
createWebSocketRoute("/ws/chat")
  .onError((ws, ctx, error) => {
    console.error("WebSocket error:", error)
    
    // Send error to client
    ws.send({
      type: "error",
      message: "An error occurred",
      code: error.code
    })
  })
  .build()
```

### onBinary

Called for binary messages:

```typescript
createWebSocketRoute("/ws/upload")
  .onBinary((ws, ctx, data) => {
    console.log(`Received ${data.byteLength} bytes`)
    
    // Process binary data
    const result = processFile(data)
    
    ws.send({
      type: "upload_complete",
      fileId: result.id
    })
  })
  .build()
```

## WebSocket API

Inside handlers, use the `ws` object:

### Sending Messages

```typescript
// Send to this client
ws.send({
  type: "message",
  content: "Hello!"
})

// Type-safe - only allows server message schema
ws.send({
  type: "invalid" // Error: not in schema
})
```

### Publishing (Broadcasting)

```typescript
// Publish to all subscribers of a topic
ws.publish("room:123", {
  type: "message",
  content: "Broadcast to room 123"
})

// Publish to multiple topics
["room:123", "room:456"].forEach(topic => {
  ws.publish(topic, message)
})
```

### Subscription Management

```typescript
// Subscribe to topic
ws.subscribe("room:123")

// Unsubscribe from topic
ws.unsubscribe("room:123")

// Subscribe to multiple topics
["room:123", "global", "notifications"].forEach(topic => {
  ws.subscribe(topic)
})
```

### Connection Control

```typescript
// Close connection
ws.close()

// Close with code and reason
ws.close(1000, "Normal closure")

// Access connection metadata
console.log(ws.data.user)
console.log(ws.data.params)
console.log(ws.remoteAddress)
```

## Path Parameters

Extract parameters from WebSocket URLs:

```typescript
createWebSocketRoute("/ws/rooms/:roomId")
  .on("message", MessageSchema, (ws, ctx, data) => {
    // ctx.params.roomId is typed as string
    console.log(`Message in room ${ctx.params.roomId}`)
    
    ws.publish(`room:${ctx.params.roomId}`, {
      type: "message",
      content: data.message
    })
  })
  .build()

// Multiple parameters
createWebSocketRoute("/ws/games/:gameId/players/:playerId")
  .on("move", MoveSchema, (ws, ctx, data) => {
    console.log(`Game: ${ctx.params.gameId}`)
    console.log(`Player: ${ctx.params.playerId}`)
  })
  .build()
```

## Complete Example: Chat Application

```typescript
import { createWebSocketRoute, createTokenAuth } from "@bunkit/server"
import { z } from "zod"

// Authentication
const wsAuth = createTokenAuth(async (token: string) => {
  const result = await verifyJWT(token)
  if (result.isErr()) return null
  return { id: result.value.userId, email: result.value.email }
})

// Client message schemas
const JoinRoomSchema = z.object({
  roomId: z.string().min(1).max(50)
})

const LeaveRoomSchema = z.object({
  roomId: z.string().min(1).max(50)
})

const ChatMessageSchema = z.object({
  roomId: z.string().min(1).max(50),
  message: z.string().min(1).max(1000)
})

const TypingSchema = z.object({
  roomId: z.string(),
  isTyping: z.boolean()
})

// Server message schema
const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("room_joined"),
    roomId: z.string(),
    userId: z.string(),
    userEmail: z.string(),
    timestamp: z.number()
  }),
  z.object({
    type: z.literal("room_left"),
    roomId: z.string(),
    userId: z.string(),
    timestamp: z.number()
  }),
  z.object({
    type: z.literal("message"),
    roomId: z.string(),
    userId: z.string(),
    userEmail: z.string(),
    message: z.string(),
    timestamp: z.number()
  }),
  z.object({
    type: z.literal("typing"),
    roomId: z.string(),
    userId: z.string(),
    isTyping: z.boolean()
  }),
  z.object({
    type: z.literal("error"),
    message: z.string()
  })
])

// Track user rooms
const userRooms = new Map<string, Set<string>>()

// Create WebSocket route
createWebSocketRoute("/ws/chat")
  .serverMessages(ServerMessageSchema)
  .authenticate(wsAuth)
  
  // User connects
  .onConnect((ws, ctx) => {
    console.log(`User ${ctx.user.email} connected`)
    userRooms.set(ctx.user.id, new Set())
  })
  
  // User joins room
  .on("join_room", JoinRoomSchema, (ws, ctx, data) => {
    const rooms = userRooms.get(ctx.user.id)
    if (rooms) {
      rooms.add(data.roomId)
    }
    
    ws.subscribe(`room:${data.roomId}`)
    
    ws.publish(`room:${data.roomId}`, {
      type: "room_joined",
      roomId: data.roomId,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      timestamp: Date.now()
    })
  })
  
  // User leaves room
  .on("leave_room", LeaveRoomSchema, (ws, ctx, data) => {
    const rooms = userRooms.get(ctx.user.id)
    if (rooms) {
      rooms.delete(data.roomId)
    }
    
    ws.unsubscribe(`room:${data.roomId}`)
    
    ws.publish(`room:${data.roomId}`, {
      type: "room_left",
      roomId: data.roomId,
      userId: ctx.user.id,
      timestamp: Date.now()
    })
  })
  
  // Chat message
  .on("chat_message", ChatMessageSchema, (ws, ctx, data) => {
    ws.publish(`room:${data.roomId}`, {
      type: "message",
      roomId: data.roomId,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      message: data.message,
      timestamp: Date.now()
    })
  })
  
  // Typing indicator
  .on("typing", TypingSchema, (ws, ctx, data) => {
    ws.publish(`room:${data.roomId}`, {
      type: "typing",
      roomId: data.roomId,
      userId: ctx.user.id,
      isTyping: data.isTyping
    })
  })
  
  // Connection closed
  .onClose((ws, ctx) => {
    console.log(`User ${ctx.user.email} disconnected`)
    
    // Leave all rooms
    const rooms = userRooms.get(ctx.user.id)
    if (rooms) {
      rooms.forEach(roomId => {
        ws.publish(`room:${roomId}`, {
          type: "room_left",
          roomId,
          userId: ctx.user.id,
          timestamp: Date.now()
        })
      })
      userRooms.delete(ctx.user.id)
    }
  })
  
  // Error handling
  .onError((ws, ctx, error) => {
    console.error("WebSocket error:", error)
    ws.send({
      type: "error",
      message: "An error occurred"
    })
  })
  
  .build()
```

## Type Generation

Generate TypeScript types for client applications:

### Generate Types

```typescript
// In a script
import { server } from "./server"

await server.ws.exportWebSocketTypes({
  output: "./frontend/src/generated/websocket-types.ts",
  format: "typescript"
})
```

### Generated Types

```typescript
// Generated file
export type ServerMessage =
  | { type: "message"; userId: string; content: string }
  | { type: "user_joined"; userId: string; userName: string }
  | { type: "error"; message: string }

export type ClientMessage =
  | { type: "chat_message"; roomId: string; message: string }
  | { type: "join_room"; roomId: string }

export interface WebSocketRoute {
  path: "/ws/chat"
  serverMessages: ServerMessage
  clientMessages: ClientMessage
}
```

### Use in Client

```typescript
import type { ServerMessage, ClientMessage } from "./generated/websocket-types"

const ws = new WebSocket("ws://localhost:3000/ws/chat?token=...")

// Type-safe sending
const message: ClientMessage = {
  type: "chat_message",
  roomId: "lobby",
  message: "Hello!"
}
ws.send(JSON.stringify(message))

// Type-safe receiving
ws.onmessage = (event) => {
  const message: ServerMessage = JSON.parse(event.data)
  
  switch (message.type) {
    case "message":
      console.log(message.content)
      break
    case "user_joined":
      console.log(`${message.userName} joined`)
      break
  }
}
```

## Broadcasting Patterns

### Room-Based Broadcasting

```typescript
// Subscribe users to rooms
ws.subscribe(`room:${roomId}`)

// Broadcast to room
ws.publish(`room:${roomId}`, message)

// User-specific messages
ws.send(message)
```

### Global Broadcasting

```typescript
// Subscribe all users
ws.subscribe("global")

// Broadcast to everyone
ws.publish("global", message)
```

### Multi-Room Broadcasting

```typescript
// User in multiple rooms
["room:lobby", "room:general", "notifications"].forEach(topic => {
  ws.subscribe(topic)
})

// Broadcast to specific rooms
["room:lobby", "room:general"].forEach(topic => {
  ws.publish(topic, message)
})
```

### Targeted Broadcasting

```typescript
// Subscribe with user-specific topic
ws.subscribe(`user:${ctx.user.id}`)

// Send to specific user
ws.publish(`user:${targetUserId}`, message)
```

## Best Practices

### 1. Use Discriminated Unions

```typescript
// ✅ Good - Type-safe message handling
const ServerMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), content: z.string() }),
  z.object({ type: z.literal("error"), error: z.string() })
])

// ❌ Bad - Loose typing
const ServerMessage = z.object({
  type: z.string(),
  data: z.any()
})
```

### 2. Clean Up Resources

```typescript
// ✅ Good - Cleanup in onClose
.onClose((ws, ctx) => {
  // Remove from tracking
  activeUsers.delete(ctx.user.id)
  
  // Clear timers
  clearInterval(ctx.heartbeatTimer)
  
  // Notify others
  notifyUserLeft(ctx.user.id)
})
```

### 3. Handle Errors Gracefully

```typescript
// ✅ Good - Send error messages
.onError((ws, ctx, error) => {
  console.error("Error:", error)
  ws.send({
    type: "error",
    message: "Something went wrong"
  })
})
```

### 4. Validate All Input

```typescript
// ✅ Good - Schema validation
.on("message", MessageSchema, (ws, ctx, data) => {
  // data is validated and typed
})

// ❌ Bad - No validation
.onBinary((ws, ctx, data) => {
  // Process without validation
})
```

### 5. Use Topics for Organization

```typescript
// ✅ Good - Structured topics
ws.subscribe(`room:${roomId}`)
ws.subscribe(`user:${userId}`)
ws.subscribe(`notifications:${userId}`)

// ❌ Bad - Unstructured
ws.subscribe(roomId)
ws.subscribe("messages")
```

## Testing WebSockets

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test"

describe("WebSocket Chat", () => {
  let ws: WebSocket
  
  beforeAll(() => {
    ws = new WebSocket("ws://localhost:3001/ws/chat?token=test-token")
  })
  
  afterAll(() => {
    ws.close()
  })
  
  it("should connect", (done) => {
    ws.onopen = () => {
      expect(ws.readyState).toBe(WebSocket.OPEN)
      done()
    }
  })
  
  it("should receive welcome message", (done) => {
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      expect(message.type).toBe("welcome")
      done()
    }
  })
  
  it("should send and receive messages", (done) => {
    ws.send(JSON.stringify({
      type: "chat_message",
      roomId: "test",
      message: "Hello"
    }))
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      expect(message.type).toBe("message")
      expect(message.content).toBe("Hello")
      done()
    }
  })
})
```

## Next Steps

- Review the [Chat WebSocket example](../apps/backend/src/routes/chat.websocket.ts)
- Learn [Type Generation](./10-type-generation.md)
- Read [Testing Guide](./13-testing.md) for WebSocket testing
