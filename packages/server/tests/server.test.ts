import { describe, expect, test } from "bun:test"
import { createServer } from "../src"

describe("Server", () => {
  test("should create server instance", () => {
    const server = createServer({ port: 3001 })
    expect(server).toBeDefined()
    expect(server.start).toBeDefined()
    expect(server.stop).toBeDefined()
    expect(server.http.getOpenApiSpec).toBeDefined()
    expect(server.http.exportOpenApiSpec).toBeDefined()
    expect(server.ws.publish).toBeDefined()
    expect(server.ws.publishBinary).toBeDefined()
  })

  test("should accept server configuration options", () => {
    const server = createServer({
      port: 4000,
      host: "localhost",
      development: true,
    })
    expect(server).toBeDefined()
  })

  test("should support CORS configuration", () => {
    const server = createServer({
      cors: {
        origin: "*",
        credentials: true,
      },
    })
    expect(server).toBeDefined()
  })

  test("should support WebSocket configuration", () => {
    const server = createServer({
      websocket: {
        maxPayloadLength: 1024 * 1024,
        idleTimeout: 60,
        compression: true,
      },
    })
    expect(server).toBeDefined()
  })

  test("should support OpenAPI configuration", () => {
    const server = createServer({
      openapi: {
        title: "Test API",
        version: "1.0.0",
        description: "API for testing",
      },
    })
    expect(server).toBeDefined()
  })
})
