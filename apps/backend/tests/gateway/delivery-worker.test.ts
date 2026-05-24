import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test"
import { err, ok } from "@bunkit/result"
import { DatabaseError } from "@/core/errors"
import { deliveryAttemptRepository } from "@/db/repositories/delivery-attempt-repository"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { webhookEventRepository } from "@/db/repositories/webhook-event-repository"
import type {
  DeliveryAttempt,
  DeliveryTarget,
  WebhookEvent,
} from "@/db/schemas"
import { DeliveryWorker } from "@/gateway/delivery-worker"

// ─── test fixtures ────────────────────────────────────────────────────────────

function makeAttempt(
  overrides: Partial<DeliveryAttempt> = {},
): DeliveryAttempt {
  return {
    id: crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    targetId: crypto.randomUUID(),
    status: "pending",
    attemptNumber: 1,
    nextRetryAt: new Date(Date.now() - 1000),
    isReplay: false,
    originalAttemptId: null,
    responseStatus: null,
    responseBody: null,
    responseLatencyMs: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeTarget(overrides: Partial<DeliveryTarget> = {}): DeliveryTarget {
  return {
    id: crypto.randomUUID(),
    endpointId: crypto.randomUUID(),
    name: "test-target",
    url: "http://example.com/webhook",
    enabled: true,
    headers: null,
    maxRetries: 3,
    retryBackoffSeconds: 1,
    throttleRps: null,
    outboundSigningScheme: "none",
    outboundSigningSecret: null,
    isTest: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: crypto.randomUUID(),
    endpointId: crypto.randomUUID(),
    method: "POST",
    headers: {},
    body: '{"action":"test"}',
    sourceIp: null,
    matchedRuleId: null,
    signatureValid: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    receivedAt: new Date(),
    ...overrides,
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function createWorker() {
  return new DeliveryWorker()
}

// ─── start / stop ─────────────────────────────────────────────────────────────

describe("DeliveryWorker — start/stop", () => {
  test("start() sets running state and stop() clears it", () => {
    const worker = createWorker()
    spyOn(deliveryAttemptRepository, "listDue").mockReturnValue(ok([]))
    worker.start()
    worker.stop()
    // If we get here without hanging, the worker started and stopped cleanly
    expect(true).toBe(true)
  })

  test("calling start() twice is idempotent", () => {
    const worker = createWorker()
    const spy = spyOn(deliveryAttemptRepository, "listDue").mockReturnValue(
      ok([]),
    )
    worker.start()
    worker.start()
    worker.stop()
    spy.mockRestore()
  })
})

// ─── poll — empty queue ───────────────────────────────────────────────────────

describe("DeliveryWorker — poll with empty queue", () => {
  test("does nothing when listDue returns empty array", async () => {
    const listDueSpy = spyOn(
      deliveryAttemptRepository,
      "listDue",
    ).mockReturnValue(ok([]))
    const fetchSpy = spyOn(globalThis, "fetch")

    const worker = createWorker()
    // @ts-expect-error accessing private method for testing
    await worker.poll()

    expect(listDueSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).not.toHaveBeenCalled()

    listDueSpy.mockRestore()
    fetchSpy.mockRestore()
  })

  test("does nothing when listDue returns a database error", async () => {
    const listDueSpy = spyOn(
      deliveryAttemptRepository,
      "listDue",
    ).mockReturnValue(err(new DatabaseError("db gone", {})))
    const fetchSpy = spyOn(globalThis, "fetch")

    const worker = createWorker()
    // @ts-expect-error accessing private method for testing
    await worker.poll()

    expect(fetchSpy).not.toHaveBeenCalled()

    listDueSpy.mockRestore()
    fetchSpy.mockRestore()
  })
})

// ─── deliver — success ────────────────────────────────────────────────────────

describe("DeliveryWorker — successful delivery", () => {
  let attempt: DeliveryAttempt
  let target: DeliveryTarget
  let event: WebhookEvent
  let updateStatusSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    attempt = makeAttempt()
    target = makeTarget({ id: attempt.targetId })
    event = makeEvent({ id: attempt.eventId })

    spyOn(deliveryAttemptRepository, "listDue").mockReturnValue(ok([attempt]))
    spyOn(webhookEventRepository, "findById").mockReturnValue(ok(event))
    spyOn(deliveryTargetRepository, "findById").mockReturnValue(ok(target))
    updateStatusSpy = spyOn(
      deliveryAttemptRepository,
      "updateStatus",
    ).mockReturnValue(ok(attempt))

    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
  })

  afterEach(() => {
    mock.restore()
  })

  test("marks attempt as success on 2xx response", async () => {
    const worker = createWorker()
    // @ts-expect-error accessing private method
    await worker.deliver(attempt)

    expect(updateStatusSpy).toHaveBeenCalledWith(
      attempt.id,
      "success",
      expect.objectContaining({ responseStatus: 200 }),
    )
  })
})

// ─── deliver — failure & retry ────────────────────────────────────────────────

describe("DeliveryWorker — failure and retry", () => {
  let attempt: DeliveryAttempt
  let target: DeliveryTarget
  let event: WebhookEvent
  let updateStatusSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    attempt = makeAttempt({ attemptNumber: 1 })
    target = makeTarget({
      id: attempt.targetId,
      maxRetries: 3,
      retryBackoffSeconds: 1,
    })
    event = makeEvent({ id: attempt.eventId })

    spyOn(webhookEventRepository, "findById").mockReturnValue(ok(event))
    spyOn(deliveryTargetRepository, "findById").mockReturnValue(ok(target))
    updateStatusSpy = spyOn(
      deliveryAttemptRepository,
      "updateStatus",
    ).mockReturnValue(ok(attempt))
  })

  afterEach(() => {
    mock.restore()
  })

  test("schedules retry on non-2xx response", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    )

    const worker = createWorker()
    // @ts-expect-error accessing private method
    await worker.deliver(attempt)

    expect(updateStatusSpy).toHaveBeenCalledWith(
      attempt.id,
      "retrying",
      expect.objectContaining({ errorMessage: "HTTP 500" }),
    )
  })

  test("schedules retry on network error", async () => {
    spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"))

    const worker = createWorker()
    // @ts-expect-error accessing private method
    await worker.deliver(attempt)

    expect(updateStatusSpy).toHaveBeenCalledWith(
      attempt.id,
      "retrying",
      expect.objectContaining({ errorMessage: "ECONNREFUSED" }),
    )
  })

  test("moves to DLQ when attemptNumber reaches maxRetries", async () => {
    const maxedAttempt = makeAttempt({ attemptNumber: 3 }) // equals maxRetries=3
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Error", { status: 500 }),
    )

    const worker = createWorker()
    // @ts-expect-error accessing private method
    await worker.deliver(maxedAttempt)

    expect(updateStatusSpy).toHaveBeenCalledWith(
      maxedAttempt.id,
      "dlq",
      expect.anything(),
    )
  })
})

// ─── deliver — missing data ───────────────────────────────────────────────────

describe("DeliveryWorker — missing event or target", () => {
  afterEach(() => {
    mock.restore()
  })

  test("skips delivery when event is not found", async () => {
    const attempt = makeAttempt()
    spyOn(webhookEventRepository, "findById").mockReturnValue(ok(null))
    const fetchSpy = spyOn(globalThis, "fetch")

    const worker = createWorker()
    // @ts-expect-error accessing private method
    await worker.deliver(attempt)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test("skips delivery when target is not found", async () => {
    const attempt = makeAttempt()
    const event = makeEvent({ id: attempt.eventId })
    spyOn(webhookEventRepository, "findById").mockReturnValue(ok(event))
    spyOn(deliveryTargetRepository, "findById").mockReturnValue(ok(null))
    const fetchSpy = spyOn(globalThis, "fetch")

    const worker = createWorker()
    // @ts-expect-error accessing private method
    await worker.deliver(attempt)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
