import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { config } from "@/config"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { testReceiverRepository } from "@/db/repositories/test-receiver-repository"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import type { TestReceiver } from "@/db/schemas"
import { apiKeyMiddleware } from "@/middlewares/api-key.middleware"

const TestReceiverSchema = z
  .object({
    id: z.string().uuid(),
    endpointId: z.string().uuid(),
    targetId: z.string().uuid(),
    token: z.string(),
    name: z.string(),
    url: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "TestReceiver" })

const TestReceiverRequestSchema = z
  .object({
    id: z.string().uuid(),
    receiverId: z.string().uuid(),
    method: z.string(),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
    receivedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: "TestReceiverRequest" })

const CreateTestReceiverSchema = z.object({
  name: z.string().min(1).max(100),
})

function formatReceiver(r: TestReceiver, url: string) {
  return {
    id: r.id,
    endpointId: r.endpointId,
    targetId: r.targetId,
    token: r.token,
    name: r.name,
    url,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

function makeReceiverUrl(token: string): string {
  return `${config.APP_URL}/hooks/test/${token}`
}

// ---------------------------------------------------------------------------
// POST /api/endpoints/:endpointId/targets/test
// ---------------------------------------------------------------------------
createRoute("POST", "/api/endpoints/:endpointId/targets/test")
  .openapi({
    operationId: "createTestReceiver",
    summary: "Create test delivery target",
    description:
      "Creates a delivery target that points to a built-in capture endpoint on this server. Use it to inspect exactly what the gateway sends to your service.",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .body(CreateTestReceiverSchema)
  .response(TestReceiverSchema)
  .handler(({ params, body, res }) => {
    const endpoint = webhookEndpointRepository.findById(params.endpointId)
    if (!endpoint.isOk())
      return res.internalError(endpoint.error.message, endpoint.error.code)
    if (!endpoint.value) return res.notFound("Endpoint not found")

    const token = crypto.randomUUID().replace(/-/g, "")

    // Create the delivery target pointing to our own capture endpoint
    const targetResult = deliveryTargetRepository.create({
      endpointId: params.endpointId,
      name: body.name,
      url: makeReceiverUrl(token),
      maxRetries: 0,
      retryBackoffSeconds: 60,
      throttleRps: null,
      outboundSigningScheme: "none",
      outboundSigningSecret: null,
      headers: null,
      enabled: true,
      isTest: true,
    })
    if (!targetResult.isOk())
      return res.internalError(
        targetResult.error.message,
        targetResult.error.code,
      )

    // Create the test receiver linking token to target
    const receiverResult = testReceiverRepository.create({
      endpointId: params.endpointId,
      targetId: targetResult.value.id,
      token,
      name: body.name,
    })
    if (!receiverResult.isOk())
      return res.internalError(
        receiverResult.error.message,
        receiverResult.error.code,
      )

    return res.created(
      formatReceiver(
        receiverResult.value,
        makeReceiverUrl(receiverResult.value.token),
      ),
    )
  })

// ---------------------------------------------------------------------------
// GET /api/endpoints/:endpointId/targets/test
// ---------------------------------------------------------------------------
createRoute("GET", "/api/endpoints/:endpointId/targets/test")
  .openapi({
    operationId: "listTestReceivers",
    summary: "List test delivery targets",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .response(z.array(TestReceiverSchema))
  .handler(({ params, res }) => {
    const endpoint = webhookEndpointRepository.findById(params.endpointId)
    if (!endpoint.isOk())
      return res.internalError(endpoint.error.message, endpoint.error.code)
    if (!endpoint.value) return res.notFound("Endpoint not found")

    const result = testReceiverRepository.listByEndpoint(params.endpointId)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)

    return res.ok(
      result.value.map((r) => formatReceiver(r, makeReceiverUrl(r.token))),
    )
  })

// ---------------------------------------------------------------------------
// DELETE /api/endpoints/:endpointId/targets/test/:receiverId
// ---------------------------------------------------------------------------
createRoute("DELETE", "/api/endpoints/:endpointId/targets/test/:receiverId")
  .openapi({
    operationId: "deleteTestReceiver",
    summary: "Delete test delivery target",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .handler(({ params, res }) => {
    const receiver = testReceiverRepository.findById(params.receiverId)
    if (!receiver.isOk())
      return res.internalError(receiver.error.message, receiver.error.code)
    if (!receiver.value) return res.notFound("Test receiver not found")

    // Delete the delivery target (cascades to test_receivers via FK)
    const targetResult = deliveryTargetRepository.delete(
      receiver.value.targetId,
    )
    if (!targetResult.isOk())
      return res.internalError(
        targetResult.error.message,
        targetResult.error.code,
      )

    return res.noContent()
  })

// ---------------------------------------------------------------------------
// GET /api/endpoints/:endpointId/targets/test/:receiverId/requests
// ---------------------------------------------------------------------------
createRoute(
  "GET",
  "/api/endpoints/:endpointId/targets/test/:receiverId/requests",
)
  .openapi({
    operationId: "listTestReceiverRequests",
    summary: "List captured requests for a test delivery target",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .response(z.array(TestReceiverRequestSchema))
  .handler(({ params, res }) => {
    const receiver = testReceiverRepository.findById(params.receiverId)
    if (!receiver.isOk())
      return res.internalError(receiver.error.message, receiver.error.code)
    if (!receiver.value) return res.notFound("Test receiver not found")

    const result = testReceiverRepository.listRequests(params.receiverId)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)

    return res.ok(
      result.value.map((r) => ({
        id: r.id,
        receiverId: r.receiverId,
        method: r.method,
        headers: r.headers as Record<string, string>,
        body: r.body,
        receivedAt: r.receivedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    )
  })

// ---------------------------------------------------------------------------
// DELETE /api/endpoints/:endpointId/targets/test/:receiverId/requests
// ---------------------------------------------------------------------------
createRoute(
  "DELETE",
  "/api/endpoints/:endpointId/targets/test/:receiverId/requests",
)
  .openapi({
    operationId: "clearTestReceiverRequests",
    summary: "Clear captured requests for a test delivery target",
    tags: ["Targets"],
  })
  .middlewares(apiKeyMiddleware())
  .handler(({ params, res }) => {
    const receiver = testReceiverRepository.findById(params.receiverId)
    if (!receiver.isOk())
      return res.internalError(receiver.error.message, receiver.error.code)
    if (!receiver.value) return res.notFound("Test receiver not found")

    const result = testReceiverRepository.deleteRequests(params.receiverId)
    if (!result.isOk())
      return res.internalError(result.error.message, result.error.code)

    return res.noContent()
  })
