import { describe, expect, test } from "bun:test"
import { createHmac } from "node:crypto"
import { SignatureInvalidError, SignatureMissingError } from "@/core/errors"
import { verifySignature } from "@/gateway/signature-verifier"

const SECRET = "test-secret"
const BODY = '{"event":"push","ref":"refs/heads/main"}'

function hmacHex(algo: "sha256" | "sha1", secret: string, data: string) {
  return createHmac(algo, secret).update(data).digest("hex")
}
function hmacBase64(secret: string, data: string) {
  return createHmac("sha256", secret).update(data).digest("base64")
}

// ─── none ────────────────────────────────────────────────────────────────────

describe("verifySignature — none", () => {
  test("always passes regardless of headers", () => {
    const result = verifySignature("none", null, {}, BODY)
    expect(result.isOk()).toBe(true)
  })

  test("passes even when secret is missing", () => {
    const result = verifySignature("none", undefined, {}, BODY)
    expect(result.isOk()).toBe(true)
  })
})

// ─── missing secret ───────────────────────────────────────────────────────────

describe("verifySignature — missing secret", () => {
  test("returns SignatureInvalidError when scheme is set but secret is null", () => {
    const result = verifySignature("hmac_sha256", null, {}, BODY)
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })

  test("returns SignatureInvalidError when secret is empty string", () => {
    const result = verifySignature("hmac_sha256", "", {}, BODY)
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })
})

// ─── hmac_sha256 ─────────────────────────────────────────────────────────────

describe("verifySignature — hmac_sha256", () => {
  test("passes with correct sha256 signature", () => {
    const sig = `sha256=${hmacHex("sha256", SECRET, BODY)}`
    const result = verifySignature(
      "hmac_sha256",
      SECRET,
      { "x-webhook-signature": sig },
      BODY,
    )
    expect(result.isOk()).toBe(true)
  })

  test("fails with wrong signature value", () => {
    const result = verifySignature(
      "hmac_sha256",
      SECRET,
      { "x-webhook-signature": "sha256=badhex" },
      BODY,
    )
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })

  test("fails when header is missing", () => {
    const result = verifySignature("hmac_sha256", SECRET, {}, BODY)
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureMissingError)
  })
})

// ─── hmac_sha1 ───────────────────────────────────────────────────────────────

describe("verifySignature — hmac_sha1", () => {
  test("passes with correct sha1 signature", () => {
    const sig = `sha1=${hmacHex("sha1", SECRET, BODY)}`
    const result = verifySignature(
      "hmac_sha1",
      SECRET,
      { "x-webhook-signature": sig },
      BODY,
    )
    expect(result.isOk()).toBe(true)
  })

  test("fails with wrong signature value", () => {
    const result = verifySignature(
      "hmac_sha1",
      SECRET,
      { "x-webhook-signature": "sha1=badhex" },
      BODY,
    )
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })

  test("fails when header is missing", () => {
    const result = verifySignature("hmac_sha1", SECRET, {}, BODY)
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureMissingError)
  })
})

// ─── github ──────────────────────────────────────────────────────────────────

describe("verifySignature — github", () => {
  test("passes with correct x-hub-signature-256 header", () => {
    const sig = `sha256=${hmacHex("sha256", SECRET, BODY)}`
    const result = verifySignature(
      "github",
      SECRET,
      { "x-hub-signature-256": sig },
      BODY,
    )
    expect(result.isOk()).toBe(true)
  })

  test("fails with tampered body", () => {
    const sig = `sha256=${hmacHex("sha256", SECRET, BODY)}`
    const result = verifySignature(
      "github",
      SECRET,
      { "x-hub-signature-256": sig },
      `${BODY}tamper`,
    )
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })

  test("fails when header is missing", () => {
    const result = verifySignature("github", SECRET, {}, BODY)
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureMissingError)
  })
})

// ─── stripe ──────────────────────────────────────────────────────────────────

describe("verifySignature — stripe", () => {
  function buildStripeHeader(secret: string, body: string, ts = "1700000000") {
    const signedPayload = `${ts}.${body}`
    const hex = hmacHex("sha256", secret, signedPayload)
    return `t=${ts},v1=${hex}`
  }

  test("passes with correct stripe-signature header", () => {
    const header = buildStripeHeader(SECRET, BODY)
    const result = verifySignature(
      "stripe",
      SECRET,
      { "stripe-signature": header },
      BODY,
    )
    expect(result.isOk()).toBe(true)
  })

  test("passes when multiple v1 values present (key rotation)", () => {
    const ts = "1700000000"
    const correctHex = hmacHex("sha256", SECRET, `${ts}.${BODY}`)
    const header = `t=${ts},v1=badhex,v1=${correctHex}`
    const result = verifySignature(
      "stripe",
      SECRET,
      { "stripe-signature": header },
      BODY,
    )
    expect(result.isOk()).toBe(true)
  })

  test("fails when no v1 matches", () => {
    const header = "t=1700000000,v1=badhex"
    const result = verifySignature(
      "stripe",
      SECRET,
      { "stripe-signature": header },
      BODY,
    )
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })

  test("fails when timestamp component is missing", () => {
    const header = "v1=abc123"
    const result = verifySignature(
      "stripe",
      SECRET,
      { "stripe-signature": header },
      BODY,
    )
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })

  test("fails when header is missing", () => {
    const result = verifySignature("stripe", SECRET, {}, BODY)
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureMissingError)
  })
})

