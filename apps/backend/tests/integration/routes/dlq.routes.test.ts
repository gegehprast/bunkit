/**
 * Integration tests for the Dead-Letter Queue (DLQ) endpoints:
 *   GET  /api/dlq
 *   POST /api/dlq/replay
 *   DELETE /api/dlq
 *
 * Tests use an in-memory SQLite database and the test server.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { createHash } from "node:crypto"
import { apiKeyRepository } from "@/db/repositories/api-key-repository"
import { deliveryAttemptRepository } from "@/db/repositories/delivery-attempt-repository"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import { webhookEventRepository } from "@/db/repositories/webhook-event-repository"
import {
  clearAllTables,
  setupTestDb,
  teardownTestDb,
} from "../../helpers/test-db"
import { createTestServer, type TestServer } from "../test-server"

let server: TestServer
let BASE_URL: string
let apiKey: string

function createTestApiKey() {
  const raw = crypto.randomUUID()
  apiKey = raw
  const result = apiKeyRepository.create({
    id: crypto.randomUUID(),
    name: "dlq-test-key",
    keyHash: createHash("sha256").update(raw).digest("hex"),
    keyPrefix: "dlqtest1",
    enabled: true,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  if (result.isErr()) {
    throw new Error(`createTestApiKey failed: ${result.error.message}`)
  }
}

beforeAll(async () => {
  await setupTestDb()
  server = await createTestServer()
  const result = await server.start()
  if (result.isErr()) throw new Error(result.error.message)
  BASE_URL = server.getBaseUrl()
})

afterAll(async () => {
  await server.stop()
  await teardownTestDb()
})

// Create a fresh API key before each test so auth always works after table clears
beforeEach(createTestApiKey)
afterEach(clearAllTables)

// ─── helpers ─────────────────────────────────────────────────────────────────

function authHeaders() {
  return { authorization: `Bearer ${apiKey}` }
}

function makeDlqFixture() {
  const endpointId = crypto.randomUUID()
  const eventId = crypto.randomUUID()
  const targetId = crypto.randomUUID()

  webhookEndpointRepository.create({
    id: endpointId,
    name: "dlq-endpoint",
    slug: `slug-${endpointId.slice(0, 8)}`,
    enabled: true,
    signingScheme: "none",
    signingSecret: null,
    customSignatureHeader: null,
    customSignatureEncoding: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  webhookEventRepository.create({
    id: eventId,
    endpointId,
    method: "POST",
    headers: {},
    body: '{"event":"test"}',
    sourceIp: null,
    matchedRuleId: null,
    signatureValid: null,
    createdAt: new Date(),
  })
  deliveryTargetRepository.create({
    id: targetId,
    endpointId,
    name: "dlq-target",
    url: "https://example.com/hook",
    enabled: true,
    headers: null,
    maxRetries: 3,
    retryBackoffSeconds: 60,
    outboundSigningScheme: "none",
    outboundSigningSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const attempt = deliveryAttemptRepository.create({
    eventId,
    targetId,
    status: "dlq",
    attemptNumber: 3,
    nextRetryAt: new Date(),
    isReplay: false,
    originalAttemptId: null,
  })

  return { endpointId, eventId, targetId, attempt: attempt.unwrap() }
}

// ─── GET /api/dlq ─────────────────────────────────────────────────────────────

describe("GET /api/dlq", () => {
  test("returns 401 without API key", async () => {
    const resp = await fetch(`${BASE_URL}/api/dlq`)
    expect(resp.status).toBe(401)
  })

  test("returns empty list when no DLQ entries exist", async () => {
    const resp = await fetch(`${BASE_URL}/api/dlq`, {
      headers: authHeaders(),
    })
    expect(resp.status).toBe(200)
    const data = (await resp.json()) as { attempts: unknown[]; total: number }
    expect(data.attempts).toHaveLength(0)
    expect(data.total).toBe(0)
  })

  test("returns DLQ entries when they exist", async () => {
    makeDlqFixture()
    makeDlqFixture()

    const resp = await fetch(`${BASE_URL}/api/dlq`, {
      headers: authHeaders(),
    })
    expect(resp.status).toBe(200)
    const data = (await resp.json()) as { attempts: unknown[]; total: number }
    expect(data.attempts).toHaveLength(2)
    expect(data.total).toBe(2)
  })
})

// ─── POST /api/dlq/replay ─────────────────────────────────────────────────────

describe("POST /api/dlq/replay", () => {
  test("returns 401 without API key", async () => {
    const resp = await fetch(`${BASE_URL}/api/dlq/replay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    expect(resp.status).toBe(401)
  })

  test("replays a specific DLQ attempt by id", async () => {
    const { attempt } = makeDlqFixture()

    const resp = await fetch(`${BASE_URL}/api/dlq/replay`, {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ ids: [attempt.id] }),
    })
    expect(resp.status).toBe(200)
    const data = (await resp.json()) as { replayed: number; errors: number }
    expect(data.replayed).toBe(1)
    expect(data.errors).toBe(0)
  })

  test("creates a new pending attempt for the replayed entry", async () => {
    const { attempt, eventId, targetId } = makeDlqFixture()

    await fetch(`${BASE_URL}/api/dlq/replay`, {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ ids: [attempt.id] }),
    })

    const all = deliveryAttemptRepository.list({ eventId })
    expect(all.isOk()).toBe(true)
    const pending = all.unwrap().filter((a) => a.status === "pending")
    expect(pending).toHaveLength(1)
    expect(pending[0]?.isReplay).toBe(true)
    expect(pending[0]?.originalAttemptId).toBe(attempt.id)
    expect(pending[0]?.targetId).toBe(targetId)
  })

  test("replays all DLQ entries when no ids provided", async () => {
    makeDlqFixture()
    makeDlqFixture()
    makeDlqFixture()

    const resp = await fetch(`${BASE_URL}/api/dlq/replay`, {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: "{}",
    })
    const data = (await resp.json()) as { replayed: number; errors: number }
    expect(data.replayed).toBe(3)
    expect(data.errors).toBe(0)
  })

  test("ignores ids that are not in dlq status", async () => {
    const endpointId = crypto.randomUUID()
    const eventId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    webhookEndpointRepository.create({
      id: endpointId,
      name: "ep",
      slug: `slug-${endpointId.slice(0, 8)}`,
      enabled: true,
      signingScheme: "none",
      signingSecret: null,
      customSignatureHeader: null,
      customSignatureEncoding: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    webhookEventRepository.create({
      id: eventId,
      endpointId,
      method: "POST",
      headers: {},
      body: "{}",
      sourceIp: null,
      matchedRuleId: null,
      signatureValid: null,
      createdAt: new Date(),
    })
    deliveryTargetRepository.create({
      id: targetId,
      endpointId,
      name: "t",
      url: "https://example.com/hook",
      enabled: true,
      headers: null,
      maxRetries: 3,
      retryBackoffSeconds: 60,
      outboundSigningScheme: "none",
      outboundSigningSecret: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const pendingAttempt = deliveryAttemptRepository.create({
      eventId,
      targetId,
      status: "pending",
      attemptNumber: 1,
      nextRetryAt: new Date(),
      isReplay: false,
      originalAttemptId: null,
    })

    const resp = await fetch(`${BASE_URL}/api/dlq/replay`, {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ ids: [pendingAttempt.unwrap().id] }),
    })
    const data = (await resp.json()) as { replayed: number; errors: number }
    // pending attempts should not be replayed
    expect(data.replayed).toBe(0)
    expect(data.errors).toBe(0)
  })
})

// ─── DELETE /api/dlq ──────────────────────────────────────────────────────────

describe("DELETE /api/dlq", () => {
  test("returns 401 without API key", async () => {
    const resp = await fetch(`${BASE_URL}/api/dlq`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    expect(resp.status).toBe(401)
  })

  test("removes all DLQ entries", async () => {
    makeDlqFixture()
    makeDlqFixture()

    const resp = await fetch(`${BASE_URL}/api/dlq`, {
      method: "DELETE",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: "{}",
    })
    expect(resp.status).toBe(200)
    const data = (await resp.json()) as { discarded: number }
    expect(data.discarded).toBe(2)

    // Verify they are gone
    const list = deliveryAttemptRepository.list({ status: "dlq" })
    expect(list.isOk()).toBe(true)
    expect(list.unwrap()).toHaveLength(0)
  })

  test("returns 0 when no DLQ entries exist", async () => {
    const resp = await fetch(`${BASE_URL}/api/dlq`, {
      method: "DELETE",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: "{}",
    })
    expect(resp.status).toBe(200)
    const data = (await resp.json()) as { discarded: number }
    expect(data.discarded).toBe(0)
  })
})
