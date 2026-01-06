# WebSocket Type Generation

This document explains how to use the WebSocket type generation system in BunKit.

## Overview

BunKit automatically generates TypeScript types for WebSocket communication between your backend and frontend. This ensures type safety for real-time messaging.

Both client-to-server **and** server-to-client message types are auto-generated from Zod schemas.

## Quick Start

### Generate Types to Frontend

```bash
# From project root
bun run backend:ws-types:generate:to-frontend
```

This generates:
- `apps/frontend/src/generated/websocket-types.ts` - Auto-generated types for both client and server messages

**No manual type copying required!** Both directions are fully automated when using Zod schemas.

## Generated Files

### `websocket-types.ts` (Fully Auto-generated)

Contains both client-to-server and server-to-client message types extracted from your Zod schemas:

```typescript
import { WsChatWebSocket } from './generated/websocket-types'

// Fully typed client messages
const joinMessage: WsChatWebSocket.ClientMessage = {
  type: 'join',
  data: { roomId: 'room-123' }
}

// Fully typed server messages
type ServerMessage = WsChatWebSocket.ServerMessage
// ServerMessage is a union of all server message types like:
// | { type: 'room_joined'; roomId: string; userId: string; ... }
// | { type: 'message'; roomId: string; message: string; ... }
// etc.

// Handle typed server messages
ws.onmessage = (event) => {
  const message: WsChatWebSocket.ServerMessage = JSON.parse(event.data)
  
  switch (message.type) {
    case 'room_joined':
      console.log(`User ${message.userEmail} joined ${message.roomId}`)
      break
    case 'message':
      console.log(`${message.userEmail}: ${message.message}`)
      break
    // TypeScript ensures all cases are handled
  }
}
```

## Commands

### Backend Package Commands

```bash
# Generate types to default location (./websocket-types.ts)
cd apps/backend
bun run ws-types:generate

# Generate to custom location
bun run ws-types:generate --output custom-path.ts

# Generate only specific routes
bun run ws-types:generate --routes /ws/chat --routes /ws/notifications
```

### Root Commands

```bash
# Generate to frontend (recommended)
bun run backend:ws-types:generate:to-frontend

# Generate to backend default location
bun run backend:ws-types:generate
```

## Complete Example

### 1. Define WebSocket Route (Backend)

```typescript
// apps/backend/src/routes/chat.websocket.ts
import { createWebSocketRoute, createTokenAuth } from '@bunkit/server'
import { z } from 'zod'

// Client -> Server schemas (will be auto-generated)
const JoinRoomSchema = z.object({
  roomId: z.string(),
})

const ChatMessageSchema = z.object({
  roomId: z.string(),
  message: z.string(),
})

// Server -> Client schema (will be auto-generated)
const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('room_joined'),
    roomId: z.string(),
    userId: z.string(),
    userEmail: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('message'),
    roomId: z.string(),
    message: z.string(),
    userId: z.string(),
    userEmail: z.string(),
    timestamp: z.number(),
  }),
])

// Infer TypeScript type for internal use
type ServerMessage = z.infer<typeof ServerMessageSchema>

createWebSocketRoute('/ws/chat', server)
  .serverMessages(ServerMessageSchema)  // Pass schema here!
  .authenticate(createTokenAuth(verifyToken))
  .on('join', JoinRoomSchema, ({ message, ws }) => {
    ws.subscribe(`room:${message.data.roomId}`)
    
    // Send with type safety
    const msg: ServerMessage = {
      type: 'room_joined',
      roomId: message.data.roomId,
      userId: ws.data.context.user.id,
      userEmail: ws.data.context.user.email,
      timestamp: Date.now(),
    }
    ws.send(msg)
  })
  .on('chat', ChatMessageSchema, ({ message, ws }) => {
    server.ws.publish(`room:${message.data.roomId}`, {
      type: 'message',
      roomId: message.data.roomId,
      message: message.data.message,
      userId: ws.data.context.user.id,
      userEmail: ws.data.context.user.email,
      timestamp: Date.now(),
    })
  })
  .build()
```

