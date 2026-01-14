import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, unlinkSync } from "node:fs"
import { z } from "zod"
import { createServer } from "../../src/server"
import { webSocketRouteRegistry } from "../../src/websocket/websocket-registry"
import { createWebSocketRoute } from "../../src/websocket/websocket-route-builder"
import { generateWebSocketTypes } from "../../src/websocket/websocket-type-generator"

describe("WebSocket Type Generator", () => {
  const testOutputPath = "/tmp/test-ws-types.ts"

  beforeEach(() => {
    webSocketRouteRegistry.clear()
  })

  afterEach(() => {
    if (existsSync(testOutputPath)) {
      unlinkSync(testOutputPath)
    }
  })

  it("should generate types for a simple WebSocket route", async () => {
    // Define schemas
    const ChatMessageSchema = z.object({
      text: z.string(),
      timestamp: z.number(),
    })

    const JoinRoomSchema = z.object({
      roomId: z.string(),
    })

    // Register a WebSocket route
    createWebSocketRoute("/api/chat")
      .on("chat", ChatMessageSchema, () => {})
      .on("join", JoinRoomSchema, () => {})
      .build()

    // Generate types as string
    const result = await generateWebSocketTypes({})
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      const content = result.value

      expect(content).toContain("export namespace ApiChatWebSocket")
      expect(content).toContain('type: "chat"')
      expect(content).toContain('type: "join"')
      expect(content).toContain("text: string")
      expect(content).toContain("timestamp: number")
      expect(content).toContain("roomId: string")
    }
  })

  it("should handle routes with path parameters", async () => {
    const PingSchema = z.object({
      message: z.string(),
    })

    createWebSocketRoute("/api/rooms/:roomId/ws")
      .on("ping", PingSchema, () => {})
      .build()

    const result = await generateWebSocketTypes({})
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      const content = result.value

      // Path params are skipped in namespace name
      expect(content).toContain("export namespace ApiRoomsWsWebSocket")
      expect(content).toContain('type: "ping"')
    }
  })

  it("should filter routes when specified", async () => {
    const Schema1 = z.object({ a: z.string() })
    const Schema2 = z.object({ b: z.number() })

    createWebSocketRoute("/api/chat")
      .on("msg", Schema1, () => {})
      .build()

    createWebSocketRoute("/api/notifications")
      .on("notify", Schema2, () => {})
      .build()

    // Generate only for /api/chat
    const result = await generateWebSocketTypes({
      routes: ["/api/chat"],
    })
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      const content = result.value

      expect(content).toContain("ApiChatWebSocket")
      expect(content).not.toContain("ApiNotificationsWebSocket")
    }
  })

  it("should handle complex nested schemas", async () => {
    const ComplexSchema = z.object({
      user: z.object({
        id: z.string(),
        profile: z.object({
          name: z.string(),
          age: z.number().optional(),
        }),
      }),
      tags: z.array(z.string()),
    })

    createWebSocketRoute("/api/complex")
      .on("complex", ComplexSchema, () => {})
      .build()

    const result = await generateWebSocketTypes({})
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      const content = result.value

      expect(content).toContain("user:")
      expect(content).toContain("id: string")
      expect(content).toContain("profile:")
      expect(content).toContain("name: string")
      expect(content).toContain("age?: number")
      expect(content).toContain("tags: string[]")
    }
  })

  it("should return empty string for empty routes", async () => {
    const result = await generateWebSocketTypes({})
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      expect(result.value).toBe("")
    }
  })

  it("should export types to file via server instance", async () => {
    const server = createServer({ port: 3000 })

    const ChatSchema = z.object({
      message: z.string(),
    })

    createWebSocketRoute("/ws/chat", server)
      .on("chat", ChatSchema, () => {})
      .build()

    // Export to file
    const result = await server.ws.exportWebSocketTypes({
      outputPath: testOutputPath,
    })
    expect(result.isOk()).toBe(true)

    // Verify file was created
    expect(existsSync(testOutputPath)).toBe(true)

    // Verify content
    const content = await Bun.file(testOutputPath).text()
    expect(content).toContain("export namespace WsChatWebSocket")
    expect(content).toContain('type: "chat"')
    expect(content).toContain("message: string")
  })

  it("should get types as string via server instance", async () => {
    const server = createServer({ port: 3000 })

    const PingSchema = z.object({
      timestamp: z.number(),
    })

    createWebSocketRoute("/ws/ping", server)
      .on("ping", PingSchema, () => {})
      .build()

    // Get types as string
    const result = await server.ws.getWebSocketTypes({})
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      const content = result.value
      expect(content).toContain("export namespace WsPingWebSocket")
      expect(content).toContain('type: "ping"')
      expect(content).toContain("timestamp: number")
    }
  })
})
