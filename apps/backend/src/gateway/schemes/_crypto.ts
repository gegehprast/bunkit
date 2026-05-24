import { createHmac, timingSafeEqual } from "node:crypto"

export function hmacHex(
  algorithm: "sha256" | "sha1",
  secret: string,
  data: string,
): string {
  return createHmac(algorithm, secret).update(data).digest("hex")
}

export function hmacBase64(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64")
}

export function hmacBytes(secret: Buffer, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest()
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function safeEqualBytes(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