### 2. Generate Types

```bash
bun run backend:ws-types:generate:to-frontend
```

This auto-generates **both** `ClientMessage` and `ServerMessage` types from your Zod schemas!

### 3. Use in Frontend

```typescript
// apps/frontend/src/hooks/useWebSocket.ts
import { WsChatWebSocket } from './generated/websocket-types'

export function useWebSocket(url: string) {
  const ws = new WebSocket(url)
  
  // Send typed messages
  const sendMessage = (message: WsChatWebSocket.ClientMessage) => {
    ws.send(JSON.stringify(message))
  }
  
  // Receive typed messages
  ws.onmessage = (event) => {
    const message: WsChatWebSocket.ServerMessage = JSON.parse(event.data)
    
    // Full type safety with discriminated union
    switch (message.type) {
      case 'room_joined':
        console.log(`${message.userEmail} joined ${message.roomId}`)
        break
      case 'message':
        console.log(`${message.userEmail}: ${message.message}`)
        break
    }
  }
  
  return { sendMessage }
}
```

## Tips

1. **Regenerate After Changes**: Run `bun run backend:ws-types:generate:to-frontend` after modifying WebSocket routes or schemas
2. **Use Zod Schemas**: Define server messages with `z.discriminatedUnion()` for automatic type generation
3. **Type Inference**: Use `z.infer<typeof Schema>` in backend for type safety during implementation
4. **Discriminated Unions**: Both client and server messages use `type` field for type discrimination
5. **Consider Shared Package**: For larger projects, create a shared types package to reduce duplication

## Key Benefits

- ✅ **Zero Manual Work**: Both client and server types auto-generated from Zod schemas
- ✅ **Single Source of Truth**: Zod schemas define validation AND types
- ✅ **Type Safety**: Full TypeScript support in both backend and frontend
- ✅ **Runtime Validation**: Zod provides validation at runtime (future enhancement)
- ✅ **Refactoring Safety**: Changes to schemas automatically update generated types

## Automation

Add to your development workflow:

```json
{
  "scripts": {
    "dev": "bun run backend:ws-types:generate:to-frontend && bun run frontend:dev"
  }
}
```

## Troubleshooting

### Types Not Updating

```bash
# Clear and regenerate
rm apps/frontend/src/generated/websocket-types.ts
bun run backend:ws-types:generate:to-frontend
```

### Server Types Show as `unknown`

Make sure you're passing the Zod schema to `.serverMessages()`:

```typescript
// ❌ Wrong - generic type parameter (cannot be extracted)
.serverMessages<ServerMessage>()

// ✅ Correct - Zod schema (can be extracted)
.serverMessages(ServerMessageSchema)
```

### No Routes Found

Ensure your WebSocket routes are loaded via `loadRoutes()` before type generation runs.

## Migration from Manual Types

If you previously had manual server types, follow these steps:

1. **Convert type to Zod schema:**
   ```typescript
   // Before:
   type ServerMessage = { type: 'foo'; data: string } | { type: 'bar'; count: number }
   
   // After:
   const ServerMessageSchema = z.discriminatedUnion('type', [
     z.object({ type: z.literal('foo'), data: z.string() }),
     z.object({ type: z.literal('bar'), count: z.number() }),
   ])
   type ServerMessage = z.infer<typeof ServerMessageSchema>
   ```

2. **Update route builder:**
   ```typescript
   // Before:
   .serverMessages<ServerMessage>()
   
   // After:
   .serverMessages(ServerMessageSchema)
   ```

3. **Regenerate types:**
   ```bash
   bun run backend:ws-types:generate:to-frontend
   ```

4. **Remove manual type file:**
   ```bash
   rm apps/frontend/src/generated/websocket-server-types.ts
   ```
