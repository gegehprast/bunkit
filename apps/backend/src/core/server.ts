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
})
