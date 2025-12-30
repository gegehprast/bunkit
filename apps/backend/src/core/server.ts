import { createServer, SecuritySchemes } from "@bunkit/server"
import { config } from "@/config"

export const server = createServer({
  port: config.PORT,
  host: config.HOST,
  openapi: {
    title: "BunKit API",
    version: "1.0.0",
    description: "Production-ready HTTP API built with BunKit",
    securitySchemes: {
      bearerAuth: SecuritySchemes.bearerAuth(),
      basicAuth: SecuritySchemes.basicAuth(),
    },
  },
  cors: {
    origin: (origin) => {
      console.log("CORS origin check:", origin)
      const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim())
      return allowedOrigins.includes(origin)
    },
    credentials: true,
  },
})
