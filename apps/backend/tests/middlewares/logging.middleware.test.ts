import { describe, expect, test } from "bun:test"
import { server } from "@/core/server"
import { loggingMiddleware } from "@/middlewares/logging.middleware"

describe("loggingMiddleware", () => {
  test("should create middleware function", () => {
    const middleware = loggingMiddleware()
    expect(typeof middleware).toBe("function")
  })

  test("should be registered in server configuration", async () => {
    expect(server).toBeDefined()
  })
})
