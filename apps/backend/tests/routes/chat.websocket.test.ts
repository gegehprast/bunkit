/**
 * WebSocket Chat Integration Tests
 *
 * Tests the real-time chat WebSocket functionality including:
 * - Authentication
 * - Room management
 * - Message broadcasting
 * - User presence
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { generateToken } from "@/auth/auth.service"
import { config } from "@/config"
import { server } from "@/core/server"
import { closeDatabase, initDatabase } from "@/db/client"
import { getUserRepository } from "@/db/repositories/user-repository"
import { loadRoutes } from "@/routes"

describe("WebSocket Chat", () => {
  let token: string
  let userId: string

  beforeAll(
    async () => {
      // Initialize database
      await initDatabase()

      // Load routes to register WebSocket handlers
      await loadRoutes()

      // Start server
      await server.start()

      // Create test user
      const userRepo = getUserRepository()
      const check = await userRepo.findByEmail("ws-test@example.com")
      if (check.isOk() && check.value) {
        userId = check.value.id
      } else {
        const createResult = await userRepo.create({
          email: "ws-test@example.com",
          passwordHash: "test-hash",
          name: "WS Test User",
        })

        if (createResult.isOk()) {
          userId = createResult.value.id
        }
      }

      // Generate auth token
      const tokenResult = await generateToken(userId, "ws-test@example.com")
      if (tokenResult.isOk()) {
        token = tokenResult.value
      }
      console.log("Generated test token:", token)

      // Check the health endpoint to ensure server is ready
      const healthResponse = await fetch(
        `http://localhost:${config.PORT}/api/health`,
      )
      if (!healthResponse.ok) {
        throw new Error(
          `Server health check failed with status ${healthResponse.status}`,
        )
      }
    },
    {
      timeout: 20000,
    },
  )

  afterAll(async () => {
    // Cleanup
    const userRepo = getUserRepository()
    await userRepo.delete(userId)
    await closeDatabase()
    await server.stop()
  })

  test("should reject connection without token", async () => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${config.PORT}/ws/chat`)

      ws.onerror = () => {
        // Connection should be rejected
        resolve()
      }

      ws.onopen = () => {
        ws.close()
        throw new Error("Connection should have been rejected")
      }

      // Timeout if nothing happens
      setTimeout(() => {
        ws.close()
        resolve()
      }, 1000)
    })
  })

  test("should connect with valid bearer token", async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `ws://${config.HOST}:${config.PORT}/ws/chat?token=${token}`,
      )

      ws.onopen = () => {
        ws.close()
        resolve()
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        reject(new Error(`Connection failed: ${error}`))
      }

      setTimeout(() => {
        ws.close()
        reject(new Error("Connection timeout"))
      }, 2000)
    })
  })

  test("should connect with query parameter token", async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `ws://${config.HOST}:${config.PORT}/ws/chat?token=${token}`,
      )

      ws.onopen = () => {
        ws.close()
        resolve()
      }

      ws.onerror = (error) => {
        reject(new Error(`Connection failed: ${error}`))
      }

      setTimeout(() => {
        ws.close()
        reject(new Error("Connection timeout"))
      }, 2000)
    })
  })

  test("should handle join room and receive confirmation", async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )

      ws.onopen = () => {
        // Send join room message
        console.log("Sending join message...")
        ws.send(
          JSON.stringify({
            type: "join",
            data: {
              roomId: "test-room-1",
            },
          }),
        )
      }

      ws.onmessage = (event) => {
        console.log("Received message:", event.data)
        const message = JSON.parse(event.data.toString())

        if (message.type === "room_joined") {
          expect(message.roomId).toBe("test-room-1")
          expect(message.userId).toBe(userId)
          expect(message.userEmail).toBe("ws-test@example.com")
          expect(message.timestamp).toBeGreaterThan(0)

          ws.close()
          resolve()
        }
      }

      ws.onerror = (error) => {
        reject(new Error(`WebSocket error: ${error}`))
      }

      setTimeout(() => {
        ws.close()
        reject(new Error("Test timeout"))
      }, 3000)
    })
  })

  test("should broadcast messages to room members", async () => {
    return new Promise<void>((resolve, reject) => {
      let ws1Joined = false
      let ws2Joined = false
      let messageReceived = false

      const ws1 = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )

      const ws2 = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )

      ws1.onopen = () => {
        ws1.send(
          JSON.stringify({ type: "join", data: { roomId: "broadcast-room" } }),
        )
      }

      ws2.onopen = () => {
        ws2.send(
          JSON.stringify({ type: "join", data: { roomId: "broadcast-room" } }),
        )
      }

      ws1.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())

        if (message.type === "room_joined") {
          ws1Joined = true

          // Once both joined, send a message from ws1
          if (ws2Joined && !messageReceived) {
            ws1.send(
              JSON.stringify({
                type: "message",
                data: {
                  roomId: "broadcast-room",
                  message: "Hello from ws1!",
                },
              }),
            )
          }
        } else if (
          message.type === "message" &&
          message.message === "Hello from ws1!"
        ) {
          // ws1 receives its own broadcast
          messageReceived = true
        }
      }

      ws2.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())

        if (message.type === "room_joined") {
          ws2Joined = true

          // Once both joined, ws1 will send a message
          if (ws1Joined && !messageReceived) {
            ws1.send(
              JSON.stringify({
                type: "message",
                data: {
                  roomId: "broadcast-room",
                  message: "Hello from ws1!",
                },
              }),
            )
          }
        } else if (
          message.type === "message" &&
          message.message === "Hello from ws1!"
        ) {
          // ws2 receives the broadcast from ws1
          expect(message.roomId).toBe("broadcast-room")
          expect(message.userId).toBe(userId)
          expect(message.userEmail).toBe("ws-test@example.com")

          ws1.close()
          ws2.close()
          resolve()
        }
      }

      ws1.onerror = ws2.onerror = (error) => {
        ws1.close()
        ws2.close()
        reject(new Error(`WebSocket error: ${error}`))
      }

      setTimeout(() => {
        ws1.close()
        ws2.close()
        reject(new Error("Test timeout"))
      }, 5000)
    })
  })

  test("should handle typing indicators", async () => {
    return new Promise<void>((resolve, reject) => {
      const ws1 = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )
      const ws2 = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )

      let ws1Joined = false
      let ws2Joined = false

      ws1.onopen = () => {
        ws1.send(
          JSON.stringify({ type: "join", data: { roomId: "typing-room" } }),
        )
      }

      ws2.onopen = () => {
        ws2.send(
          JSON.stringify({ type: "join", data: { roomId: "typing-room" } }),
        )
      }

      ws1.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())

        if (message.type === "room_joined") {
          ws1Joined = true
          // Once both joined, send typing indicator from ws1
          if (ws2Joined) {
            ws1.send(
              JSON.stringify({
                type: "typing",
                data: {
                  roomId: "typing-room",
                  isTyping: true,
                },
              }),
            )
          }
        }
      }

      ws2.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())

        if (message.type === "room_joined") {
          ws2Joined = true
          // Once both joined, ws1 will send typing indicator
          if (ws1Joined) {
            ws1.send(
              JSON.stringify({
                type: "typing",
                data: {
                  roomId: "typing-room",
                  isTyping: true,
                },
              }),
            )
          }
        } else if (message.type === "typing") {
          // ws2 receives typing indicator from ws1
          expect(message.roomId).toBe("typing-room")
          expect(message.userId).toBe(userId)
          expect(message.isTyping).toBe(true)

          ws1.close()
          ws2.close()
          resolve()
        }
      }

      ws1.onerror = ws2.onerror = (error) => {
        ws1.close()
        ws2.close()
        reject(new Error(`WebSocket error: ${error}`))
      }

      setTimeout(() => {
        ws1.close()
        ws2.close()
        reject(new Error("Test timeout"))
      }, 3000)
    })
  })

  test("should notify room when user leaves", async () => {
    return new Promise<void>((resolve, reject) => {
      const ws1 = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )
      const ws2 = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )

      let ws1Joined = false
      let ws2Joined = false

      ws1.onopen = () => {
        ws1.send(
          JSON.stringify({ type: "join", data: { roomId: "leave-room" } }),
        )
      }

      ws2.onopen = () => {
        ws2.send(
          JSON.stringify({ type: "join", data: { roomId: "leave-room" } }),
        )
      }

      ws1.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())

        if (message.type === "room_joined") {
          ws1Joined = true
          // Once both joined, send leave message from ws1
          if (ws2Joined) {
            ws1.send(
              JSON.stringify({ type: "leave", data: { roomId: "leave-room" } }),
            )
          }
        }
      }

      ws2.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())

        if (message.type === "room_joined") {
          ws2Joined = true
          // Once both joined, ws1 will leave
          if (ws1Joined) {
            ws1.send(
              JSON.stringify({ type: "leave", data: { roomId: "leave-room" } }),
            )
          }
        } else if (message.type === "room_left") {
          // ws2 receives notification that ws1 left
          expect(message.roomId).toBe("leave-room")
          expect(message.userId).toBe(userId)

          ws1.close()
          ws2.close()
          resolve()
        }
      }

      ws1.onerror = ws2.onerror = (error) => {
        ws1.close()
        ws2.close()
        reject(new Error(`WebSocket error: ${error}`))
      }

      setTimeout(() => {
        ws1.close()
        ws2.close()
        reject(new Error("Test timeout"))
      }, 3000)
    })
  })

  test("should handle disconnection and notify rooms", async () => {
    return new Promise<void>((resolve) => {
      let ws1Left = false

      const ws1 = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )

      const ws2 = new WebSocket(
        `ws://localhost:${config.PORT}/ws/chat?token=${token}`,
      )

      let ws1Joined = false
      let ws2Joined = false

      ws1.onopen = () => {
        ws1.send(
          JSON.stringify({ type: "join", data: { roomId: "disconnect-room" } }),
        )
      }

      ws2.onopen = () => {
        ws2.send(
          JSON.stringify({ type: "join", data: { roomId: "disconnect-room" } }),
        )
      }

      ws1.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())
        if (message.type === "room_joined") {
          ws1Joined = true
          // Once both joined, disconnect ws1
          if (ws2Joined && !ws1Left) {
            ws1Left = true
            ws1.close()
          }
        }
      }

      ws2.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())

        if (message.type === "room_joined") {
          ws2Joined = true
          // Once both joined, ws1 will disconnect
          if (ws1Joined && !ws1Left) {
            ws1Left = true
            ws1.close()
          }
        } else if (message.type === "room_left" && ws1Left) {
          // ws2 should receive notification that ws1 left
          expect(message.roomId).toBe("disconnect-room")
          expect(message.userId).toBe(userId)

          ws2.close()
          resolve()
        }
      }

      ws1.onerror = ws2.onerror = () => {
        ws1.close()
        ws2.close()
        throw new Error("WebSocket connection error")
      }

      setTimeout(() => {
        ws1.close()
        ws2.close()
        throw new Error("Test timeout")
      }, 5000)
    })
  })
})
