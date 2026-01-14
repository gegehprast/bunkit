# @bunkit/result

Type-safe error handling using the Result pattern. Eliminates the need for try-catch blocks and makes error handling explicit and composable.

## 🚀 Basic Usage

### Creating Results

```typescript
import { ok, err, type Result } from '@bunkit/result'

// Success case
const success = ok(42)
// Type: Ok<number>

// Error case
const failure = err(new Error('Something went wrong'))
// Type: Err<Error>

// Function returning Result
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return err(new Error('Division by zero'))
  }
  return ok(a / b)
}
```

### Checking Results

```typescript
const result = divide(10, 2)

if (result.isOk()) {
  console.log(result.value) // 5
} else {
  console.error(result.error) // Error
}

// Type guards work!
if (result.isOk()) {
  result.value // TypeScript knows this is the success value
} else {
  result.error // TypeScript knows this is the error
}
```

### Unwrapping Results

```typescript
// Unwrap or throw (use sparingly!)
const value = result.unwrap()
// Throws if result is Err

// Unwrap with default value
const value = result.unwrapOr(0)
// Returns 0 if result is Err
```

## 🔗 Chaining Operations

### map - Transform success values

```typescript
function getUser(id: string): Result<User, Error> {
  // ...
}

const userName: Result<string, Error> = getUser('123')
  .map(user => user.name)

// If getUser returns Ok, map transforms the value
// If getUser returns Err, map is skipped
```

### mapErr - Transform errors

```typescript
const result = divide(10, 0)
  .mapErr(error => new DatabaseError(error.message))

// Converts Error to DatabaseError
```

### andThen - Chain operations that return Results

```typescript
function getUser(id: string): Result<User, Error> {
  // ...
}

function getUserPosts(user: User): Result<Post[], Error> {
  // ...
}

const posts: Result<Post[], Error> = getUser('123')
  .andThen(user => getUserPosts(user))

// Short-circuits on first error
```

## 🛡️ Error Handling Helpers

### tryCatch - Wrap synchronous code

```typescript
import { tryCatch } from '@bunkit/result'

const result = tryCatch(() => {
  return JSON.parse(jsonString)
})
// Result<any, Error>

// With custom error handler
const result = tryCatch(
  () => JSON.parse(jsonString),
  (error) => new ValidationError('Invalid JSON')
)
// Result<any, ValidationError>
```

### tryCatchAsync - Wrap async code

```typescript
import { tryCatchAsync } from '@bunkit/result'

const result = await tryCatchAsync(async () => {
  const response = await fetch('/api/users')
  return response.json()
})
// Result<any, Error>

// With custom error handler
const result = await tryCatchAsync(
  async () => {
    const response = await fetch('/api/users')
    return response.json()
  },
  (error) => new NetworkError('Failed to fetch users')
)
// Result<any, NetworkError>
```

## 📋 Real-World Examples

### Service Layer

```typescript
import { ok, err, type Result } from '@bunkit/result'
import { NotFoundError, DatabaseError } from '@/types/errors'

class UserService {
  async getUser(id: string): Promise<Result<User, NotFoundError | DatabaseError>> {
    try {
      const user = await db.users.findUnique({ where: { id } })
      
      if (!user) {
        return err(new NotFoundError('User not found'))
      }
      
      return ok(user)
    } catch (error) {
      return err(new DatabaseError('Failed to fetch user'))
    }
  }
  
  async createUser(data: CreateUserData): Promise<Result<User, ValidationError | DatabaseError>> {
    // Validate data
    const validation = validateUserData(data)
    if (validation.isErr()) {
      return validation // Return early with validation error
    }
    
    // Create user
    try {
      const user = await db.users.create({ data })
      return ok(user)
    } catch (error) {
      return err(new DatabaseError('Failed to create user'))
    }
  }
}
```

### HTTP Handler

```typescript
import { resultToResponse, ok } from '@/types'

async function getUserHandler(req: Request, ctx: RequestContext): Promise<Response> {
  const userId = ctx.params.id
  
  // Call service (returns Result)
  const result = await userService.getUser(userId)
  
  // Convert Result to HTTP Response
  if (result.isErr()) {
    return resultToResponse(result, ctx)
  }
  
  // Success case
  return ok(result.value, 200, ctx.requestId)
}
```

### Chaining Multiple Operations

```typescript
async function updateUserProfile(
  userId: string, 
  updates: ProfileUpdates
): Promise<Result<User, NotFoundError | ValidationError | DatabaseError>> {
  return (await userService.getUser(userId))
    .andThen(user => validateProfileUpdates(updates))
    .andThen(validUpdates => userService.updateUser(userId, validUpdates))
}

// Short-circuits at first error
// Type-safe: TypeScript knows all possible error types
```

