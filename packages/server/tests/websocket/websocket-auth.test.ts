import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import {
  createTokenAuth,
  extractBearerToken,
  extractQueryToken,
  extractRequestInfo,
  extractToken,
  noAuth,
} from "../../src/websocket/websocket-auth"
import { webSocketRouteRegistry } from "../../src/websocket/websocket-registry"
import { createWebSocketRoute } from "../../src/websocket/websocket-route-builder"

describe("WebSocket Authentication Utilities", () => {
  beforeEach(() => {
    webSocketRouteRegistry.clear()
  })

  describe("extractBearerToken", () => {
    it("should extract token from Bearer header", () => {
      const req = new Request("http://localhost/ws", {
        headers: { Authorization: "Bearer mytoken123" },
      })

      const token = extractBearerToken(req)

      expect(token).toBe("mytoken123")
    })

    it("should handle lowercase bearer prefix", () => {
      const req = new Request("http://localhost/ws", {
        headers: { Authorization: "bearer mytoken456" },
      })

      const token = extractBearerToken(req)

      expect(token).toBe("mytoken456")
    })

    it("should return null when no Authorization header", () => {
      const req = new Request("http://localhost/ws")

      const token = extractBearerToken(req)

      expect(token).toBeNull()
    })

    it("should return null when Authorization header has no Bearer prefix", () => {
      const req = new Request("http://localhost/ws", {
        headers: { Authorization: "Basic abc123" },
      })

      const token = extractBearerToken(req)

      expect(token).toBeNull()
    })

    it("should support custom header name", () => {
      const req = new Request("http://localhost/ws", {
        headers: { "X-Auth-Token": "Bearer customtoken" },
      })

      const token = extractBearerToken(req, "x-auth-token")

      expect(token).toBe("customtoken")
    })
  })

  describe("extractQueryToken", () => {
    it("should extract token from query parameter", () => {
      const req = new Request("http://localhost/ws?token=querytoken123")

      const token = extractQueryToken(req)

      expect(token).toBe("querytoken123")
    })

    it("should return null when no token parameter", () => {
      const req = new Request("http://localhost/ws?other=value")

      const token = extractQueryToken(req)

      expect(token).toBeNull()
    })

    it("should support custom parameter name", () => {
      const req = new Request("http://localhost/ws?auth=customauth")

      const token = extractQueryToken(req, "auth")

      expect(token).toBe("customauth")
    })

    it("should handle URL-encoded tokens", () => {
      const req = new Request(
        "http://localhost/ws?token=" +
          encodeURIComponent("token/with+special=chars"),
      )

      const token = extractQueryToken(req)

      expect(token).toBe("token/with+special=chars")
    })

    it("should return null for empty token value", () => {
      const req = new Request("http://localhost/ws?token=")

      const token = extractQueryToken(req)

      expect(token).toBeNull()
    })
  })

  describe("extractToken", () => {
    it("should prefer header over query parameter", () => {
      const req = new Request("http://localhost/ws?token=querytoken", {
        headers: { Authorization: "Bearer headertoken" },
      })

      const result = extractToken(req)

      expect(result).not.toBeNull()
      expect(result?.token).toBe("headertoken")
      expect(result?.source).toBe("header")
    })

    it("should fall back to query parameter when no header", () => {
      const req = new Request("http://localhost/ws?token=fallbacktoken")

      const result = extractToken(req)

      expect(result).not.toBeNull()
      expect(result?.token).toBe("fallbacktoken")
      expect(result?.source).toBe("query")
    })

    it("should return null when no token found", () => {
      const req = new Request("http://localhost/ws")

      const result = extractToken(req)

      expect(result).toBeNull()
    })

    it("should only check query when checkHeader is false", () => {
      const req = new Request("http://localhost/ws?token=queryonly", {
        headers: { Authorization: "Bearer headertoken" },
      })

      const result = extractToken(req, { checkHeader: false })

      expect(result).not.toBeNull()
      expect(result?.token).toBe("queryonly")
      expect(result?.source).toBe("query")
    })

    it("should only check header when checkQuery is false", () => {
      const req = new Request("http://localhost/ws?token=querytoken")

      const result = extractToken(req, { checkQuery: false })

      expect(result).toBeNull()
    })

    it("should use custom header and query param names", () => {
      const req = new Request("http://localhost/ws?auth=customquery", {
        headers: { "X-Token": "Bearer customheader" },
      })

      const result = extractToken(req, {
        headerName: "x-token",
        queryParamName: "auth",
      })

      expect(result?.token).toBe("customheader")
      expect(result?.source).toBe("header")
    })
  })

  describe("createTokenAuth", () => {
    it("should create auth function that validates tokens", async () => {
      interface User {
        id: string
        name: string
      }

      const verifyToken = (token: string): User | null => {
        if (token === "valid-token") {
          return { id: "user-1", name: "John" }
        }
        return null
      }

      const auth = createTokenAuth(verifyToken)

      const validReq = new Request("http://localhost/ws", {
        headers: { Authorization: "Bearer valid-token" },
      })
      const invalidReq = new Request("http://localhost/ws", {
        headers: { Authorization: "Bearer invalid-token" },
      })

      const validUser = await auth(validReq)
      const invalidUser = await auth(invalidReq)

      expect(validUser).toEqual({ id: "user-1", name: "John" })
      expect(invalidUser).toBeNull()
    })

    it("should handle async token verification", async () => {
      const verifyToken = async (token: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        if (token === "async-valid") {
          return { id: "async-user" }
        }
        return null
      }

      const auth = createTokenAuth(verifyToken)

      const req = new Request("http://localhost/ws", {
        headers: { Authorization: "Bearer async-valid" },
      })

      const user = await auth(req)

      expect(user).toEqual({ id: "async-user" })
    })

    it("should handle token verification that throws", async () => {
      const verifyToken = (token: string) => {
        if (token === "error-token") {
          throw new Error("Verification failed")
        }
        return { id: "user" }
      }

      const auth = createTokenAuth(verifyToken)

      const req = new Request("http://localhost/ws", {
        headers: { Authorization: "Bearer error-token" },
      })

      const user = await auth(req)

      expect(user).toBeNull()
    })

    it("should return null when no token present", async () => {
      const verifyToken = () => ({ id: "user" })

      const auth = createTokenAuth(verifyToken)

      const req = new Request("http://localhost/ws")

      const user = await auth(req)

      expect(user).toBeNull()
    })

    it("should use custom token extraction options", async () => {
      const verifyToken = (token: string) => ({ token })

      const auth = createTokenAuth(verifyToken, {
        checkHeader: false,
        queryParamName: "session",
      })

      const req = new Request("http://localhost/ws?session=session-token", {
        headers: { Authorization: "Bearer header-token" },
      })

      const user = await auth(req)

      expect(user).toEqual({ token: "session-token" })
    })
  })

  describe("noAuth", () => {
    it("should always return null", () => {
      const auth = noAuth()

      const req = new Request("http://localhost/ws")

      const result = auth(req)

      expect(result).toBeNull()
    })
  })

  describe("extractRequestInfo", () => {
    it("should extract request metadata", () => {
      const auth = extractRequestInfo()

      const req = new Request("http://localhost/ws", {
        headers: {
          Origin: "http://example.com",
          "User-Agent": "TestClient/1.0",
          "X-Forwarded-For": "192.168.1.1, 10.0.0.1",
        },
      })

      const info = auth(req)

      expect(info.origin).toBe("http://example.com")
      expect(info.userAgent).toBe("TestClient/1.0")
      expect(info.ip).toBe("192.168.1.1")
    })

    it("should use X-Real-IP when X-Forwarded-For is not present", () => {
      const auth = extractRequestInfo()

      const req = new Request("http://localhost/ws", {
        headers: {
          "X-Real-IP": "172.16.0.1",
        },
      })

      const info = auth(req)

      expect(info.ip).toBe("172.16.0.1")
    })

    it("should handle missing headers", () => {
      const auth = extractRequestInfo()

      const req = new Request("http://localhost/ws")

      const info = auth(req)

      expect(info.origin).toBeNull()
      expect(info.userAgent).toBeNull()
      expect(info.ip).toBeNull()
    })
  })
})

