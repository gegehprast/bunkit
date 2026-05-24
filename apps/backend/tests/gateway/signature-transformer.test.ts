import { describe, expect, test } from "bun:test"
import { createHmac } from "node:crypto"
import { WEBHOOK_HEADERS } from "@/config/constants"
import { buildOutboundHeaders } from "@/gateway/signature-transformer"

const EVENT_ID = "evt_01234567-89ab-cdef-0123-456789abcdef"
const SECRET = "outbound-secret"
const BODY = '{"id":1,"status":"ok"}'

function hmacHex(algo: "sha256" | "sha1", secret: string, data: string) {
  return createHmac(algo, secret).update(data).digest("hex")
}

describe("buildOutboundHeaders — none", () => {
  test("only includes event-id header when scheme is none", () => {
    const headers = buildOutboundHeaders("none", SECRET, BODY, EVENT_ID)
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_EVENT_ID]).toBe(EVENT_ID)
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE]).toBeUndefined()
  })

  test("omits signature even when secret is provided", () => {
    const headers = buildOutboundHeaders("none", SECRET, BODY, EVENT_ID)
    expect(Object.keys(headers)).toHaveLength(1)
  })
})

describe("buildOutboundHeaders — hmac_sha256", () => {
  test("includes event-id and sha256 signature", () => {
    const headers = buildOutboundHeaders("hmac_sha256", SECRET, BODY, EVENT_ID)
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_EVENT_ID]).toBe(EVENT_ID)

    const expectedSig = `sha256=${hmacHex("sha256", SECRET, BODY)}`
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE]).toBe(expectedSig)
  })

  test("omits signature when secret is null", () => {
    const headers = buildOutboundHeaders("hmac_sha256", null, BODY, EVENT_ID)
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE]).toBeUndefined()
  })

  test("omits signature when secret is undefined", () => {
    const headers = buildOutboundHeaders(
      "hmac_sha256",
      undefined,
      BODY,
      EVENT_ID,
    )
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE]).toBeUndefined()
  })

  test("different bodies produce different signatures", () => {
    const h1 = buildOutboundHeaders("hmac_sha256", SECRET, BODY, EVENT_ID)
    const h2 = buildOutboundHeaders("hmac_sha256", SECRET, `${BODY}x`, EVENT_ID)
    expect(h1[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE]).not.toBe(
      h2[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE],
    )
  })
})

describe("buildOutboundHeaders — hmac_sha1", () => {
  test("includes event-id and sha1 signature", () => {
    const headers = buildOutboundHeaders("hmac_sha1", SECRET, BODY, EVENT_ID)
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_EVENT_ID]).toBe(EVENT_ID)

    const expectedSig = `sha1=${hmacHex("sha1", SECRET, BODY)}`
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE]).toBe(expectedSig)
  })

  test("omits signature when secret is null", () => {
    const headers = buildOutboundHeaders("hmac_sha1", null, BODY, EVENT_ID)
    expect(headers[WEBHOOK_HEADERS.HOOKITUP_SIGNATURE]).toBeUndefined()
  })
})

describe("buildOutboundHeaders — event ID forwarding", () => {
  test("event-id is always set regardless of scheme", () => {
    for (const scheme of ["none", "hmac_sha256", "hmac_sha1"] as const) {
      const headers = buildOutboundHeaders(scheme, SECRET, BODY, EVENT_ID)
      expect(headers[WEBHOOK_HEADERS.HOOKITUP_EVENT_ID]).toBe(EVENT_ID)
    }
  })
})
