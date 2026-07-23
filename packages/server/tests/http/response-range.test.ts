import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { createResponseBuilder } from "../../src/http/response-builder"

const FILE_PATH = "/tmp/bunkit-response-range-test.bin"
const FILE_CONTENT = "0123456789abcdefghijklmnopqrstuvwxyz" // 36 bytes

beforeEach(async () => {
  await Bun.write(FILE_PATH, FILE_CONTENT)
})

afterEach(async () => {
  await rm(FILE_PATH, { force: true })
})

describe("file() Range/206 support", () => {
  test("serves the full file with 200 when there's no Range header", async () => {
    const res = createResponseBuilder()
    const response = await res.file(FILE_PATH, "text/plain")

    expect(response.status).toBe(200)
    expect(response.headers.get("accept-ranges")).toBe("bytes")
    expect(await response.text()).toBe(FILE_CONTENT)
  })

  test("serves a middle byte range as 206", async () => {
    const request = new Request("http://localhost/file", {
      headers: { Range: "bytes=5-9" },
    })
    const res = createResponseBuilder(request)
    const response = await res.file(FILE_PATH, "text/plain")

    expect(response.status).toBe(206)
    expect(response.headers.get("content-range")).toBe(
      `bytes 5-9/${FILE_CONTENT.length}`,
    )
    expect(response.headers.get("content-length")).toBe("5")
    expect(await response.text()).toBe(FILE_CONTENT.slice(5, 10))
  })

  test("serves an open-ended range (bytes=N-) to the end of the file", async () => {
    const request = new Request("http://localhost/file", {
      headers: { Range: "bytes=30-" },
    })
    const res = createResponseBuilder(request)
    const response = await res.file(FILE_PATH, "text/plain")

    expect(response.status).toBe(206)
    expect(response.headers.get("content-range")).toBe(
      `bytes 30-${FILE_CONTENT.length - 1}/${FILE_CONTENT.length}`,
    )
    expect(await response.text()).toBe(FILE_CONTENT.slice(30))
  })

  test("serves a suffix range (bytes=-N) for the last N bytes", async () => {
    const request = new Request("http://localhost/file", {
      headers: { Range: "bytes=-5" },
    })
    const res = createResponseBuilder(request)
    const response = await res.file(FILE_PATH, "text/plain")

    expect(response.status).toBe(206)
    expect(await response.text()).toBe(FILE_CONTENT.slice(-5))
  })

  test("responds 416 for a range beyond the end of the file", async () => {
    const request = new Request("http://localhost/file", {
      headers: { Range: "bytes=1000-2000" },
    })
    const res = createResponseBuilder(request)
    const response = await res.file(FILE_PATH, "text/plain")

    expect(response.status).toBe(416)
    expect(response.headers.get("content-range")).toBe(
      `bytes */${FILE_CONTENT.length}`,
    )
  })

  test("responds 416 for a malformed Range header", async () => {
    const request = new Request("http://localhost/file", {
      headers: { Range: "not-a-range" },
    })
    const res = createResponseBuilder(request)
    const response = await res.file(FILE_PATH, "text/plain")

    expect(response.status).toBe(416)
  })

  test("still 404s for a missing file, Range header or not", async () => {
    const request = new Request("http://localhost/file", {
      headers: { Range: "bytes=0-9" },
    })
    const res = createResponseBuilder(request)
    const response = await res.file("/tmp/does-not-exist-at-all", "text/plain")

    expect(response.status).toBe(404)
  })
})
