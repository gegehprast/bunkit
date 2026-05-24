import { createRoute } from "@bunkit/server"
import { logger } from "@/core/logger"
import { testReceiverRepository } from "@/db/repositories/test-receiver-repository"

const captureLogger = logger.child({ component: "TestReceiver" })

/**
 * Capture endpoint for test delivery targets.
 *
 * The delivery worker POSTs to this URL when delivering to a test target.
 * We store the full request (headers + body) so the user can inspect
 * exactly what the gateway sent, including outbound signing headers.
 *
 * No authentication — the token in the URL is the secret.
 */
createRoute("POST", "/hooks/test/:token")
  .excludeFromDocs()
  .handler(async ({ req, params, res }) => {
    const receiverResult = testReceiverRepository.findByToken(params.token)
    if (!receiverResult.isOk() || !receiverResult.value) {
      return res.notFound("Not found")
    }

    const body = await req.text().catch(() => "")

    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
    })

    const createResult = testReceiverRepository.createRequest({
      receiverId: receiverResult.value.id,
      method: req.method,
      headers,
      body,
    })

    if (!createResult.isOk()) {
      captureLogger.warn("Failed to capture test receiver request", {
        token: params.token,
        error: createResult.error.message,
      })
    }

    return res.ok({ received: true })
  })
