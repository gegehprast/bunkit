import { describe, expect, test } from "bun:test"
import { err, ok, type Result, tryCatch, tryCatchAsync } from "../src/index"

describe("Result Package", () => {
  describe("Ok", () => {
    test("should create an Ok result with value", () => {
      const result = ok(42)

      expect(result.ok).toBe(true)
      expect(result.value).toBe(42)
    })

    test("should correctly identify as Ok", () => {
      const result = ok("success")

      expect(result.isOk()).toBe(true)
      expect(result.isErr()).toBe(false)
    })

    test("should unwrap to the value", () => {
      const result = ok(100)

      expect(result.unwrap()).toBe(100)
    })

    test("should return value with unwrapOr", () => {
      const result = ok(42)

      expect(result.unwrapOr(0)).toBe(42)
    })

    test("should map over the value", () => {
      const result = ok(5)
      const mapped = result.map((x) => x * 2)

      expect(mapped.isOk()).toBe(true)
      expect(mapped.unwrap()).toBe(10)
    })

    test("should not apply mapErr on Ok", () => {
      const result = ok(42)
      const mapped = result.mapErr(() => new Error("Mapped"))

      expect(mapped.isOk()).toBe(true)
      expect(mapped.unwrap()).toBe(42)
    })

    test("should chain with andThen when returning Ok", () => {
      const result = ok(10)
      const chained = result.andThen((x) => ok(x * 2))

      expect(chained.isOk()).toBe(true)
      expect(chained.unwrap()).toBe(20)
    })

    test("should chain with andThen when returning Err", () => {
      const result = ok(10)
      const chained = result.andThen((x) => {
        if (x > 5) {
          return err(new Error("Too large"))
        }
        return ok(x * 2)
      })

      expect(chained.isErr()).toBe(true)
      if (chained.isErr()) {
        expect(chained.error.message).toBe("Too large")
      }
    })

    test("should handle complex types", () => {
      interface User {
        id: number
        name: string
      }

      const user: User = { id: 1, name: "Alice" }
      const result = ok(user)

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toEqual(user)
    })

    test("should chain multiple map operations", () => {
      const result = ok(2)
        .map((x) => x * 3)
        .map((x) => x + 5)
        .map((x) => x.toString())

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe("11")
    })
  })

  describe("Err", () => {
    test("should create an Err result with error", () => {
      const error = new Error("Something went wrong")
      const result = err(error)

      expect(result.ok).toBe(false)
      expect(result.error).toBe(error)
    })

    test("should correctly identify as Err", () => {
      const result = err(new Error("failure"))

      expect(result.isOk()).toBe(false)
      expect(result.isErr()).toBe(true)
    })

    test("should throw when unwrapping an Err", () => {
      const result = err(new Error("Cannot unwrap"))

      expect(() => result.unwrap()).toThrow()
    })

    test("should return default value with unwrapOr", () => {
      const result = err(new Error("failure"))

      expect(result.unwrapOr(42)).toBe(42)
    })

    test("should not apply map on Err", () => {
      const result = err(new Error("original error"))
      const mapped = result.map((x: number) => x * 2)

      expect(mapped.isErr()).toBe(true)
      if (mapped.isErr()) {
        expect(mapped.error.message).toBe("original error")
      }
    })

    test("should apply mapErr to transform error", () => {
      const result = err(new Error("original"))
      const mapped = result.mapErr(
        (error) => new Error(`Transformed: ${error.message}`),
      )

      expect(mapped.isErr()).toBe(true)
      if (mapped.isErr()) {
        expect(mapped.error.message).toBe("Transformed: original")
      }
    })

    test("should not execute andThen on Err", () => {
      const result = err(new Error("initial error"))
      const chained = result.andThen((x: number) => ok(x * 2))

      expect(chained.isErr()).toBe(true)
      if (chained.isErr()) {
        expect(chained.error.message).toBe("initial error")
      }
    })

    test("should handle custom error types", () => {
      class CustomError extends Error {
        public constructor(
          message: string,
          public readonly code: number,
        ) {
          super(message)
          this.name = "CustomError"
        }
      }

      const customError = new CustomError("Custom failure", 404)
      const result = err(customError)

      expect(result.isErr()).toBe(true)
      expect(result.error.code).toBe(404)
      expect(result.error.message).toBe("Custom failure")
    })

    test("should chain multiple mapErr operations", () => {
      const result = err(new Error("base"))
        .mapErr((e) => new Error(`${e.message}:1`))
        .mapErr((e) => new Error(`${e.message}:2`))

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toBe("base:1:2")
      }
    })
  })

  describe("tryCatch", () => {
    test("should return Ok for successful function", () => {
      const result = tryCatch(() => 42)

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(42)
    })

    test("should return Err for throwing function", () => {
      const result = tryCatch(() => {
        throw new Error("Something failed")
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toBe("Something failed")
      }
    })

    test("should use custom error handler", () => {
      class CustomError extends Error {
        public constructor(message: string) {
          super(message)
          this.name = "CustomError"
        }
      }

      const result = tryCatch(
        () => {
          throw new Error("Original error")
        },
        (error) => new CustomError(`Handled: ${(error as Error).message}`),
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.name).toBe("CustomError")
        expect(result.error.message).toBe("Handled: Original error")
      }
    })

    test("should handle non-Error throws with error handler", () => {
      const result = tryCatch(
        () => {
          throw "string error"
        },
        (error) => new Error(`Caught: ${error}`),
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toBe("Caught: string error")
      }
    })

    test("should work with JSON.parse example", () => {
      const result = tryCatch(
        () => JSON.parse('{"valid": true}'),
        (error) => new Error(`Parse error: ${error}`),
      )

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toEqual({ valid: true })
    })

    test("should catch JSON.parse errors", () => {
      const result = tryCatch(
        () => JSON.parse("invalid json"),
        (error) => new Error(`Parse error: ${(error as Error).message}`),
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain("Parse error")
      }
    })
  })

  describe("tryCatchAsync", () => {
    test("should return Ok for successful async function", async () => {
      const result = await tryCatchAsync(async () => {
        return await Promise.resolve(42)
      })

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(42)
    })

    test("should return Err for rejecting async function", async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error("Async failure")
      })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toBe("Async failure")
      }
    })

    test("should use custom error handler for async", async () => {
      class NetworkError extends Error {
        public constructor(
          message: string,
          public readonly statusCode: number,
        ) {
          super(message)
          this.name = "NetworkError"
        }
      }

      const result = await tryCatchAsync(
        async () => {
          throw new Error("Connection failed")
        },
        (error) =>
          new NetworkError(`Network: ${(error as Error).message}`, 500),
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.name).toBe("NetworkError")
        expect(result.error.statusCode).toBe(500)
      }
    })

    test("should handle rejected promises", async () => {
      const result = await tryCatchAsync(
        async () => await Promise.reject(new Error("Rejected")),
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toBe("Rejected")
      }
    })

    test("should work with async/await operations", async () => {
      const fetchData = async (): Promise<string> => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return "fetched data"
      }

      const result = await tryCatchAsync(async () => await fetchData())

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe("fetched data")
    })
  })

  describe("Real-world scenarios", () => {
    test("should handle user validation flow", () => {
      interface User {
        id: number
        email: string
        age: number
      }

      function validateEmail(email: string): Result<string, Error> {
        if (email.includes("@")) {
          return ok(email)
        }
        return err(new Error("Invalid email format"))
      }

      function validateAge(age: number): Result<number, Error> {
        if (age >= 18) {
          return ok(age)
        }
        return err(new Error("Must be 18 or older"))
      }

      function createUser(email: string, age: number): Result<User, Error> {
        return validateEmail(email).andThen((validEmail) =>
          validateAge(age).map((validAge) => ({
            id: 1,
            email: validEmail,
            age: validAge,
          })),
        )
      }

      const successResult = createUser("user@example.com", 25)
      expect(successResult.isOk()).toBe(true)
      expect(successResult.unwrap().email).toBe("user@example.com")

      const invalidEmail = createUser("invalid-email", 25)
      expect(invalidEmail.isErr()).toBe(true)
      if (invalidEmail.isErr()) {
        expect(invalidEmail.error.message).toBe("Invalid email format")
      }

      const invalidAge = createUser("user@example.com", 16)
      expect(invalidAge.isErr()).toBe(true)
      if (invalidAge.isErr()) {
        expect(invalidAge.error.message).toBe("Must be 18 or older")
      }
    })

    test("should handle database query simulation", () => {
      interface DbRecord {
        id: number
        data: string
      }

      const mockDb = new Map<number, DbRecord>([
        [1, { id: 1, data: "first" }],
        [2, { id: 2, data: "second" }],
      ])

      function findById(id: number): Result<DbRecord, Error> {
        const record = mockDb.get(id)
        if (record) {
          return ok(record)
        }
        return err(new Error(`Record with id ${id} not found`))
      }

      const found = findById(1)
      expect(found.isOk()).toBe(true)
      expect(found.unwrap().data).toBe("first")

      const notFound = findById(999)
      expect(notFound.isErr()).toBe(true)
      if (notFound.isErr()) {
        expect(notFound.error.message).toContain("not found")
      }
    })

    test("should handle chained transformations", () => {
      const result = ok("  hello world  ")
        .map((s) => s.trim())
        .map((s) => s.toUpperCase())
        .map((s) => s.split(" "))
        .andThen((words) => {
          if (words.length > 1) {
            return ok(words)
          }
          return err(new Error("Expected multiple words"))
        })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.unwrap()).toEqual(["HELLO", "WORLD"])
      }
    })

    test("should handle error recovery with unwrapOr", () => {
      function divide(a: number, b: number): Result<number, Error> {
        if (b === 0) {
          return err(new Error("Division by zero"))
        }
        return ok(a / b)
      }

      const validDivision = divide(10, 2).unwrapOr(0)
      expect(validDivision).toBe(5)

      const invalidDivision = divide(10, 0).unwrapOr(0)
      expect(invalidDivision).toBe(0)
    })
  })

  describe("Type narrowing", () => {
    test("should narrow type with isOk", () => {
      const result: Result<number, Error> = ok(42)

      if (result.isOk()) {
        // Type should be narrowed to Ok<number>
        expect(result.value).toBe(42)
      }
    })

    test("should narrow type with isErr", () => {
      const result: Result<number, Error> = err(new Error("failed"))

      if (result.isErr()) {
        // Type should be narrowed to Err<Error>
        expect(result.error.message).toBe("failed")
      }
    })

    test("should handle union types correctly", () => {
      function processResult(result: Result<string, Error>): string {
        if (result.isOk()) {
          return result.value.toUpperCase()
        } else {
          return `Error: ${result.error.message}`
        }
      }

      expect(processResult(ok("success"))).toBe("SUCCESS")
      expect(processResult(err(new Error("failed")))).toBe("Error: failed")
    })
  })
})