// ─── svix ────────────────────────────────────────────────────────────────────

describe("verifySignature — svix", () => {
  const MSG_ID = "msg_2PD7CW5hj0pmFIJiPCq7RI1FzuI"
  const TIMESTAMP = "1614265330"
  // secret is base64-encoded
  const SVIX_SECRET = Buffer.from(SECRET).toString("base64")

  function buildSvixSig(
    secret: string,
    msgId: string,
    ts: string,
    body: string,
  ) {
    const raw = secret.startsWith("whsec_") ? secret.slice(7) : secret
    const key = Buffer.from(raw, "base64")
    const signed = `${msgId}.${ts}.${body}`
    const sig = createHmac("sha256", key).update(signed).digest("base64")
    return `v1,${sig}`
  }

  test("passes with correct svix headers", () => {
    const sig = buildSvixSig(SVIX_SECRET, MSG_ID, TIMESTAMP, BODY)
    const result = verifySignature(
      "svix",
      SVIX_SECRET,
      {
        "svix-id": MSG_ID,
        "svix-timestamp": TIMESTAMP,
        "svix-signature": sig,
      },
      BODY,
    )
    expect(result.isOk()).toBe(true)
  })

  test("passes with whsec_ prefix", () => {
    const prefixed = `whsec_${SVIX_SECRET}`
    const sig = buildSvixSig(prefixed, MSG_ID, TIMESTAMP, BODY)
    const result = verifySignature(
      "svix",
      prefixed,
      {
        "svix-id": MSG_ID,
        "svix-timestamp": TIMESTAMP,
        "svix-signature": sig,
      },
      BODY,
    )
    expect(result.isOk()).toBe(true)
  })

  test("fails with wrong signature", () => {
    const result = verifySignature(
      "svix",
      SVIX_SECRET,
      {
        "svix-id": MSG_ID,
        "svix-timestamp": TIMESTAMP,
        "svix-signature": "v1,badsig",
      },
      BODY,
    )
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })

  test("fails when svix-id is missing", () => {
    const result = verifySignature(
      "svix",
      SVIX_SECRET,
      {
        "svix-timestamp": TIMESTAMP,
        "svix-signature": "v1,abc",
      },
      BODY,
    )
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureMissingError)
  })
})

// ─── custom ──────────────────────────────────────────────────────────────────

describe("verifySignature — custom", () => {
  test("passes with hex encoding (default)", () => {
    const sig = hmacHex("sha256", SECRET, BODY)
    const result = verifySignature(
      "custom",
      SECRET,
      { "x-webhook-signature": sig },
      BODY,
    )
    expect(result.isOk()).toBe(true)
  })

  test("passes with base64 encoding", () => {
    const sig = hmacBase64(SECRET, BODY)
    const result = verifySignature(
      "custom",
      SECRET,
      { "x-webhook-signature": sig },
      BODY,
      {
        customSignatureEncoding: "base64",
      },
    )
    expect(result.isOk()).toBe(true)
  })

  test("passes with hex_prefixed encoding", () => {
    const sig = `sha256=${hmacHex("sha256", SECRET, BODY)}`
    const result = verifySignature(
      "custom",
      SECRET,
      { "x-webhook-signature": sig },
      BODY,
      {
        customSignatureEncoding: "hex_prefixed",
      },
    )
    expect(result.isOk()).toBe(true)
  })

  test("passes with custom header name", () => {
    const sig = hmacHex("sha256", SECRET, BODY)
    const result = verifySignature(
      "custom",
      SECRET,
      { "x-my-sig": sig },
      BODY,
      {
        customSignatureHeader: "x-my-sig",
      },
    )
    expect(result.isOk()).toBe(true)
  })

  test("fails when custom header is missing", () => {
    const result = verifySignature("custom", SECRET, {}, BODY, {
      customSignatureHeader: "x-my-sig",
    })
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureMissingError)
  })

  test("fails with wrong signature", () => {
    const result = verifySignature(
      "custom",
      SECRET,
      { "x-webhook-signature": "badhex" },
      BODY,
    )
    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error).toBeInstanceOf(SignatureInvalidError)
  })
})
