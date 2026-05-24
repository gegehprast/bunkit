import { createHash } from "node:crypto"
import {
  createWebSocketRoute,
  extractBearerToken,
  extractQueryToken,
} from "@bunkit/server"
import { z } from "zod"
import { apiKeyRepository } from "@/db/repositories/api-key-repository"

const EventMessageSchema = z.object({
  type: z.literal("event"),
  data: z.object({
    id: z.string().uuid(),
    endpointId: z.string().uuid(),
    method: z.string(),
    sourceIp: z.string().nullable(),
    signingScheme: z.string(),
    signatureVerified: z.boolean(),
    receivedAt: z.string().datetime(),
  }),
})

const PingSchema = z.object({ type: z.literal("ping") })
const PongSchema = z.object({ type: z.literal("pong") })

export const WS_EVENTS_TOPIC = "events"

createWebSocketRoute("/ws/events")
  .authenticate(async (req) => {
    // Accept token from Authorization header, query param, or auth_token cookie
    let rawKey = extractBearerToken(req) ?? extractQueryToken(req, "token")
    if (!rawKey) {
      const cookie = req.headers.get("cookie")
      const match = cookie?.match(/(?:^|;\s*)auth_token=([^;]+)/)
      if (match?.[1]) rawKey = decodeURIComponent(match[1])
    }
    if (!rawKey) return null

    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const result = apiKeyRepository.validate(keyHash)
    if (!result.isOk() || !result.value) return null

    return { apiKeyId: result.value.id }
  })
  .serverMessages(
    z.discriminatedUnion("type", [EventMessageSchema, PongSchema]),
  )
  .onConnect((ws) => {
    ws.subscribe(WS_EVENTS_TOPIC)
    ws.send({ type: "pong" })
  })
  .on("ping", PingSchema, (ws) => {
    ws.send({ type: "pong" })
  })
  .onClose((_ws) => {
    // Bun automatically cleans up subscriptions on close
  })
  .build()