### Combining Multiple Results

```typescript
import { combineResults } from '@/types/result-helpers'

async function getUserWithPosts(userId: string): Promise<Result<UserWithPosts, Error>> {
  const [userResult, postsResult] = await Promise.all([
    userService.getUser(userId),
    postService.getUserPosts(userId),
  ])
  
  // Combine results - returns first error or all values
  return combineResults([userResult, postsResult])
    .map(([user, posts]) => ({ ...user, posts }))
}
```

## 🎨 Best Practices

### 1. Be explicit about error types

```typescript
// ✅ Good: Explicit error types
function divide(a: number, b: number): Result<number, DivisionError> {
  // ...
}

// ❌ Bad: Generic Error
function divide(a: number, b: number): Result<number, Error> {
  // ...
}
```

### 2. Use union types for multiple errors

```typescript
// ✅ Good: Union of specific error types
function getUser(id: string): Result<User, NotFoundError | DatabaseError> {
  // ...
}
```

### 3. Prefer not to use unwrap()

```typescript
// ❌ Bad: unwrap() can throw
const user = userResult.unwrap()

// ✅ Good: Handle both cases
if (userResult.isOk()) {
  const user = userResult.value
} else {
  return resultToResponse(userResult, ctx)
}

// ✅ Good: Use unwrapOr with default
const user = userResult.unwrapOr(defaultUser)
```

## 📚 API Reference

### Core Types

```typescript
type Result<T, E extends Error> = Ok<T> | Err<E>

class Ok<T> {
  readonly ok: true
  readonly value: T
  
  isOk(): this is Ok<T>
  isErr(): this is never
  unwrap(): T
  unwrapOr(defaultValue: T): T
  map<U>(fn: (value: T) => U): Result<U, never>
  mapErr<F>(fn: (error: never) => F): Result<T, F>
  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, F>
}

class Err<E extends Error> {
  readonly ok: false
  readonly error: E
  
  isOk(): this is never
  isErr(): this is Err<E>
  unwrap(): never
  unwrapOr<T>(defaultValue: T): T
  map<U>(fn: (value: never) => U): Result<U, E>
  mapErr<F>(fn: (error: E) => F): Result<never, F>
  andThen<U, F>(fn: (value: never) => Result<U, F>): Result<U, E | F>
}
```

### Functions

```typescript
// Create Results
function ok<T>(value: T): Ok<T>
function err<E extends Error>(error: E): Err<E>

// Error handling
function tryCatch<T, E extends Error>(
  fn: () => T,
  errorHandler?: (error: unknown) => E
): Result<T, E>

function tryCatchAsync<T, E extends Error>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => E
): Promise<Result<T, E>>
```

## 🔒 Type Safety

The Result pattern is fully type-safe:

```typescript
function example(): Result<number, ValidationError | DatabaseError> {
  // TypeScript enforces that you return either:
  // - ok(number)
  // - err(ValidationError | DatabaseError)
}

const result = example()

// Type narrowing works
if (result.isOk()) {
  result.value // Type: number
} else {
  result.error // Type: ValidationError | DatabaseError
}

// Chaining preserves types
const mapped = result
  .map(n => n.toString()) // Result<string, ValidationError | DatabaseError>
  .mapErr(e => new InternalError(e.message)) // Result<string, InternalError>
```

## 🆚 Comparison with try-catch

### Before (try-catch)

```typescript
async function getUser(id: string): Promise<User> {
  try {
    const user = await db.users.findUnique({ where: { id } })
    if (!user) {
      throw new Error('User not found')
    }
    return user
  } catch (error) {
    // What errors can be thrown? TypeScript doesn't know!
    throw error
  }
}

// Caller doesn't know what errors can be thrown
const user = await getUser('123') // Might throw, but what?
```

### After (Result pattern)

```typescript
async function getUser(id: string): Promise<Result<User, NotFoundError | DatabaseError>> {
  try {
    const user = await db.users.findUnique({ where: { id } })
    if (!user) {
      return err(new NotFoundError('User not found'))
    }
    return ok(user)
  } catch (error) {
    return err(new DatabaseError('Database error'))
  }
}

// Caller knows exactly what errors can occur
const result = await getUser('123')
// Type: Result<User, NotFoundError | DatabaseError>

// Must handle errors explicitly
if (result.isErr()) {
  // Handle NotFoundError or DatabaseError
}
```

## 🤝 Contributing

This package is part of BunKit. See the main README for contribution guidelines.

## 📄 License

MIT
