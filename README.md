# BunKit

A production-ready monorepo template for building HTTP APIs and WebSocket backends with Bun, TypeScript, and PostgreSQL.

## Overview

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) >= 1.3.3 |
| HTTP/WebSocket | [`@bunkit/server`](packages/server) — custom type-safe framework |
| Error handling | [`@bunkit/result`](packages/result) — Result pattern |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Validation | [Zod v4](https://zod.dev) |
| Auth | JWT via [jose](https://github.com/panva/jose) |
| API docs | OpenAPI 3.1 via [zod-openapi](https://github.com/samchungy/zod-openapi) |
| Code quality | [Biome](https://biomejs.dev) |
| Frontend (example) | React 19 + [Rolldown-Vite](https://vite.dev) + TailwindCSS 4 + TanStack Query |

The included React frontend is a reference implementation. Replace it with any framework or no framework, or just delete it.

## Prerequisites

- Bun >= 1.3.3
- PostgreSQL >= 14

## Quick Start

```bash
git clone https://github.com/gegehprast/bunkit my-project && cd my-project
bun install
```

Create `apps/backend/.env.local`:

```bash
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://user:password@localhost:5432/myapp_dev
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters
JWT_REFRESH_EXPIRES_IN=30d
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

```bash
bun run backend:db:generate   # generate migrations from schemas
bun run backend:db:migrate    # apply migrations

bun run backend:dev           # backend on http://localhost:3001
bun run frontend:dev          # frontend on http://localhost:5173
```

API docs available at `http://localhost:3001/docs` when the backend is running.

## Project Structure

```
bunkit/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── auth/          # JWT authentication
│   │   │   ├── config/        # Environment config
│   │   │   ├── core/          # Server, logger, errors, shutdown
│   │   │   ├── db/            # Drizzle client, schemas, repositories
│   │   │   ├── middlewares/
│   │   │   └── routes/        # HTTP + WebSocket routes
│   │   ├── drizzle/           # Migrations
│   │   ├── scripts/           # Code generation scripts
│   │   └── tests/
│   └── frontend/              # Example React app (replaceable)
│       └── src/
│           ├── components/
│           ├── hooks/
│           ├── lib/
│           └── generated/     # Auto-generated types from backend
├── packages/
│   ├── server/                # @bunkit/server
│   └── result/                # @bunkit/result
└── scripts/
    └── lint.ts
```

## Scripts

All commands run from the repository root.

### Workspace

| Command | Description |
|---------|-------------|
| `bun run lint` | Lint all packages |
| `bun run check` | Biome check with auto-fix |
| `bun run format` | Format all code |

### Backend

| Command | Description |
|---------|-------------|
| `bun run backend:dev` | Start with hot reload |
| `bun run backend:start` | Start (production) |
| `bun run backend:typecheck` | Type check |
| `bun run backend:test` | Run tests |
| `bun run backend:db:generate` | Generate Drizzle migrations |
| `bun run backend:db:migrate` | Apply migrations |
| `bun run backend:db:studio` | Open Drizzle Studio |
| `bun run backend:openapi:generate` | Generate OpenAPI types → `apps/frontend/src/generated` |
| `bun run backend:ws-types:generate` | Generate WebSocket types → `apps/frontend/src/generated` |

### Frontend

| Command | Description |
|---------|-------------|
| `bun run frontend:dev` | Start dev server |
| `bun run frontend:build` | Production build |
| `bun run frontend:preview` | Preview production build |
| `bun run frontend:typecheck` | Type check |

## Core Concepts

### Defining Routes

```typescript
import { createRoute } from "@bunkit/server"
import { z } from "zod"

const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
})

createRoute("GET", "/api/todos/:id")
  .response(TodoSchema)
  .handler(({ params }) => {
    return { id: params.id, title: "Example", completed: false }
  })
```

### Result Pattern

All service and repository methods must return `Result<T, E>` — never throw.

```typescript
import { ok, err, type Result } from "@bunkit/result"

function findUser(id: string): Result<User, AppError> {
  const user = db.getUserById(id)
  return user ? ok(user) : err(new NotFoundError(`User ${id} not found`))
}

const result = findUser("123")
  .map(user => user.email)
  .andThen(email => sendEmail(email))
```

### Type Generation

After modifying backend schemas, regenerate types for the frontend:

```bash
bun run backend:openapi:generate    # REST API types
bun run backend:ws-types:generate   # WebSocket message types
```

Generated files are written to `apps/frontend/src/generated/`. Use them with `openapi-fetch`:

```typescript
import createClient from "openapi-fetch"
import type { paths } from "@/generated/openapi"

const client = createClient<paths>({ baseUrl: "http://localhost:3001" })

const { data, error } = await client.GET("/api/todos/{id}", {
  params: { path: { id: "123" } },
})
```

### WebSocket Routes

```typescript
import { createWebSocketRoute } from "@bunkit/server"
import { z } from "zod"

createWebSocketRoute("/ws/chat")
  .onMessage("chat", z.object({ roomId: z.string(), message: z.string() }), ({ data, ws }) => {
    ws.send({ type: "chat", ...data })
  })
```

## Example Features

The template ships with working examples that can be removed or replaced:

- **Auth** — registration, login, JWT access/refresh tokens, protected routes
- **Todos** — full CRUD with user-scoped data
- **Chat** — WebSocket rooms, message broadcasting, typing indicators, user presence

## Adding New Routes

1. Create a route file in `apps/backend/src/routes/`
2. Register it in `apps/backend/src/routes/index.ts`
3. Run `bun run backend:openapi:generate` to update frontend types

## Adding Database Tables

1. Define schema in `apps/backend/src/db/schemas/`
2. `bun run backend:db:generate` — generate migration
3. `bun run backend:db:migrate` — apply migration
4. Create a repository in `apps/backend/src/db/repositories/`

## Testing

Tests must be run from each package directory:

```bash
cd apps/backend && bun test
cd packages/server && bun test
cd packages/result && bun test
```

Root shortcuts: `bun run backend:test`, `bun run server:test`, `bun run result:test`

## Deployment

**Backend** — Bun runs TypeScript directly, no build step required:

```bash
# Set NODE_ENV=production, strong JWT secrets, production DATABASE_URL, correct CORS_ORIGIN
bun run backend:db:migrate
bun run backend:start
```

**Frontend**:

```bash
bun run frontend:build   # outputs to apps/frontend/dist/
```

Deploy `apps/frontend/dist/` to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

## License

MIT
