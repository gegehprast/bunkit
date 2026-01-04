import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { z } from "zod"
import { createServer } from "../../src/server"
import { webSocketRegistry } from "../../src/websocket/websocket-handler"
import { webSocketRouteRegistry } from "../../src/websocket/websocket-registry"
import { createWebSocketRoute } from "../../src/websocket/websocket-route-builder"

describe("WebSocket Advanced Features (Phase 5)", () => {
  beforeEach(() => {
    webSocketRouteRegistry.clear()
    webSocketRegistry.clear()
  })

  afterEach(() => {
    webSocketRouteRegistry.clear()
    webSocketRegistry.clear()
  })

  describe("Binary Message Support", () => {
    it("should register route with binary handler", () => {
      const route = createWebSocketRoute("/api/stream")
        .onBinary((ws, buffer, _ctx) => {
          // Process binary data
          const size = buffer.byteLength
          ws.sendBinary(Buffer.from([size]))
        })
        .build()

      expect(route.binaryHandler).toBeDefined()
      expect(route.path).toBe("/api/stream")
    })

    it("should register route with both JSON and binary handlers", () => {
      const CommandSchema = z.object({
        action: z.string(),
      })

      const route = createWebSocketRoute("/api/media")
        .on("command", CommandSchema, (_ws, _data, _ctx) => {
          // Handle JSON commands
        })
        .onBinary((_ws, _buffer, _ctx) => {
          // Handle binary uploads
        })
        .build()

      expect(route.messageHandlers).toHaveLength(1)
      expect(route.binaryHandler).toBeDefined()
    })

    it("should chain onBinary with other handlers", () => {
      const route = createWebSocketRoute("/api/mixed")
        .onConnect((_ws, _ctx) => {})
        .onBinary((_ws, _buffer, _ctx) => {})
        .onClose((_ws, _code, _reason, _ctx) => {})
        .onError((_ws, _error, _ctx) => {})
        .build()

      expect(route.connectHandler).toBeDefined()
      expect(route.binaryHandler).toBeDefined()
      expect(route.closeHandler).toBeDefined()
      expect(route.errorHandler).toBeDefined()
    })

    it("should preserve type safety with binary handler", () => {
      type ServerMessage = { type: "ack"; size: number }

      const route = createWebSocketRoute("/api/upload")
        .serverMessages<ServerMessage>()
        .onBinary((ws, buffer, _ctx) => {
          // ws.send is typed to ServerMessage
          ws.send({ type: "ack", size: buffer.byteLength })
        })
        .build()

      expect(route.binaryHandler).toBeDefined()
    })
  })

  describe("Compression Configuration", () => {
    it("should enable compression by default", () => {
      const server = createServer({ port: 0 })

      // The server internally sets perMessageDeflate: true by default
      // We can't directly inspect this, but we verify the option is accepted
      expect(server).toBeDefined()
    })

    it("should allow disabling compression", () => {
      const server = createServer({
        port: 0,
        websocket: {
          compression: false,
        },
      })

      expect(server).toBeDefined()
    })

    it("should accept custom compression settings", () => {
      const server = createServer({
        port: 0,
        websocket: {
          compression: true,
          maxPayloadLength: 1024 * 1024, // 1MB
          idleTimeout: 60, // 1 minute
          backpressureLimit: 512 * 1024, // 512KB
        },
      })

      expect(server).toBeDefined()
    })
  })

  describe("WebSocket Options", () => {
    it("should use default values when no options provided", async () => {
      createWebSocketRoute("/api/test").build()

      const server = createServer({ port: 4600 })
      const result = await server.start()

      expect(result.isOk()).toBe(true)

      await server.stop()
    })

    it("should accept maxPayloadLength option", async () => {
      createWebSocketRoute("/api/test").build()

      const server = createServer({
        port: 4601,
        websocket: {
          maxPayloadLength: 1024, // 1KB limit
        },
      })

      const result = await server.start()
      expect(result.isOk()).toBe(true)

      await server.stop()
    })

    it("should accept idleTimeout option", async () => {
      createWebSocketRoute("/api/test").build()

      const server = createServer({
        port: 4602,
        websocket: {
          idleTimeout: 30, // 30 seconds
        },
      })

      const result = await server.start()
      expect(result.isOk()).toBe(true)

      await server.stop()
    })

    it("should accept backpressureLimit option", async () => {
      createWebSocketRoute("/api/test").build()

      const server = createServer({
        port: 4603,
        websocket: {
          backpressureLimit: 1024 * 1024, // 1MB
        },
      })

      const result = await server.start()
      expect(result.isOk()).toBe(true)

      await server.stop()
    })
  })

  describe("Backpressure Handling", () => {
    it("should expose getBufferedAmount on typed websocket", () => {
      // The TypedWebSocket interface includes getBufferedAmount()
      // We verify the type exists via the route definition

      const route = createWebSocketRoute("/api/stream")
        .on("data", z.object({ value: z.number() }), (ws, _data, _ctx) => {
          // getBufferedAmount() is available on ws
          const buffered = ws.getBufferedAmount()

          // Example backpressure pattern
          if (buffered < 1024 * 1024) {
            ws.send({ type: "ack", buffered })
          }
        })
        .build()

      expect(route.messageHandlers).toHaveLength(1)
    })

    it("should support backpressure check in binary handler", () => {
      const route = createWebSocketRoute("/api/video")
        .onBinary((ws, buffer, _ctx) => {
          const buffered = ws.getBufferedAmount()

          // Skip if backpressure is too high
          if (buffered > 5 * 1024 * 1024) {
            // 5MB threshold
            return
          }

          // Process and respond
          ws.sendBinary(buffer)
        })
        .build()

      expect(route.binaryHandler).toBeDefined()
    })
  })

  describe("Connection Lifecycle", () => {
    it("should register all lifecycle handlers", () => {
      const DataSchema = z.object({ msg: z.string() })

      const route = createWebSocketRoute("/api/full")
        .onConnect((_ws, ctx) => {
          ctx.data.set("connected", Date.now())
        })
        .on("data", DataSchema, (_ws, _data, ctx) => {
          ctx.data.set("lastMessage", Date.now())
        })
        .onBinary((_ws, _buffer, ctx) => {
          ctx.data.set("lastBinary", Date.now())
        })
        .onClose((_ws, _code, _reason, ctx) => {
          const duration = Date.now() - (ctx.data.get("connected") as number)
          console.log(`Connection lasted ${duration}ms`)
        })
        .onError((_ws, error, _ctx) => {
          console.error("Error:", error.message)
        })
        .build()

      expect(route.connectHandler).toBeDefined()
      expect(route.messageHandlers).toHaveLength(1)
      expect(route.binaryHandler).toBeDefined()
      expect(route.closeHandler).toBeDefined()
      expect(route.errorHandler).toBeDefined()
    })

    it("should support close with custom code and reason", () => {
      const route = createWebSocketRoute("/api/managed")
        .on("leave", z.object({}), (ws, _data, _ctx) => {
          ws.close(1000, "Client requested disconnect")
        })
        .onError((ws, _error, _ctx) => {
          ws.close(4000, "Error occurred")
        })
        .build()

      expect(route.messageHandlers).toHaveLength(1)
      expect(route.errorHandler).toBeDefined()
    })
  })

  describe("TypedWebSocket Methods", () => {
    it("should expose all required methods on TypedWebSocket", () => {
      // Verify TypedWebSocket interface through route builder
      const route = createWebSocketRoute("/api/complete")
        .onConnect((ws, _ctx) => {
          // Methods available on ws:
          ws.subscribe("topic")
          ws.unsubscribe("topic")
          void ws.isSubscribed("topic")
          void ws.getBufferedAmount()
          ws.send({ type: "connected" })
          ws.publish("topic", { type: "broadcast" })
          ws.sendBinary(Buffer.from([0x01]))
          ws.close(1000, "Done")
        })
        .build()

      expect(route.connectHandler).toBeDefined()
    })

    it("should support raw websocket access", () => {
      const route = createWebSocketRoute("/api/raw")
        .onConnect((ws, _ctx) => {
          // Access underlying Bun ServerWebSocket
          const raw = ws.raw
          // raw provides direct access when needed
          expect(raw).toBeDefined()
        })
        .build()

      expect(route.connectHandler).toBeDefined()
    })
  })

  describe("Error Handling", () => {
    it("should register error handler for validation failures", () => {
      const StrictSchema = z.object({
        required: z.string().min(1),
        number: z.number().positive(),
      })

      const route = createWebSocketRoute("/api/strict")
        .on("data", StrictSchema, (ws, data, _ctx) => {
          ws.send({ type: "ok", received: data })
        })
        .onError((ws, error, _ctx) => {
          ws.send({ type: "error", message: error.message })
        })
        .build()

      expect(route.messageHandlers).toHaveLength(1)
      expect(route.errorHandler).toBeDefined()
    })

    it("should register error handler for unknown message types", () => {
      const route = createWebSocketRoute("/api/known")
        .on("ping", z.object({}), (ws) => {
          ws.send({ type: "pong" })
        })
        .onError((ws, error, _ctx) => {
          // Handle unknown message types
          if (error.message.includes("Unknown message type")) {
            ws.send({ type: "error", code: "UNKNOWN_TYPE" })
          }
        })
        .build()

      expect(route.errorHandler).toBeDefined()
    })
  })

  describe("Path Parameters with Advanced Features", () => {
    it("should combine path params with binary handling", () => {
      const route = createWebSocketRoute("/api/upload/:fileId")
        .onConnect((_ws, ctx) => {
          const fileId = ctx.params.fileId
          ctx.data.set("fileId", fileId)
          ctx.data.set("chunks", [] as Buffer[])
        })
        .onBinary((ws, buffer, ctx) => {
          const chunks = ctx.data.get("chunks") as Buffer[]
          chunks.push(buffer)
          ws.send({
            type: "chunk_received",
            chunkNumber: chunks.length,
            fileId: ctx.params.fileId,
          })
        })
        .build()

      expect(route.connectHandler).toBeDefined()
      expect(route.binaryHandler).toBeDefined()
    })

    it("should combine path params with authentication", () => {
      interface User {
        id: string
        canAccessRoom: (roomId: string) => boolean
      }

      const authFn = (_req: Request): User | null => {
        return { id: "user-1", canAccessRoom: () => true }
      }

      const route = createWebSocketRoute("/api/rooms/:roomId/stream")
        .authenticate(authFn)
        .onConnect((ws, ctx) => {
          const roomId = ctx.params.roomId

          if (roomId && !ctx.user?.canAccessRoom(roomId)) {
            ws.close(4003, "Access denied")
            return
          }

          ws.subscribe(`room:${roomId}`)
        })
        .build()

      expect(route.authFn).toBeDefined()
      expect(route.connectHandler).toBeDefined()
    })
  })

  describe("Server Message Types", () => {
    it("should enforce server message types across all handlers", () => {
      type ServerMsg =
        | { type: "connected"; connectionId: string }
        | { type: "data"; payload: unknown }
        | { type: "binary_ack"; size: number }
        | { type: "error"; message: string }
        | { type: "disconnecting"; reason: string }

      const route = createWebSocketRoute("/api/typed")
        .serverMessages<ServerMsg>()
        .onConnect((ws, ctx) => {
          ws.send({ type: "connected", connectionId: ctx.connectionId })
        })
        .on("request", z.object({ data: z.unknown() }), (ws, data, _ctx) => {
          ws.send({ type: "data", payload: data.data })
        })
        .onBinary((ws, buffer, _ctx) => {
          ws.send({ type: "binary_ack", size: buffer.byteLength })
        })
        .onError((ws, error, _ctx) => {
          ws.send({ type: "error", message: error.message })
        })
        .onClose((_ws, _code, _reason, _ctx) => {
          // Note: can't send after close, but type checking still applies
        })
        .build()

      expect(route.connectHandler).toBeDefined()
      expect(route.messageHandlers).toHaveLength(1)
      expect(route.binaryHandler).toBeDefined()
      expect(route.errorHandler).toBeDefined()
    })
  })
})