describe("WebSocket Route Builder Authentication", () => {
  beforeEach(() => {
    webSocketRouteRegistry.clear()
  })

  it("should register route with authentication function", () => {
    interface User {
      id: string
    }

    const authFn = async (req: Request): Promise<User | null> => {
      const token = extractBearerToken(req)
      if (token === "valid") {
        return { id: "user-1" }
      }
      return null
    }

    const route = createWebSocketRoute("/api/protected")
      .authenticate(authFn)
      .build()

    expect(route.authFn).toBeDefined()
    expect(route.path).toBe("/api/protected")
  })

  it("should allow chaining after authenticate", () => {
    const authFn = () => ({ id: "user" })

    const route = createWebSocketRoute("/api/chat")
      .authenticate(authFn)
      .serverMessages<{ type: "msg"; text: string }>()
      .onConnect(() => {})
      .onClose(() => {})
      .build()

    expect(route.authFn).toBeDefined()
    expect(route.connectHandler).toBeDefined()
    expect(route.closeHandler).toBeDefined()
  })

  it("should preserve user type through handler chain", () => {
    interface MyUser {
      id: string
      role: "admin" | "user"
    }

    const authFn = (_req: Request): MyUser | null => {
      return { id: "user-1", role: "admin" }
    }

    // This test verifies type inference works - TypeScript will error if types don't flow
    createWebSocketRoute("/api/admin")
      .authenticate(authFn)
      .onConnect((_ws, ctx) => {
        // ctx.user should be MyUser | undefined
        const user = ctx.user
        if (user) {
          const _role: "admin" | "user" = user.role
        }
      })
      .build()
  })
})

