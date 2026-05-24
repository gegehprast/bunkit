/**
 * Integration tests for POST /hooks/:slug
 *
 * Tests the full inbound webhook pipeline: signature verification,
 * filter evaluation, event persistence, and delivery queueing.
 *
 * These tests use the test server + in-memory SQLite database.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test"
import { createHmac } from "node:crypto"
import { deliveryAttemptRepository } from "@/db/repositories/delivery-attempt-repository"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { filterRuleRepository } from "@/db/repositories/filter-rule-repository"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import { webhookEventRepository } from "@/db/repositories/webhook-event-repository"
import {
  clearAllTables,
  setupTestDb,
  teardownTestDb,
} from "../../helpers/test-db"
import { createTestServer, type TestServer } from "../test-server"

// ─── test server ─────────────────────────────────────────────────────────────

let server: TestServer
let BASE_URL: string

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

afterEach(clearAllTables)

// ─── helpers ─────────────────────────────────────────────────────────────────

function hmacHex(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex")
}

async function createEndpoint(
  overrides: {
    slug?: string
    signingScheme?: string
    signingSecret?: string | null
    enabled?: boolean
  } = {},
) {
  const id = crypto.randomUUID()
  const endpoint = {
    id,
    name: "test-endpoint",
    slug: overrides.slug ?? `slug-${id.slice(0, 8)}`,
    enabled: overrides.enabled ?? true,
    signingScheme: (overrides.signingScheme ?? "none") as
      | "none"
      | "hmac_sha256",
    signingSecret: overrides.signingSecret ?? null,
    customSignatureHeader: null,
    customSignatureEncoding: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  webhookEndpointRepository.create(endpoint)
  return endpoint
}

// ─── basic ingestion ─────────────────────────────────────────────────────────

describe("POST /hooks/:slug — basic ingestion", () => {
  test("returns 200 and eventId for a valid webhook", async () => {
    const endpoint = await createEndpoint()

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"action":"test"}',
    })

    expect(resp.status).toBe(200)
    const data = (await resp.json()) as { eventId: string; queued: boolean }
    expect(data.eventId).toBeString()
    expect(data.queued).toBe(true)
  })

  test("persists the event in the database", async () => {
    const endpoint = await createEndpoint()

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"action":"persisted"}',
    })
    const data = (await resp.json()) as { eventId: string }

    const found = webhookEventRepository.findById(data.eventId)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()?.body).toBe('{"action":"persisted"}')
  })

  test("returns 404 for unknown slug", async () => {
    const resp = await fetch(`${BASE_URL}/hooks/unknown-slug`, {
      method: "POST",
      body: "{}",
    })
    expect(resp.status).toBe(404)
  })

  test("returns 403 for disabled endpoint", async () => {
    const endpoint = await createEndpoint({ enabled: false })

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      body: "{}",
    })
    expect(resp.status).toBe(403)
  })

  test("accepts PUT and PATCH methods", async () => {
    const endpoint = await createEndpoint()

    for (const method of ["PUT", "PATCH"]) {
      const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
        method,
        body: '{"action":"test"}',
      })
      expect(resp.status).toBe(200)
    }
  })
})

// ─── signature verification ───────────────────────────────────────────────────

describe("POST /hooks/:slug — signature verification", () => {
  const SECRET = "webhook-secret-123"
  const BODY = '{"event":"push"}'

  test("passes with correct HMAC-SHA256 signature", async () => {
    const endpoint = await createEndpoint({
      signingScheme: "hmac_sha256",
      signingSecret: SECRET,
    })
    const sig = `sha256=${hmacHex(SECRET, BODY)}`

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": sig,
      },
      body: BODY,
    })
    expect(resp.status).toBe(200)
  })

  test("returns 400 with wrong signature", async () => {
    const endpoint = await createEndpoint({
      signingScheme: "hmac_sha256",
      signingSecret: SECRET,
    })

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      headers: { "x-webhook-signature": "sha256=badhex" },
      body: BODY,
    })
    expect(resp.status).toBe(400)
  })

  test("returns 400 when signature header is missing", async () => {
    const endpoint = await createEndpoint({
      signingScheme: "hmac_sha256",
      signingSecret: SECRET,
    })

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      body: BODY,
    })
    expect(resp.status).toBe(400)
  })

  test("returns 400 when body is tampered", async () => {
    const endpoint = await createEndpoint({
      signingScheme: "hmac_sha256",
      signingSecret: SECRET,
    })
    const sig = `sha256=${hmacHex(SECRET, BODY)}`

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      headers: { "x-webhook-signature": sig },
      body: `${BODY}tamper`,
    })
    expect(resp.status).toBe(400)
  })
})

// ─── filter matching ──────────────────────────────────────────────────────────

describe("POST /hooks/:slug — filter matching", () => {
  test("event is allowed through when no rules exist", async () => {
    const endpoint = await createEndpoint()
    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      body: '{"action":"test"}',
    })
    expect(resp.status).toBe(200)
  })

  test("event is accepted when a pass-through rule matches", async () => {
    const endpoint = await createEndpoint()
    filterRuleRepository.createRule({
      id: crypto.randomUUID(),
      endpointId: endpoint.id,
      name: "allow-all",
      priority: 0,
      logicOperator: "AND",
      dropOnMatch: false,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      body: '{"action":"test"}',
    })
    expect(resp.status).toBe(200)
  })

  test("event is still persisted when a drop rule fires", async () => {
    const endpoint = await createEndpoint()
    filterRuleRepository.createRule({
      id: crypto.randomUUID(),
      endpointId: endpoint.id,
      name: "drop-all",
      priority: 0,
      logicOperator: "AND",
      dropOnMatch: true,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      body: '{"action":"test"}',
    })

    // The request still succeeds — event is persisted, just not delivered
    expect(resp.status).toBe(200)
    const data = (await resp.json()) as { eventId: string; queued: boolean }
    const found = webhookEventRepository.findById(data.eventId)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()?.id).toBe(data.eventId)
  })
})

// ─── delivery queueing ────────────────────────────────────────────────────────

describe("POST /hooks/:slug — delivery queueing", () => {
  test("creates a delivery attempt for each enabled target", async () => {
    const endpoint = await createEndpoint()

    // Create two delivery targets
    const t1 = {
      id: crypto.randomUUID(),
      endpointId: endpoint.id,
      name: "target-1",
      url: "https://example.com/hook1",
      enabled: true,
      headers: null,
      maxRetries: 3,
      retryBackoffSeconds: 60,
      outboundSigningScheme: "none" as const,
      outboundSigningSecret: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const t2 = { ...t1, id: crypto.randomUUID(), name: "target-2" }
    deliveryTargetRepository.create(t1)
    deliveryTargetRepository.create(t2)

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      body: '{"action":"test"}',
    })
    expect(resp.status).toBe(200)
    const data = (await resp.json()) as { eventId: string }

    const attempts = deliveryAttemptRepository.list({ eventId: data.eventId })
    expect(attempts.isOk()).toBe(true)
    const attemptsVal = attempts.unwrap()
    expect(attemptsVal).toHaveLength(2)
    expect(attemptsVal.every((a) => a.status === "pending")).toBe(true)
  })

  test("no delivery attempts when drop rule fires", async () => {
    const endpoint = await createEndpoint()
    deliveryTargetRepository.create({
      id: crypto.randomUUID(),
      endpointId: endpoint.id,
      name: "target",
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
    filterRuleRepository.createRule({
      id: crypto.randomUUID(),
      endpointId: endpoint.id,
      name: "drop",
      priority: 0,
      logicOperator: "AND",
      dropOnMatch: true,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const resp = await fetch(`${BASE_URL}/hooks/${endpoint.slug}`, {
      method: "POST",
      body: '{"action":"test"}',
    })
    const data = (await resp.json()) as { eventId: string }

    const attempts = deliveryAttemptRepository.list({ eventId: data.eventId })
    expect(attempts.isOk()).toBe(true)
    expect(attempts.unwrap()).toHaveLength(0)
  })
})
