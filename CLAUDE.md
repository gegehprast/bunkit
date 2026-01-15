# Instructions for AI Agents Working on BunKit

BunKit is a project that aims to be a production-ready monorepo template for building HTTP APIs and WebSocket backends with Bun, TypeScript, and PostgreSQL.

## Bun Runtime (MANDATORY)

**You MUST use Bun, not Node.js:**

- ✅ `bun <file>` — Never use `node` or `ts-node`
- ✅ `bun test` — Never use `jest` or `vitest`
- ✅ `bun build` — Never use `webpack` or `esbuild`
- ✅ `bun install` — Never use `npm`, `yarn`, or `pnpm`
- ✅ `bun run <script>` — Use this for all package.json scripts
- ✅ Bun automatically loads .env files — Never install or use `dotenv`

## Bun Native APIs (MANDATORY)

**Always prefer Bun's native APIs over npm packages:**

- ✅ `bun:sqlite` for SQLite — Never use `better-sqlite3`
- ✅ `Bun.redis` for Redis — Never use `ioredis`
- ✅ `Bun.file` for file handling — Never use `fs` or `fs-extra`
- ✅ `Bun.serve` for HTTP server — Never use `express`, `koa`, or `fastify`
- ✅ `Bun.webSocket` for WebSockets — Never use `ws` or `socket.io`
- And so on...

## Type Safety (MANDATORY)
- **Avoid `any` at all cost**
- **All things must be strongly typed, or properly inferred**

## Result Pattern (MANDATORY)
**Use `Result<T, E>` for error handling instead of exceptions:**
```typescript
import { ok, err, type Result } from "@bunkit/result"
// ✅ CORRECT: Function returning Result
function findUser(id: string): Result<User, AppError> {
  const user = db.getUserById(id)
  if (user) {
    return ok(user)
  } else {
    return err(new NotFoundError(`User with id ${id} not found`))
  }
}
// ❌ WRONG: Function throwing exceptions
function findUser(id: string): User {
  const user = db.getUserById(id)
  if (user) {
    return user
  } else {  
    throw new Error(`User with id ${id} not found`)
  }
}
```

### Chain Operations with Result

**Use `.map()` and `.andThen()` for composing operations:**

```typescript
// ✅ CORRECT: Chain operations safely
const result = findUser('123')
  .map(user => user.email)
  .andThen(email => sendEmail(email))
  
if (result.isOk()) {
  console.log('Email sent!')
} else {
  console.error('Failed:', result.error)
}
```

**Non-negotiable rules:**
- ✅ All service methods MUST return `Result<T, E>`
- ✅ All database operations MUST return `Result<T, E>`
- ✅ Use explicit error types from `@/core/errors`
- ❌ Never use generic `Error` class
- ❌ Never throw exceptions in business logic

## Class Access Modifiers (MANDATORY)
**Always use explicit access modifiers in classes, even block for public:**

```typescripttypescript
// ✅ CORRECT: Explicit access modifiers
class UserService {
  public constructor(private userRepository: UserRepository) {}
  public getUser(id: string): Result<User, AppError> {
    return this.userRepository.findById(id)
  }
}
// ❌ WRONG: Missing access modifiers
class UserService {
  constructor(userRepository: UserRepository) {}
  getUser(id: string): Result<User, AppError> {
    return this.userRepository.findById(id)
  }
}
```

## Scripts (MANDATORY)
**Most scripts can be run via `bun run <script>` from the root directory:**

Check the root `package.json` for available scripts. Always run scripts from the root as much as possible.

## Testing (MANDATORY)

### Writing Tests

**Test structure:**

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

describe('Feature Name', () => {
  beforeAll(async () => {
    // Setup (runs once)
  })
  
  afterAll(async () => {
    // Cleanup (runs once)
  })

  test('should do something', () => {
    expect(true).toBe(true)
  })
})
```

**Test Organization:**
- Unit tests are in `apps/backend/tests/` mirroring the src structure
- Integration tests are in `apps/backend/tests/integration/`
- Database tests use the test database configured in `.env.test`
- All tests use the Result pattern for error handling

**Database tests must:**
- ✅ Use the test database (from `.env.test`)
- ✅ Clean up data in `beforeEach` or `afterEach`
- ✅ Use Result pattern for assertions
- ❌ Never touch development database

### Running Tests

**IMPORTANT:** Tests must be run from the each app or package directory:

```bash
# From project root
cd apps/backend
bun test
```
