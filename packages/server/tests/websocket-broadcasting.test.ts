import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import type { ServerWebSocket } from "bun"
import { z } from "zod"
import { createServer } from "../src/server"
import type { WebSocketData } from "../src/websocket/types/websocket"
import { webSocketRegistry } from "../src/websocket/websocket-handler"
import { webSocketRouteRegistry } from "../src/websocket/websocket-registry"
import { createWebSocketRoute } from "../src/websocket/websocket-route-builder"

describe("WebSocket External Broadcasting (Phase 4)", () => {
  beforeEach(() => {
    webSocketRouteRegistry.clear()
    webSocketRegistry.clear()
  })

  afterEach(() => {
    webSocketRouteRegistry.clear()
    webSocketRegistry.clear()
  })

  describe("WebSocketConnectionRegistry", () => {
    it("should start with no connections", () => {
      const all = webSocketRegistry.getAll()
      expect(all).toEqual([])
      expect(webSocketRegistry.size).toBe(0)
    })

    it("should add connections", () => {
      // Create mock WebSocket
      const mockWs1 = {
        data: { context: { connectionId: "1" }, routePath: "/test" },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>
      const mockWs2 = {
        data: { context: { connectionId: "2" }, routePath: "/test" },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(mockWs1)
      webSocketRegistry.add(mockWs2)

      expect(webSocketRegistry.size).toBe(2)
      expect(webSocketRegistry.getAll()).toHaveLength(2)
    })

    it("should remove connections", () => {
      const mockWs = {
        data: { context: { connectionId: "1" }, routePath: "/test" },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(mockWs)
      expect(webSocketRegistry.size).toBe(1)

      webSocketRegistry.remove(mockWs)
      expect(webSocketRegistry.size).toBe(0)
    })

    it("should filter connections by predicate", () => {
      const adminWs = {
        data: {
          context: { connectionId: "1", user: { role: "admin" } },
          routePath: "/test",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>
      const userWs = {
        data: {
          context: { connectionId: "2", user: { role: "user" } },
          routePath: "/test",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>
      const guestWs = {
        data: {
          context: { connectionId: "3" },
          routePath: "/test",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(adminWs)
      webSocketRegistry.add(userWs)
      webSocketRegistry.add(guestWs)

      const admins = webSocketRegistry.filter(
        (ws) =>
          (ws.data.context as { user?: { role: string } }).user?.role ===
          "admin",
      )

      expect(admins).toHaveLength(1)
      expect(
        (admins[0]?.data.context as { connectionId: string }).connectionId,
      ).toBe("1")
    })

    it("should broadcast message to all connections", () => {
      const messages1: string[] = []
      const messages2: string[] = []

      const mockWs1 = {
        data: { context: { connectionId: "1" }, routePath: "/test" },
        send: (msg: string) => messages1.push(msg),
      } as unknown as ServerWebSocket<WebSocketData<unknown>>
      const mockWs2 = {
        data: { context: { connectionId: "2" }, routePath: "/test" },
        send: (msg: string) => messages2.push(msg),
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(mockWs1)
      webSocketRegistry.add(mockWs2)

      webSocketRegistry.broadcast({ type: "hello", data: "world" })

      expect(messages1).toHaveLength(1)
      expect(messages2).toHaveLength(1)
      expect(messages1[0]).toBe('{"type":"hello","data":"world"}')
      expect(messages2[0]).toBe('{"type":"hello","data":"world"}')
    })

    it("should broadcast binary data to all connections", () => {
      const messages1: Buffer[] = []
      const messages2: Buffer[] = []

      const mockWs1 = {
        data: { context: { connectionId: "1" }, routePath: "/test" },
        send: (data: Buffer) => messages1.push(data),
      } as unknown as ServerWebSocket<WebSocketData<unknown>>
      const mockWs2 = {
        data: { context: { connectionId: "2" }, routePath: "/test" },
        send: (data: Buffer) => messages2.push(data),
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(mockWs1)
      webSocketRegistry.add(mockWs2)

      const binaryData = Buffer.from([0x01, 0x02, 0x03])
      webSocketRegistry.broadcastBinary(binaryData)

      expect(messages1).toHaveLength(1)
      expect(messages2).toHaveLength(1)
      expect(messages1[0]).toEqual(binaryData)
      expect(messages2[0]).toEqual(binaryData)
    })

    it("should handle broadcast to empty registry", () => {
      // Should not throw
      expect(() => webSocketRegistry.broadcast({ type: "test" })).not.toThrow()
      expect(() =>
        webSocketRegistry.broadcastBinary(Buffer.from([0x01])),
      ).not.toThrow()
    })

    it("should clear all connections", () => {
      const mockWs1 = {
        data: { context: { connectionId: "1" }, routePath: "/test" },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>
      const mockWs2 = {
        data: { context: { connectionId: "2" }, routePath: "/test" },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(mockWs1)
      webSocketRegistry.add(mockWs2)
      expect(webSocketRegistry.size).toBe(2)

      webSocketRegistry.clear()
      expect(webSocketRegistry.size).toBe(0)
    })
  })

  describe("Server.publish()", () => {
    it("should warn when publishing before server start", () => {
      const server = createServer({ port: 0 })
      const warnings: string[] = []
      const originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      server.ws.publish("test-topic", { type: "test" })

      console.warn = originalWarn
      expect(warnings).toContain("Cannot publish: server not started")
    })

    it("should warn when publishing binary before server start", () => {
      const server = createServer({ port: 0 })
      const warnings: string[] = []
      const originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      server.ws.publishBinary("test-topic", Buffer.from([0x01]))

      console.warn = originalWarn
      expect(warnings).toContain("Cannot publish: server not started")
    })
  })

  describe("WebSocket Route with Connection Tracking", () => {
    it("should register WebSocket route for broadcasting", () => {
      const MessageSchema = z.object({ text: z.string() })

      const route = createWebSocketRoute("/api/broadcast")
        .onConnect((ws, _ctx) => {
          ws.subscribe("broadcast-channel")
        })
        .on("message", MessageSchema, (ws, data, _ctx) => {
          ws.publish("broadcast-channel", {
            type: "message",
            text: data.text,
          })
        })
        .build()

      expect(route.path).toBe("/api/broadcast")
      expect(route.connectHandler).toBeDefined()
      expect(route.messageHandlers).toHaveLength(1)
    })
  })

  describe("Server Integration", () => {
    let server: ReturnType<typeof createServer>

    afterEach(async () => {
      if (server) {
        await server.stop()
      }
    })

    it("should start server with WebSocket route", async () => {
      createWebSocketRoute("/api/notifications", undefined)
        .onConnect((ws, ctx) => {
          ws.subscribe(`user:${ctx.params.userId || "anonymous"}`)
        })
        .build()

      server = createServer({ port: 0 })
      const result = await server.start()

      expect(result.isOk()).toBe(true)
    })

    it("should allow publishing after server start", async () => {
      createWebSocketRoute("/api/test").build()

      server = createServer({ port: 4500 })
      const result = await server.start()
      expect(result.isOk()).toBe(true)

      // Should not throw or warn after server is started
      const warnings: string[] = []
      const originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      server.ws.publish("test-topic", { type: "notification", data: "test" })

      console.warn = originalWarn
      expect(warnings).not.toContain("Cannot publish: server not started")
    })
  })

  describe("Filtering Use Cases", () => {
    beforeEach(() => {
      webSocketRegistry.clear()
    })

    it("should filter by user role for admin broadcasts", () => {
      const adminWs = {
        data: {
          context: { connectionId: "1", user: { id: "a1", role: "admin" } },
          routePath: "/api/chat",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      const userWs1 = {
        data: {
          context: { connectionId: "2", user: { id: "u1", role: "user" } },
          routePath: "/api/chat",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      const userWs2 = {
        data: {
          context: { connectionId: "3", user: { id: "u2", role: "user" } },
          routePath: "/api/chat",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(adminWs)
      webSocketRegistry.add(userWs1)
      webSocketRegistry.add(userWs2)

      // Filter for admin broadcast
      const admins = webSocketRegistry.filter((ws) => {
        const ctx = ws.data.context as { user?: { role: string } }
        return ctx.user?.role === "admin"
      })

      expect(admins).toHaveLength(1)

      // Filter for regular user broadcast
      const users = webSocketRegistry.filter((ws) => {
        const ctx = ws.data.context as { user?: { role: string } }
        return ctx.user?.role === "user"
      })

      expect(users).toHaveLength(2)
    })

    it("should filter by route path", () => {
      const chatWs = {
        data: { context: { connectionId: "1" }, routePath: "/api/chat" },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      const notificationWs = {
        data: {
          context: { connectionId: "2" },
          routePath: "/api/notifications",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(chatWs)
      webSocketRegistry.add(notificationWs)

      const chatConnections = webSocketRegistry.filter(
        (ws) => ws.data.routePath === "/api/chat",
      )

      expect(chatConnections).toHaveLength(1)
    })

    it("should filter by premium status for tiered features", () => {
      const premiumWs = {
        data: {
          context: { connectionId: "1", user: { isPremium: true } },
          routePath: "/api/stream",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      const freeWs = {
        data: {
          context: { connectionId: "2", user: { isPremium: false } },
          routePath: "/api/stream",
        },
        send: () => {},
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(premiumWs)
      webSocketRegistry.add(freeWs)

      const premiumUsers = webSocketRegistry.filter((ws) => {
        const ctx = ws.data.context as { user?: { isPremium: boolean } }
        return ctx.user?.isPremium === true
      })

      expect(premiumUsers).toHaveLength(1)
    })

    it("should send targeted messages to filtered connections", () => {
      const receivedMessages: { id: string; messages: unknown[] }[] = [
        { id: "1", messages: [] },
        { id: "2", messages: [] },
        { id: "3", messages: [] },
      ]

      const ws1 = {
        data: {
          context: { connectionId: "1", user: { region: "US" } },
          routePath: "/api/alerts",
        },
        send: (msg: string) =>
          receivedMessages
            .find((r) => r.id === "1")
            ?.messages.push(JSON.parse(msg)),
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      const ws2 = {
        data: {
          context: { connectionId: "2", user: { region: "EU" } },
          routePath: "/api/alerts",
        },
        send: (msg: string) =>
          receivedMessages
            .find((r) => r.id === "2")
            ?.messages.push(JSON.parse(msg)),
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      const ws3 = {
        data: {
          context: { connectionId: "3", user: { region: "US" } },
          routePath: "/api/alerts",
        },
        send: (msg: string) =>
          receivedMessages
            .find((r) => r.id === "3")
            ?.messages.push(JSON.parse(msg)),
      } as unknown as ServerWebSocket<WebSocketData<unknown>>

      webSocketRegistry.add(ws1)
      webSocketRegistry.add(ws2)
      webSocketRegistry.add(ws3)

      // Send regional alert to US users only
      const usConnections = webSocketRegistry.filter((ws) => {
        const ctx = ws.data.context as { user?: { region: string } }
        return ctx.user?.region === "US"
      })

      const alertMessage = JSON.stringify({
        type: "regional_alert",
        region: "US",
        message: "US-specific notification",
      })

      for (const ws of usConnections) {
        ws.send(alertMessage)
      }

      // Verify only US users received the message
      expect(receivedMessages.find((r) => r.id === "1")?.messages).toHaveLength(
        1,
      )
      expect(receivedMessages.find((r) => r.id === "2")?.messages).toHaveLength(
        0,
      )
      expect(receivedMessages.find((r) => r.id === "3")?.messages).toHaveLength(
        1,
      )
    })
  })
})
