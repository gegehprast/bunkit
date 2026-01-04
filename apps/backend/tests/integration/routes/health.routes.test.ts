import { describe, expect, test } from "bun:test"

describe("Health Routes", () => {
  const BASE_URL = `http://localhost:${process.env.PORT || 3099}`

  // Note: These tests require the server to be running
  // Run with: bun run dev (in another terminal)

  test.skip("GET /api/health should return 200 OK", async () => {
    const response = await fetch(`${BASE_URL}/api/health`)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/json")

    const data = await response.json()
    expect(data).toHaveProperty("status", "ok")
    expect(data).toHaveProperty("timestamp")
    expect(data).toHaveProperty("uptime")
    expect(typeof data.uptime).toBe("number")
  })

  test.skip("health response should have valid timestamp", async () => {
    const response = await fetch(`${BASE_URL}/api/health`)
    const data = await response.json()

    const timestamp = new Date(data.timestamp)
    expect(timestamp.toString()).not.toBe("Invalid Date")
  })
})
