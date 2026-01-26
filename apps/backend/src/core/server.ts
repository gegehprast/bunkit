import { createServer, SecuritySchemes } from "@bunkit/server"
import { config } from "@/config"
import { loggingMiddleware } from "@/middlewares/logging.middleware"

export const server = createServer({
  port: config.PORT,
  host: config.HOST,
  globalMiddlewares: [loggingMiddleware()],
  openapi: {
    title: "BunKit API",
    version: "1.0.0",
    description: "Production-ready HTTP API built with BunKit",
    securitySchemes: {
      bearerAuth: SecuritySchemes.bearerAuth(),
      basicAuth: SecuritySchemes.basicAuth(),
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}`,
        description: "Development server",
      },
      {
        url: config.APP_URL,
        description: "Production server",
      },
    ],
  },
  cors: {
    origin: (origin) => {
      const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim())
      return allowedOrigins.includes(origin)
    },
    credentials: true,
  },
})
