# @bunkit/result Package

Type-safe error handling using the Result pattern. Eliminates try-catch blocks and makes error handling explicit and composable.

## Installation

```bash
bun add @bunkit/result
```

## Why Result Pattern?

### Traditional Error Handling

```typescript
// With try-catch
async function getUser(id: string): Promise<User> {
  try {
    const user = await db.findUser(id)
    if (!user) {
      throw new Error("User not found")
    }
    return user
  } catch (error) {
    // What type is error?
    // Did we handle all cases?
    throw error
  }
}

// Caller has no idea this can fail
const user = await getUser("123")
```

### With Result Pattern

```typescript
// With Result
async function getUser(id: string): Promise<Result<User, Error>> {
  const user = await db.findUser(id)
  if (!user) {
    return err(new Error("User not found"))
  }
  return ok(user)
}

// Caller must handle both cases
const result = await getUser("123")
if (result.isErr()) {
  console.error(result.error)
  return
}
const user = result.value // TypeScript knows this is User
```

## Basic Usage

### Creating Results

```typescript
import { ok, err, type Result } from "@bunkit/result"

// Success
const success = ok(42)
// Type: Ok<number>

// Failure
const failure = err(new Error("Something went wrong"))
// Type: Err<Error>

// Function returning Result
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return err(new Error("Division by zero"))
  }
  return ok(a / b)
}
```

### Checking Results

```typescript
const result = divide(10, 2)

// Type guard with isOk
if (result.isOk()) {
  console.log(result.value) // 5
} else {
  console.error(result.error)
}

// Type guard with isErr
if (result.isErr()) {
  console.error(result.error)
} else {
  console.log(result.value)
}
```

### Unwrapping Results

```typescript
// Unwrap or provide default
const value = result.unwrapOr(0)

// Unwrap or throw (use sparingly!)
const value = result.unwrap() // Throws if error

// Unwrap error or throw
const error = result.unwrapErr() // Throws if ok
```

## Transforming Results

### `map` - Transform Success Value

```typescript
const result = ok(5)
  .map(x => x * 2)        // Ok(10)
  .map(x => x.toString()) // Ok("10")

// Error is passed through
const error = err(new Error("Failed"))
  .map(x => x * 2) // Still Err(...)
```

### `mapErr` - Transform Error

```typescript
const result = err(new Error("DB error"))
  .mapErr(e => new CustomError(e.message))

// Success is passed through
const success = ok(42)
  .mapErr(e => new CustomError(e.message)) // Still Ok(42)
```

### `andThen` - Chain Operations

```typescript
function parseNumber(s: string): Result<number, Error> {
  const n = Number(s)
  return isNaN(n) ? err(new Error("Not a number")) : ok(n)
}

function divideBy(n: number, divisor: number): Result<number, Error> {
  if (divisor === 0) {
    return err(new Error("Division by zero"))
  }
  return ok(n / divisor)
}

// Chain operations that return Results
const result = parseNumber("10")
  .andThen(n => divideBy(n, 2))
  .andThen(n => divideBy(n, 5))
// Result: Ok(1)

// Short-circuits on first error
const error = parseNumber("abc")
  .andThen(n => divideBy(n, 2)) // Never called
// Result: Err("Not a number")
```

### `orElse` - Recovery

```typescript
function fetchFromCache(): Result<Data, Error> {
  return err(new Error("Cache miss"))
}

function fetchFromDB(): Result<Data, Error> {
  return ok({ id: 1, name: "Data" })
}

// Try cache, fallback to DB
const result = fetchFromCache()
  .orElse(e => {
    console.log("Cache failed, trying DB")
    return fetchFromDB()
  })
```

## Pattern Matching

### `match` - Exhaustive Handling

```typescript
const message = result.match({
  ok: value => `Success: ${value}`,
  err: error => `Error: ${error.message}`
})

console.log(message)
```

### Async Match

```typescript
const user = await result.matchAsync({
  ok: async value => await fetchUser(value),
  err: async error => {
    await logError(error)
    return null
  }
})
```

## Real-World Examples

### Database Operations

```typescript
async function createUser(
  data: CreateUserData
): Promise<Result<User, CreateUserError>> {
  // Check if user exists
  const existing = await db.findUserByEmail(data.email)
  if (existing) {
    return err({
      code: "USER_EXISTS",
      message: "User with this email already exists"
    })
  }

  // Hash password
  const hashResult = await hashPassword(data.password)
  if (hashResult.isErr()) {
    return err({
      code: "HASH_ERROR",
      message: "Failed to hash password"
    })
  }

  // Create user
  try {
    const user = await db.createUser({
      ...data,
      passwordHash: hashResult.value
    })
    return ok(user)
  } catch (error) {
    return err({
      code: "DB_ERROR",
      message: "Failed to create user"
    })
  }
}

// Usage
const result = await createUser(userData)
if (result.isErr()) {
  switch (result.error.code) {
    case "USER_EXISTS":
      return res.conflict(result.error.message)
    case "HASH_ERROR":
    case "DB_ERROR":
      return res.internalError(result.error.message)
  }
}

return res.created(result.value)
```

### API Route Handler

```typescript
createRoute("POST", "/api/users")
  .body(CreateUserSchema)
  .response(UserSchema, { status: 201 })
  .handler(async ({ body, res }) => {
    const result = await userService.create(body)

    if (result.isErr()) {
      const error = result.error

      if (error.code === "USER_EXISTS") {
        return res.conflict(error.message)
      }

      if (error.code === "VALIDATION_ERROR") {
        return res.badRequest(error.message)
      }

      return res.internalError("Failed to create user")
    }

    return res.created(result.value)
  })
```