describe("WebSocket Route Builder Path Parameters", () => {
  beforeEach(() => {
    webSocketRouteRegistry.clear()
  })

  it("should match route with single parameter", () => {
    createWebSocketRoute("/api/rooms/:roomId").build()

    const matched = webSocketRouteRegistry.match("/api/rooms/general")

    expect(matched).not.toBeNull()
    expect(matched?.params.roomId).toBe("general")
  })

  it("should match route with multiple parameters", () => {
    createWebSocketRoute("/api/orgs/:orgId/rooms/:roomId").build()

    const matched = webSocketRouteRegistry.match("/api/orgs/acme/rooms/support")

    expect(matched).not.toBeNull()
    expect(matched?.params.orgId).toBe("acme")
    expect(matched?.params.roomId).toBe("support")
  })

  it("should not match when parameter count differs", () => {
    createWebSocketRoute("/api/rooms/:roomId").build()

    const matched = webSocketRouteRegistry.match("/api/rooms/general/extra")

    expect(matched).toBeNull()
  })

  it("should not match when static segments differ", () => {
    createWebSocketRoute("/api/rooms/:roomId").build()

    const matched = webSocketRouteRegistry.match("/api/channels/general")

    expect(matched).toBeNull()
  })

  it("should handle URL-encoded parameter values", () => {
    createWebSocketRoute("/api/rooms/:roomId").build()

    const matched = webSocketRouteRegistry.match(
      `/api/rooms/${encodeURIComponent("room with spaces")}`,
    )

    expect(matched).not.toBeNull()
    expect(matched?.params.roomId).toBe("room%20with%20spaces")
  })
})

describe("WebSocket Context Management", () => {
  afterEach(() => {
    webSocketRouteRegistry.clear()
  })

  it("should include params in route definition", () => {
    createWebSocketRoute("/api/rooms/:roomId/members/:memberId").build()

    const matched = webSocketRouteRegistry.match(
      "/api/rooms/lobby/members/user123",
    )

    expect(matched).not.toBeNull()
    expect(matched?.params).toEqual({
      roomId: "lobby",
      memberId: "user123",
    })
  })
})
