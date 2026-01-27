import { createServer, SecuritySchemes } from "@bunkit/server"
import { config } from "@/config"
import { loggingMiddleware } from "@/middlewares/logging.middleware"

export const server = createServer({
  port: config.PORT,
  host: config.HOST,
  maxRequestBodySize: config.HTTP_MAX_REQUEST_BODY_SIZE,
  globalMiddlewares: [loggingMiddleware()],
  openapi: {
    title: "BunKit API",
    version: "1.0.0",
    description: "Production-ready HTTP API built with BunKit",
    securitySchemes: {
      bearerAuth: SecuritySchemes.bearerAuth(),
      basicAuth: SecuritySchemes.basicAuth(), // Example only, not used
      cookieAuth: SecuritySchemes.apiKeyCookie(
        "access_token",
        "HTTP-only cookie authentication",
      ), // Example only, not used
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}`,
        description: "Development server",
      },
      {
        url: `http://0.0.0.0:${config.PORT}`,
        description: "Development server",
      },
      {
        url: `http://127.0.0.1:${config.PORT}`,
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
