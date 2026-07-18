# Instructions for AI Agents Working on BunKit

BunKit is a project that aims to be a production-ready monorepo template for building HTTP APIs and WebSocket backends with Bun, TypeScript, and PostgreSQL.

## Project Layout

- `apps/backend` — HTTP/WebSocket API (`src/`), tests in `tests/` (see Testing below)
- `apps/frontend` — reference React 19 + Vite + TailwindCSS frontend (example only; safe to replace or delete)
- `packages/server` (`@bunkit/server`) — the type-safe HTTP/WebSocket framework built on `Bun.serve`
- `packages/result` (`@bunkit/result`) — the `Result<T, E>` implementation used everywhere
- Workspace uses Bun's `catalog:` feature in the root `package.json` for shared dependency versions

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

- ✅ `Bun.file` for file handling — Never use `fs` or `fs-extra`
- ✅ HTTP and WebSocket routes go through [`@bunkit/server`](packages/server) (built on `Bun.serve`) — never add `express`, `koa`, `fastify`, `ws`, or `socket.io`
- ✅ If SQLite is ever needed, use `bun:sqlite` — never `better-sqlite3`
- And so on...

Note: this project's database is PostgreSQL via Drizzle ORM (`postgres` package), not SQLite — the `bun:sqlite` guidance only applies if a use case for embedded/local SQLite comes up.

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
- ❌ Never throw on internal stuff

## Class Access Modifiers (MANDATORY)
**Always use explicit access modifiers in classes, even for public:**

```typescript
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
**Always run scripts via `bun run <script>` from the root directory** — do not `cd` into an app/package first. Check the root `package.json` for the full list (e.g. `backend:dev`, `backend:test`, `backend:typecheck`, `backend:db:migrate`, `frontend:dev`, `result:test`, `server:test`).

## Testing (MANDATORY)

### Writing Tests

**Test Organization (mirrors `apps/backend/src`):**
- `apps/backend/tests/` — unit tests, organized by domain (`core/`, `db/`, `auth/`, `middlewares/`)
- `apps/backend/tests/integration/` — integration tests, including HTTP route and WebSocket tests (`integration/routes/`)
- Database tests use the test database configured in `.env.test`
- All tests use the Result pattern for error handling

**Database tests must:**
- ✅ Use the test database (from `.env.test`)
- ✅ Clean up data in `beforeEach` or `afterEach`
- ✅ Use Result pattern for assertions
- ❌ Never touch development database

### Running Tests

Preferred: run `bun test` from the project root — it runs across all workspaces (backend, frontend, `packages/result`, `packages/server`) in one go, no `cd` needed.

```bash
bun test                # all workspaces
bun test apps/backend   # scope to one workspace/path
bun test -t "some name" # filter by test name
```

The root scripts (`bun run backend:test`, `bun run frontend:test`, `bun run result:test`, `bun run server:test`) are equivalent but scoped to a single workspace.
