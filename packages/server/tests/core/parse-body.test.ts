import { describe, expect, test } from "bun:test"
import { parseBody } from "../../src/core/validation"

const URL = "http://localhost/test"

describe("parseBody", () => {
  test("GET with a JSON content-type and no body parses to {}", async () => {
    const req = new Request(URL, {
      method: "GET",
      headers: { "content-type": "application/json" },
    })
    const result = await parseBody(req)
    expect(result.isOk()).toBe(true)
    expect(result.isOk() && result.value).toEqual({})
  })

  test("POST with an empty JSON body parses to {}", async () => {
    const req = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "",
    })
    const result = await parseBody(req)
    expect(result.isOk() && result.value).toEqual({})
  })

  test("DELETE with Content-Length: 0 parses to {}", async () => {
    const req = new Request(URL, {
      method: "DELETE",
      headers: { "content-type": "application/json", "content-length": "0" },
    })
    const result = await parseBody(req)
    expect(result.isOk() && result.value).toEqual({})
  })

  test("JSON bodies still parse", async () => {
    const req = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    })
    const result = await parseBody(req)
    expect(result.isOk() && result.value).toEqual({ a: 1 })
  })

  test("invalid JSON is still an error", async () => {
    const req = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{nope",
    })
    const result = await parseBody(req)
    expect(result.isErr()).toBe(true)
  })

  test("multipart is left for the handler, which can still read it", async () => {
    const form = new FormData()
    form.set("file", new File(["hello"], "a.txt", { type: "text/plain" }))
    const req = new Request(URL, { method: "POST", body: form })

    const result = await parseBody(req)
    expect(result.isOk() && result.value).toEqual({})

    // parseBody works on a clone, so the original body is untouched.
    const read = await req.formData()
    expect(await (read.get("file") as File).text()).toBe("hello")
  })
})