### Chaining Multiple Operations

```typescript
async function registerUser(
  data: RegisterData
): Promise<Result<AuthResponse, Error>> {
  return parseEmail(data.email)
    .andThen(email => validatePassword(data.password).map(() => email))
    .andThen(async email => {
      const user = await createUser({ email, password: data.password })
      return user
    })
    .andThen(async user => {
      const token = await generateToken(user.id)
      return token.map(token => ({ user, token }))
    })
}

// Clean error handling
const result = await registerUser(data)
if (result.isErr()) {
  return res.badRequest(result.error.message)
}

return res.ok(result.value)
```

### Error Recovery

```typescript
async function fetchUserData(
  userId: string
): Promise<Result<UserData, Error>> {
  // Try cache first
  return fetchFromCache(userId)
    .orElse(async () => {
      // Cache miss, try database
      console.log("Cache miss, fetching from DB")
      return fetchFromDB(userId)
    })
    .orElse(async () => {
      // DB failed, try backup
      console.log("DB failed, trying backup")
      return fetchFromBackup(userId)
    })
}
```

## Type-Safe Errors

Define specific error types:

```typescript
type UserError =
  | { code: "NOT_FOUND"; message: string }
  | { code: "ALREADY_EXISTS"; message: string; email: string }
  | { code: "INVALID_PASSWORD"; message: string }
  | { code: "DB_ERROR"; message: string; cause?: Error }

function findUser(id: string): Result<User, UserError> {
  const user = db.findUser(id)
  if (!user) {
    return err({
      code: "NOT_FOUND",
      message: `User ${id} not found`
    })
  }
  return ok(user)
}

// Type-safe error handling
const result = findUser("123")
if (result.isErr()) {
  const error = result.error
  switch (error.code) {
    case "NOT_FOUND":
      // TypeScript knows error has message
      console.log(error.message)
      break
    case "ALREADY_EXISTS":
      // TypeScript knows error has email
      console.log(error.email)
      break
    // ... handle other cases
  }
}
```

## Utility Functions

### `fromThrowable`

Convert throwing functions to Result-returning functions:

```typescript
import { fromThrowable } from "@bunkit/result"

const safeParseJSON = fromThrowable(JSON.parse)

const result = safeParseJSON('{"name":"John"}')
if (result.isOk()) {
  console.log(result.value.name)
} else {
  console.error("Invalid JSON:", result.error)
}
```

### `combine`

Combine multiple Results:

```typescript
import { combine } from "@bunkit/result"

const result1 = ok(1)
const result2 = ok(2)
const result3 = ok(3)

const combined = combine([result1, result2, result3])
// Ok([1, 2, 3])

const withError = combine([ok(1), err(new Error("Failed")), ok(3)])
// Err(Error("Failed"))
```

## Best Practices

### 1. Use Result for Expected Failures

```typescript
// ✅ Good - Expected failure
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return err(new Error("Division by zero"))
  return ok(a / b)
}

// ❌ Bad - Unexpected failure
function add(a: number, b: number): Result<number, Error> {
  return ok(a + b) // Never fails, no need for Result
}
```

### 2. Define Specific Error Types

```typescript
// ✅ Good - Specific error type
type UserError = 
  | { code: "NOT_FOUND" }
  | { code: "INVALID_EMAIL" }

// ❌ Bad - Generic error
type UserError = Error
```

### 3. Handle Errors Close to Creation

```typescript
// ✅ Good - Handle immediately
const result = await fetchUser(id)
if (result.isErr()) {
  return res.notFound("User not found")
}
const user = result.value

// ❌ Bad - Pass Result around
return processUser(result) // Caller has to handle error
```

### 4. Use andThen for Chaining

```typescript
// ✅ Good - Clean chaining
return validateInput(data)
  .andThen(createUser)
  .andThen(sendWelcomeEmail)

// ❌ Bad - Nested ifs
const valid = validateInput(data)
if (valid.isErr()) return valid
const user = await createUser(valid.value)
if (user.isErr()) return user
// ...
```

### 5. Don't Overuse unwrap()

```typescript
// ✅ Good - Explicit handling
if (result.isOk()) {
  processValue(result.value)
}

// ❌ Bad - Can throw
processValue(result.unwrap())
```

## API Reference

### Creating Results

```typescript
ok<T>(value: T): Ok<T>
err<E>(error: E): Err<E>
```

### Type Guards

```typescript
result.isOk(): boolean
result.isErr(): boolean
```

### Unwrapping

```typescript
result.unwrap(): T          // Throws if Err
result.unwrapOr(default: T): T
result.unwrapErr(): E       // Throws if Ok
```

### Transforming

```typescript
result.map<U>(fn: (value: T) => U): Result<U, E>
result.mapErr<F>(fn: (error: E) => F): Result<T, F>
result.andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E>
result.orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>
```

### Pattern Matching

```typescript
result.match<U>(handlers: {
  ok: (value: T) => U,
  err: (error: E) => U
}): U

result.matchAsync<U>(handlers: {
  ok: (value: T) => Promise<U>,
  err: (error: E) => Promise<U>
}): Promise<U>
```

## Examples in BunKit

See how Result is used throughout BunKit:

- **Server Operations**: `apps/backend/src/core/server.ts`
- **Database Layer**: `apps/backend/src/db/repositories/`
- **Auth Service**: `apps/backend/src/auth/auth.service.ts`
- **Route Handlers**: `apps/backend/src/routes/todos.routes.ts`

## Next Steps

- See [Server Package](./04-server-package.md) for integrating with routes
- Check [Backend Application](./06-backend-application.md) for patterns
- Read [Testing Guide](./13-testing.md) for testing Result-based code
