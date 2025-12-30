import { err, ok, type Result } from "@bunkit/result"
import { createCorsMiddleware } from "./cors"
import { handleRequest } from "./request-handler"
import type { MiddlewareFn } from "./types/middleware"
import type {
  OpenApiSpec,
  Server,
  ServerOptions,
  ServerStartError,
  ServerStopError,
} from "./types/server"

/**
 * Create a new HTTP server
 */
export function createServer(options: ServerOptions = {}): Server {
  const {
    port = 3000,
    host = "0.0.0.0",
    development = false,
    cors,
    globalMiddlewares = [],
  } = options

  let server: ReturnType<typeof Bun.serve> | null = null

  // Build middleware chain with CORS if enabled
  const middlewares: MiddlewareFn[] = []

  if (cors) {
    const corsMiddleware = createCorsMiddleware(cors)
    middlewares.push(corsMiddleware as unknown as MiddlewareFn)
  }

  middlewares.push(...globalMiddlewares)

  return {
    async start(): Promise<Result<void, ServerStartError>> {
      try {
        server = Bun.serve({
          port,
          hostname: host,
          development,
          async fetch(request: Request): Promise<Response> {
            return handleRequest(request, middlewares)
          },
          error(error: Error): Response {
            console.error("Server error:", error)
            return new Response(
              JSON.stringify({
                message: "Internal Server Error",
                code: "SERVER_ERROR",
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            )
          },
        })

        console.log(`Server started on http://${host}:${port}`)
        return ok(undefined)
      } catch (error) {
        return err({
          name: "ServerStartError",
          message: `Failed to start server: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "SERVER_START_ERROR",
          cause: error instanceof Error ? error : undefined,
        } as ServerStartError)
      }
    },

    async stop(): Promise<Result<void, ServerStopError>> {
      try {
        if (server) {
          server.stop()
          server = null
          console.log("Server stopped")
        }
        return ok(undefined)
      } catch (error) {
        return err({
          name: "ServerStopError",
          message: `Failed to stop server: ${error instanceof Error ? error.message : "Unknown error"}`,
          code: "SERVER_STOP_ERROR",
          cause: error instanceof Error ? error : undefined,
        } as ServerStopError)
      }
    },

    getOpenApiSpec(): OpenApiSpec {
      const { generateOpenApiSpec } = require("./openapi/generator")
      return generateOpenApiSpec()
    },

    async exportOpenApiSpec(path: string): Promise<Result<void, Error>> {
      try {
        const spec = this.getOpenApiSpec()
        await Bun.write(path, JSON.stringify(spec, null, 2))
        console.log(`OpenAPI spec exported to ${path}`)
        return ok(undefined)
      } catch (error) {
        return err(
          error instanceof Error
            ? error
            : new Error("Failed to export OpenAPI spec"),
        )
      }
    },
  }
}
