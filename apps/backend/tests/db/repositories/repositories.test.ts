import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test"
import { createHash } from "node:crypto"
import {
  ApiKeyDisabledError,
  ApiKeyExpiredError,
  ApiKeyInvalidError,
} from "@/core/errors"
import { apiKeyRepository } from "@/db/repositories/api-key-repository"
import { deliveryTargetRepository } from "@/db/repositories/delivery-target-repository"
import { filterRuleRepository } from "@/db/repositories/filter-rule-repository"
import { webhookEndpointRepository } from "@/db/repositories/webhook-endpoint-repository"
import { webhookEventRepository } from "@/db/repositories/webhook-event-repository"
import type {
  NewApiKey,
  NewDeliveryTarget,
  NewWebhookEndpoint,
  NewWebhookEvent,
} from "@/db/schemas"
import {
  clearAllTables,
  setupTestDb,
  teardownTestDb,
} from "../../helpers/test-db"

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

beforeAll(setupTestDb)
afterAll(teardownTestDb)
afterEach(clearAllTables)

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeEndpoint(
  overrides: Partial<NewWebhookEndpoint> = {},
): NewWebhookEndpoint & { id: string } {
  const id = crypto.randomUUID()
  return {
    id,
    name: "test-endpoint",
    slug: `slug-${id.slice(0, 8)}`,
    enabled: true,
    signingScheme: "none",
    signingSecret: null,
    customSignatureHeader: null,
    customSignatureEncoding: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeKey(
  overrides: Partial<NewApiKey> = {},
): NewApiKey & { id: string } {
  return {
    id: crypto.randomUUID(),
    name: "test-key",
    keyHash: sha256(crypto.randomUUID()),
    keyPrefix: "test1234",
    enabled: true,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeTarget(
  endpointId: string,
  overrides: Partial<NewDeliveryTarget> = {},
): NewDeliveryTarget & { id: string } {
  return {
    id: crypto.randomUUID(),
    endpointId,
    name: "target",
    url: "https://example.com/webhook",
    enabled: true,
    headers: null,
    maxRetries: 3,
    retryBackoffSeconds: 60,
    outboundSigningScheme: "none",
    outboundSigningSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeEvent(
  endpointId: string,
  overrides: Partial<NewWebhookEvent> = {},
): NewWebhookEvent & { id: string } {
  return {
    id: crypto.randomUUID(),
    endpointId,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"event":"test"}',
    sourceIp: null,
    matchedRuleId: null,
    signatureValid: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// ─── ApiKeyRepository ─────────────────────────────────────────────────────────

describe("ApiKeyRepository", () => {
  test("create and findById", () => {
    const data = makeKey()
    const created = apiKeyRepository.create(data)
    expect(created.isOk()).toBe(true)

    const found = apiKeyRepository.findById(data.id)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()?.id).toBe(data.id)
    expect(found.unwrap()?.name).toBe("test-key")
  })

  test("findByHash returns null when not found", () => {
    const result = apiKeyRepository.findByHash("nonexistent-hash")
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBeNull()
  })

  test("listAll returns all keys", () => {
    apiKeyRepository.create(makeKey())
    apiKeyRepository.create(makeKey())
    const list = apiKeyRepository.listAll()
    expect(list.isOk()).toBe(true)
    expect(list.unwrap()).toHaveLength(2)
  })

  test("delete removes the key", () => {
    const data = makeKey()
    apiKeyRepository.create(data)
    apiKeyRepository.delete(data.id)
    const found = apiKeyRepository.findById(data.id)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()).toBeNull()
  })

  test("validate: returns key when valid", () => {
    const hash = sha256("raw-key-1")
    apiKeyRepository.create(makeKey({ keyHash: hash }))

    const result = apiKeyRepository.validate(hash)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().keyHash).toBe(hash)
  })

  test("validate: returns ApiKeyInvalidError when hash not found", () => {
    const result = apiKeyRepository.validate("nonexistent")
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(ApiKeyInvalidError)
  })

  test("validate: returns ApiKeyExpiredError when expiresAt is in the past", () => {
    const hash = sha256("raw-key-2")
    apiKeyRepository.create(
      makeKey({ keyHash: hash, expiresAt: new Date(Date.now() - 1000) }),
    )
    const result = apiKeyRepository.validate(hash)
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(ApiKeyExpiredError)
  })

  test("validate: returns ApiKeyDisabledError when enabled=false", () => {
    const hash = sha256("raw-key-3")
    apiKeyRepository.create(makeKey({ keyHash: hash, enabled: false }))
    const result = apiKeyRepository.validate(hash)
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(ApiKeyDisabledError)
  })
})

// ─── WebhookEndpointRepository ────────────────────────────────────────────────

describe("WebhookEndpointRepository", () => {
  test("create and findById", () => {
    const data = makeEndpoint()
    webhookEndpointRepository.create(data)
    const found = webhookEndpointRepository.findById(data.id)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()?.slug).toBe(data.slug)
  })

  test("findBySlug returns null for unknown slug", () => {
    const result = webhookEndpointRepository.findBySlug("nonexistent")
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBeNull()
  })

  test("findBySlug returns the correct endpoint", () => {
    const data = makeEndpoint({ slug: "my-unique-slug" })
    webhookEndpointRepository.create(data)
    const result = webhookEndpointRepository.findBySlug("my-unique-slug")
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()?.id).toBe(data.id)
  })

  test("update modifies fields", () => {
    const data = makeEndpoint()
    webhookEndpointRepository.create(data)
    webhookEndpointRepository.update(data.id, { name: "updated-name" })
    const found = webhookEndpointRepository.findById(data.id)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()?.name).toBe("updated-name")
  })

  test("delete removes endpoint", () => {
    const data = makeEndpoint()
    webhookEndpointRepository.create(data)
    webhookEndpointRepository.delete(data.id)
    const found = webhookEndpointRepository.findById(data.id)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()).toBeNull()
  })
})

