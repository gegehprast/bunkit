import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { createTestServer, type TestServer } from "../test-server"

describe("Health Routes", () => {
  let testServer: TestServer
  let BASE_URL: string

  beforeAll(async () => {
    testServer = await createTestServer()
    const startResult = await testServer.start()
    if (startResult.isErr()) {
      throw new Error(
        `Failed to start test server: ${startResult.error.message}`,
      )
    }
    BASE_URL = testServer.getBaseUrl()
  })

  afterAll(async () => {
    await testServer.stop()
  })

  test("GET /api/health should return 200 OK", async () => {
    const response = await fetch(`${BASE_URL}/api/health`)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/json")

    const data = (await response.json()) as {
      status: string
      timestamp: string
      uptime: number
    }
    expect(data).toHaveProperty("status", "ok")
    expect(data).toHaveProperty("timestamp")
    expect(data).toHaveProperty("uptime")
    expect(typeof data.uptime).toBe("number")
  })

  test("health response should have valid timestamp", async () => {
    const response = await fetch(`${BASE_URL}/api/health`)
    const data = (await response.json()) as { timestamp: string }

    const timestamp = new Date(data.timestamp)
    expect(timestamp.toString()).not.toBe("Invalid Date")
  })
})
