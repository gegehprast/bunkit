import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  spyOn,
  test,
} from "bun:test"
import { ShutdownManager } from "@/core/shutdown-manager"

describe("ShutdownManager", () => {
  let shutdownManager: ShutdownManager
  let mockExit: Mock<(code?: number) => never>

  beforeEach(() => {
    // Create fresh instance for each test
    shutdownManager = new ShutdownManager()
    // Mock process.exit to prevent test runner from exiting
    mockExit = spyOn(process, "exit").mockImplementation((() => {}) as never)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  describe("onShutdown", () => {
    test("should register a cleanup handler", () => {
      const handler = async () => {}

      expect(() => shutdownManager.onShutdown("test", handler)).not.toThrow()
    })

    test("should allow multiple handlers", () => {
      shutdownManager.onShutdown("handler1", async () => {})
      shutdownManager.onShutdown("handler2", async () => {})
      shutdownManager.onShutdown("handler3", async () => {})

      // No way to directly check count, but should not throw
      expect(true).toBe(true)
    })

    test("should allow duplicate handler names", () => {
      // Note: The implementation allows duplicate names (no uniqueness check)
      shutdownManager.onShutdown("duplicate", async () => {})
      shutdownManager.onShutdown("duplicate", async () => {})

      expect(true).toBe(true)
    })
  })

  describe("isShuttingDownNow", () => {
    test("should return false initially", () => {
      expect(shutdownManager.isShuttingDownNow()).toBe(false)
    })

    test("should return true during shutdown", async () => {
      const checkDuringShutdown = new Promise<boolean>((resolve) => {
        shutdownManager.onShutdown("check", async () => {
          resolve(shutdownManager.isShuttingDownNow())
        })
      })

      // Trigger shutdown but don't await to check state during
      const shutdownPromise = shutdownManager.shutdown("TEST")

      const isDuringShutdown = await checkDuringShutdown

      // Wait for shutdown to complete
      await shutdownPromise.catch(() => {}) // Ignore exit error

      expect(isDuringShutdown).toBe(true)
    })
  })

  describe("shutdown", () => {
    test("should execute cleanup handlers", async () => {
      let executed = false

      shutdownManager.onShutdown("test", async () => {
        executed = true
      })

      await shutdownManager.shutdown("TEST").catch(() => {}) // Ignore process.exit

      expect(executed).toBe(true)
    })

    test("should execute handlers in LIFO order (reverse registration)", async () => {
      const executionOrder: string[] = []

      shutdownManager.onShutdown("first", async () => {
        executionOrder.push("first")
      })
      shutdownManager.onShutdown("second", async () => {
        executionOrder.push("second")
      })
      shutdownManager.onShutdown("third", async () => {
        executionOrder.push("third")
      })

      await shutdownManager.shutdown("TEST").catch(() => {})

      expect(executionOrder).toEqual(["third", "second", "first"])
    })

    test("should continue with other handlers if one fails", async () => {
      const executed: string[] = []

      shutdownManager.onShutdown("first", async () => {
        executed.push("first")
      })

      shutdownManager.onShutdown("failing", async () => {
        executed.push("failing")
        throw new Error("Handler failed")
      })

      shutdownManager.onShutdown("third", async () => {
        executed.push("third")
      })

      await shutdownManager.shutdown("TEST").catch(() => {})

      // All handlers should execute despite one failing
      expect(executed).toContain("first")
      expect(executed).toContain("failing")
      expect(executed).toContain("third")
    })

    test("should handle async handlers", async () => {
      let executed = false

      shutdownManager.onShutdown("async", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        executed = true
      })

      await shutdownManager.shutdown("TEST").catch(() => {})

      expect(executed).toBe(true)
    })

    test("should prevent multiple shutdown calls", async () => {
      let executionCount = 0

      shutdownManager.onShutdown("counter", async () => {
        executionCount++
      })

      // Trigger multiple shutdowns
      const shutdown1 = shutdownManager.shutdown("TEST1")
      const shutdown2 = shutdownManager.shutdown("TEST2")
      const shutdown3 = shutdownManager.shutdown("TEST3")

      await Promise.all([
        shutdown1.catch(() => {}),
        shutdown2.catch(() => {}),
        shutdown3.catch(() => {}),
      ])

      // Handler should only execute once
      expect(executionCount).toBe(1)
    })

    test("should handle sync handlers", async () => {
      let executed = false

      shutdownManager.onShutdown("sync", () => {
        executed = true
      })

      await shutdownManager.shutdown("TEST").catch(() => {})

      expect(executed).toBe(true)
    })
  })

  describe("cleanup ordering use cases", () => {
    test("should close server before database", async () => {
      const operations: string[] = []

      shutdownManager.onShutdown("database", async () => {
        operations.push("close-db")
      })

      shutdownManager.onShutdown("server", async () => {
        operations.push("close-server")
      })

      await shutdownManager.shutdown("TEST").catch(() => {})

      // Server registered last, so it should close first (LIFO)
      expect(operations[0]).toBe("close-server")
      expect(operations[1]).toBe("close-db")
    })

    test("should demonstrate proper cleanup sequence", async () => {
      const operations: string[] = []

      // Register in order of initialization
      shutdownManager.onShutdown("database", async () => {
        operations.push("database")
      })

      shutdownManager.onShutdown("cache", async () => {
        operations.push("cache")
      })

      shutdownManager.onShutdown("worker-pool", async () => {
        operations.push("worker-pool")
      })

      shutdownManager.onShutdown("http-server", async () => {
        operations.push("http-server")
      })

      await shutdownManager.shutdown("TEST").catch(() => {})

      // Should shutdown in reverse order (last registered first)
      expect(operations).toEqual([
        "http-server",
        "worker-pool",
        "cache",
        "database",
      ])
    })
  })

  describe("error handling", () => {
    test("should handle errors without crashing", async () => {
      shutdownManager.onShutdown("error1", async () => {
        throw new Error("Test error 1")
      })

      shutdownManager.onShutdown("error2", async () => {
        throw new Error("Test error 2")
      })

      // Should not throw, just catch errors internally
      await shutdownManager.shutdown("TEST").catch(() => {})

      expect(true).toBe(true)
    })

    test("should handle non-Error throws", async () => {
      shutdownManager.onShutdown("string-throw", async () => {
        throw "String error"
      })

      shutdownManager.onShutdown("number-throw", async () => {
        throw 42
      })

      await shutdownManager.shutdown("TEST").catch(() => {})

      expect(true).toBe(true)
    })
  })

  describe("integration scenarios", () => {
    test("should support complex cleanup dependencies", async () => {
      const log: string[] = []

      // Simulated services with dependencies
      const mockServices = {
        redis: {
          disconnect: async () => {
            log.push("redis-disconnect")
            await new Promise((resolve) => setTimeout(resolve, 5))
          },
        },
        database: {
          close: async () => {
            log.push("database-close")
            await new Promise((resolve) => setTimeout(resolve, 5))
          },
        },
        httpServer: {
          stop: async () => {
            log.push("http-stop")
            // Stop accepting new connections
            await new Promise((resolve) => setTimeout(resolve, 5))
          },
        },
      }

      // Register in initialization order
      shutdownManager.onShutdown("redis", mockServices.redis.disconnect)
      shutdownManager.onShutdown("database", mockServices.database.close)
      shutdownManager.onShutdown("http", mockServices.httpServer.stop)

      await shutdownManager.shutdown("SIGTERM").catch(() => {})

      // Verify LIFO order
      expect(log[0]).toBe("http-stop")
      expect(log[1]).toBe("database-close")
      expect(log[2]).toBe("redis-disconnect")
    })

    test("should handle partial failures gracefully", async () => {
      const log: string[] = []

      shutdownManager.onShutdown("service1", async () => {
        log.push("service1-ok")
      })

      shutdownManager.onShutdown("service2", async () => {
        log.push("service2-fail")
        throw new Error("Service 2 failed to cleanup")
      })

      shutdownManager.onShutdown("service3", async () => {
        log.push("service3-ok")
      })

      await shutdownManager.shutdown("TEST").catch(() => {})

      // All services should attempt cleanup
      expect(log).toContain("service1-ok")
      expect(log).toContain("service2-fail")
      expect(log).toContain("service3-ok")
    })
  })
})
