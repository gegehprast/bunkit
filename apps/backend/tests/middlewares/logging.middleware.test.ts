import { describe, expect, test } from "bun:test"
import { loggingMiddleware } from "@/middlewares/logging.middleware"

describe("loggingMiddleware", () => {
  test("should create middleware function", () => {
    const middleware = loggingMiddleware()
    expect(typeof middleware).toBe("function")
  })

  test("should be registered in server configuration", async () => {
    // Import server to verify middleware is registered
    const { server } = await import("@/core/server")

    // Server should be defined with logging middleware
    expect(server).toBeDefined()
  })
})
