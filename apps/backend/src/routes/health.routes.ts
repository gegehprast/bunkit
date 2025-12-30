import { createRoute } from "@bunkit/server"
import { z } from "zod"

const HealthResponseSchema = z
  .object({
    status: z.literal("ok").meta({ example: "ok" }),
    timestamp: z.string().meta({ example: new Date().toISOString() }),
    uptime: z.number().meta({ example: 123.456 }),
  })
  .meta({
    id: "HealthResponse",
    title: "Health Check Response",
    description: "Health check response indicating service status",
  })

/**
 * Health check endpoint
 */
createRoute("GET", "/api/health")
  .openapi({
    operationId: "healthCheck",
    summary: "Health check",
    description: "Returns the health status of the API",
    tags: ["System"],
  })
  .response(HealthResponseSchema)
  .handler(({ res }) => {
    return res.ok({
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  })