// ─── DeliveryTargetRepository ─────────────────────────────────────────────────

describe("DeliveryTargetRepository", () => {
  test("create and findById", () => {
    const ep = makeEndpoint()
    webhookEndpointRepository.create(ep)
    const data = makeTarget(ep.id)
    deliveryTargetRepository.create(data)
    const found = deliveryTargetRepository.findById(data.id)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()?.url).toBe(data.url)
  })

  test("listByEndpoint returns only targets for that endpoint", () => {
    const ep = makeEndpoint()
    webhookEndpointRepository.create(ep)
    deliveryTargetRepository.create(makeTarget(ep.id))
    deliveryTargetRepository.create(makeTarget(ep.id))
    const list = deliveryTargetRepository.listByEndpoint(ep.id)
    expect(list.isOk()).toBe(true)
    expect(list.unwrap()).toHaveLength(2)
    expect(list.unwrap().every((t) => t.endpointId === ep.id)).toBe(true)
  })
})

// ─── WebhookEventRepository ───────────────────────────────────────────────────

describe("WebhookEventRepository", () => {
  test("create and findById", () => {
    const ep = makeEndpoint()
    webhookEndpointRepository.create(ep)
    const data = makeEvent(ep.id)
    webhookEventRepository.create(data)
    const found = webhookEventRepository.findById(data.id)
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()?.body).toBe(data.body)
  })

  test("list returns events for the endpoint", () => {
    const ep = makeEndpoint()
    webhookEndpointRepository.create(ep)
    webhookEventRepository.create(makeEvent(ep.id))
    webhookEventRepository.create(makeEvent(ep.id))
    const list = webhookEventRepository.list({ endpointId: ep.id, limit: 10 })
    expect(list.isOk()).toBe(true)
    expect(list.unwrap()).toHaveLength(2)
  })

  test("findById returns null for unknown ID", () => {
    const found = webhookEventRepository.findById(crypto.randomUUID())
    expect(found.isOk()).toBe(true)
    expect(found.unwrap()).toBeNull()
  })
})

// ─── FilterRuleRepository ─────────────────────────────────────────────────────

describe("FilterRuleRepository", () => {
  test("createRule and listEnabledWithConditions", () => {
    const ep = makeEndpoint()
    webhookEndpointRepository.create(ep)
    const rule = filterRuleRepository.createRule({
      id: crypto.randomUUID(),
      endpointId: ep.id,
      name: "test-rule",
      priority: 0,
      logicOperator: "AND",
      dropOnMatch: false,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    expect(rule.isOk()).toBe(true)

    const list = filterRuleRepository.listEnabledWithConditions(ep.id)
    expect(list.isOk()).toBe(true)
    expect(list.unwrap().some((r) => r.id === rule.unwrap().id)).toBe(true)
  })
})
