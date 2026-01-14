import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { z } from "zod"
import { createServer } from "../../src/server"
import { webSocketRouteRegistry } from "../../src/websocket/websocket-registry"
import { createWebSocketRoute } from "../../src/websocket/websocket-route-builder"

describe("WebSocket Route Inspection API", () => {
  beforeEach(() => {
    // Clear global registry before each test
    webSocketRouteRegistry.clear()
  })

  afterEach(() => {
    webSocketRouteRegistry.clear()
  })

  describe("getRoutes() - Global Registry", () => {
    test("should return empty array when no routes registered", () => {
      const server = createServer({ port: 3600 })
      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual([])
      }
    })

    test("should return basic WebSocket route information", () => {
      const server = createServer({ port: 3601 })

      const MessageSchema = z.object({
        type: z.literal("message"),
        data: z.object({ text: z.string() }),
      })

      createWebSocketRoute("/ws/chat")
        .on("message", MessageSchema, () => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]).toMatchObject({
          path: "/ws/chat",
          messageTypes: ["message"],
          requiresAuth: false,
          hasBinaryHandler: false,
          hasConnectHandler: false,
          hasCloseHandler: false,
          hasErrorHandler: false,
        })
      }
    })

    test("should include all message types", () => {
      const server = createServer({ port: 3602 })

      const PingSchema = z.object({
        type: z.literal("ping"),
        data: z.object({ timestamp: z.number() }),
      })

      const ChatSchema = z.object({
        type: z.literal("chat"),
        data: z.object({ text: z.string() }),
      })

      const JoinSchema = z.object({
        type: z.literal("join"),
        data: z.object({ room: z.string() }),
      })

      createWebSocketRoute("/ws/multi")
        .on("ping", PingSchema, () => {})
        .on("chat", ChatSchema, () => {})
        .on("join", JoinSchema, () => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.messageTypes).toEqual(["ping", "chat", "join"])
      }
    })

    test("should detect authenticated routes", () => {
      const server = createServer({ port: 3603 })

      const MessageSchema = z.object({
        type: z.literal("message"),
        data: z.object({ text: z.string() }),
      })

      createWebSocketRoute("/ws/private")
        .authenticate(async () => ({ id: "user123" }))
        .on("message", MessageSchema, () => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.requiresAuth).toBe(true)
      }
    })

    test("should detect binary message handler", () => {
      const server = createServer({ port: 3604 })

      createWebSocketRoute("/ws/binary")
        .onBinary(() => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.hasBinaryHandler).toBe(true)
      }
    })

    test("should detect connection lifecycle handlers", () => {
      const server = createServer({ port: 3605 })

      createWebSocketRoute("/ws/lifecycle")
        .onConnect(() => {})
        .onClose(() => {})
        .onError(() => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]).toMatchObject({
          hasConnectHandler: true,
          hasCloseHandler: true,
          hasErrorHandler: true,
        })
      }
    })

    test("should return multiple WebSocket routes", () => {
      const server = createServer({ port: 3606 })

      const Schema1 = z.object({
        type: z.literal("msg1"),
        data: z.object({ value: z.string() }),
      })

      const Schema2 = z.object({
        type: z.literal("msg2"),
        data: z.object({ value: z.number() }),
      })

      createWebSocketRoute("/ws/chat")
        .on("msg1", Schema1, () => {})
        .build()

      createWebSocketRoute("/ws/notifications")
        .on("msg2", Schema2, () => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(2)
        expect(result.value.map((r) => r.path).sort()).toEqual([
          "/ws/chat",
          "/ws/notifications",
        ])
      }
    })

    test("should include path parameters in path", () => {
      const server = createServer({ port: 3607 })

      const MessageSchema = z.object({
        type: z.literal("message"),
        data: z.object({ text: z.string() }),
      })

      createWebSocketRoute("/ws/rooms/:roomId/users/:userId")
        .on("message", MessageSchema, () => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.path).toBe("/ws/rooms/:roomId/users/:userId")
      }
    })
  })

  describe("getRoutes() - Server-Scoped Registry", () => {
    test("should return only server-scoped WebSocket routes", () => {
      const server1 = createServer({ port: 3610 })
      const server2 = createServer({ port: 3611 })

      const Schema = z.object({
        type: z.literal("msg"),
        data: z.object({ text: z.string() }),
      })

      // Global route
      createWebSocketRoute("/ws/global")
        .on("msg", Schema, () => {})
        .build()

      // Server1 scoped routes
      createWebSocketRoute("/ws/server1/route1", server1)
        .on("msg", Schema, () => {})
        .build()

      createWebSocketRoute("/ws/server1/route2", server1)
        .on("msg", Schema, () => {})
        .build()

      // Server2 scoped route
      createWebSocketRoute("/ws/server2/route", server2)
        .on("msg", Schema, () => {})
        .build()

      const result1 = server1.ws.getRoutes()
      const result2 = server2.ws.getRoutes()

      expect(result1.isOk()).toBe(true)
      expect(result2.isOk()).toBe(true)

      if (result1.isOk()) {
        expect(result1.value).toHaveLength(2)
        expect(result1.value.map((r) => r.path)).toEqual([
          "/ws/server1/route1",
          "/ws/server1/route2",
        ])
      }

      if (result2.isOk()) {
        expect(result2.value).toHaveLength(1)
        expect(result2.value[0]?.path).toBe("/ws/server2/route")
      }
    })

    test("should return global routes when no local routes", () => {
      const server = createServer({ port: 3612 })

      const Schema = z.object({
        type: z.literal("msg"),
        data: z.object({ text: z.string() }),
      })

      // Only register global route
      createWebSocketRoute("/ws/global")
        .on("msg", Schema, () => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.path).toBe("/ws/global")
      }
    })
  })

  describe("getRoutes() - Complex Scenarios", () => {
    test("should handle routes with all features enabled", () => {
      const server = createServer({ port: 3615 })

      const MessageSchema = z.object({
        type: z.literal("message"),
        data: z.object({ text: z.string() }),
      })

      const PingSchema = z.object({
        type: z.literal("ping"),
        data: z.object({ timestamp: z.number() }),
      })

      createWebSocketRoute("/ws/full-featured")
        .authenticate(async () => ({ id: "user123", name: "John" }))
        .on("message", MessageSchema, () => {})
        .on("ping", PingSchema, () => {})
        .onBinary(() => {})
        .onConnect(() => {})
        .onClose(() => {})
        .onError(() => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        const route = result.value[0]
        expect(route).toMatchObject({
          path: "/ws/full-featured",
          messageTypes: ["message", "ping"],
          requiresAuth: true,
          hasBinaryHandler: true,
          hasConnectHandler: true,
          hasCloseHandler: true,
          hasErrorHandler: true,
        })
      }
    })

    test("should handle routes with no message handlers but lifecycle handlers", () => {
      const server = createServer({ port: 3616 })

      createWebSocketRoute("/ws/lifecycle-only")
        .onConnect(() => {})
        .onClose(() => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]).toMatchObject({
          path: "/ws/lifecycle-only",
          messageTypes: [],
          hasConnectHandler: true,
          hasCloseHandler: true,
        })
      }
    })
  })

  describe("getRoutes() - Edge Cases", () => {
    test("should handle routes with no handlers", () => {
      const server = createServer({ port: 3620 })

      createWebSocketRoute("/ws/empty").build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]).toMatchObject({
          path: "/ws/empty",
          messageTypes: [],
          requiresAuth: false,
          hasBinaryHandler: false,
          hasConnectHandler: false,
          hasCloseHandler: false,
          hasErrorHandler: false,
        })
      }
    })

    test("should handle route without authentication as not requiring auth", () => {
      const server = createServer({ port: 3621 })

      const Schema = z.object({
        type: z.literal("msg"),
        data: z.object({ text: z.string() }),
      })

      createWebSocketRoute("/ws/public")
        .on("msg", Schema, () => {})
        .build()

      const result = server.ws.getRoutes()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value[0]?.requiresAuth).toBe(false)
      }
    })
  })
})
