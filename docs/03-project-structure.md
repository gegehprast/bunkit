# Project Structure

Understanding BunKit's monorepo architecture and file organization.

## Monorepo Overview

BunKit uses Bun workspaces to organize code into applications and shared packages:

```
bunkit/
├── apps/                   # Applications
│   ├── backend/           # REST API + WebSocket server
│   └── frontend/          # React example app
├── packages/              # Shared packages
│   ├── server/           # HTTP/WebSocket framework
│   └── result/           # Result pattern library
├── scripts/              # Monorepo scripts
├── docs/                 # Documentation (you are here)
├── docker-compose.yml    # Docker services
├── package.json          # Root workspace config
└── biome.json           # Linting/formatting config
```

## Backend Application (`apps/backend/`)

Complete REST API with WebSocket support.

### Directory Structure

```
apps/backend/
├── drizzle/              # Database migrations
│   ├── 0000_*.sql       # SQL migration files
│   └── meta/            # Migration metadata
├── public/              # Static files (served at /public)
├── scripts/             # Build and utility scripts
│   ├── generate-openapi.ts    # OpenAPI generator
│   ├── generate-ws-types.ts   # WebSocket types generator
│   └── migrate.ts             # Migration runner
├── src/
│   ├── main.ts          # Application entry point
│   ├── auth/            # Authentication logic
│   ├── config/          # Configuration management
│   ├── core/            # Core infrastructure
│   ├── db/              # Database layer
│   ├── middlewares/     # Middleware functions
│   └── routes/          # API routes
├── tests/               # Test suites
├── docker-entrypoint.sh # Docker startup script
├── Dockerfile          # Production image
├── drizzle.config.ts   # Drizzle ORM config
├── openapi.json        # Generated OpenAPI spec
└── package.json        # Backend dependencies
```

### Key Files

#### `src/main.ts`
Entry point that:
- Loads environment configuration
- Connects to database
- Creates server instance
- Registers routes
- Starts server
- Sets up graceful shutdown

```typescript
// Simplified version
import { server } from "./core/server"
import { loadConfig } from "./config"
import { connectDatabase } from "./db/client"
import "./routes" // Register routes

const config = loadConfig()
await connectDatabase(config.database)

const result = await server.start()
if (result.isErr()) {
  console.error("Failed to start:", result.error)
  process.exit(1)
}
```

#### `src/core/server.ts`
Creates and configures the server instance:

```typescript
import { createServer } from "@bunkit/server"
import { config } from "@/config"

export const server = createServer({
  port: config.server.port,
  host: config.server.host,
  development: config.isDev,
  cors: config.cors,
  openapi: {
    title: "BunKit API",
    version: "1.0.0",
    // ...
  }
})
```

### Source Structure

#### `src/auth/`
Authentication services:
- `auth.service.ts` - JWT generation/verification, password hashing

#### `src/config/`
Configuration management:
- `index.ts` - Environment validation with Zod
- `constants.ts` - Application constants

#### `src/core/`
Core infrastructure:
- `errors.ts` - Custom error classes
- `logger.ts` - Structured logging (pino)
- `server.ts` - Server configuration
- `shutdown-manager.ts` - Graceful shutdown

#### `src/db/`
Database layer:
- `client.ts` - Database connection
- `schemas/` - Drizzle table schemas
- `repositories/` - Data access layer

Example schema:

```typescript
// schemas/users.schema.ts
import { pgTable, text } from "drizzle-orm/pg-core"
import { primaryId, timestamps } from "./_helpers"

export const users = pgTable("users", {
  id: primaryId(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  ...timestamps({ mode: "date" })
})
```

Example repository:

```typescript
// repositories/user-repository.ts
export function getUserRepository() {
  return {
    async findById(id: string): Promise<Result<User | null, Error>> {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id)
      })
      return ok(user ?? null)
    },
    // ... other methods
  }
}
```

#### `src/middlewares/`
Middleware functions:
- `auth.middleware.ts` - JWT authentication
- `logging.middleware.ts` - Request logging

#### `src/routes/`
API route definitions:
- `index.ts` - Route loader
- `auth.routes.ts` - Authentication endpoints
- `todos.routes.ts` - Todo CRUD
- `chat.websocket.ts` - WebSocket chat
- `health.routes.ts` - Health check
- `docs.routes.ts` - OpenAPI docs
- `home.routes.ts` - Home page
- `static.routes.ts` - Static files

### Tests Structure

```
tests/
├── auth/                # Authentication tests
│   └── auth.service.test.ts
├── core/               # Core infrastructure tests
│   ├── errors.test.ts
│   └── shutdown-manager.test.ts
├── db/                 # Database tests
│   └── repositories/
├── middlewares/        # Middleware tests
│   └── logging.middleware.test.ts
└── integration/        # Integration tests
    ├── test-server.ts
    └── routes/
```

## Frontend Application (`apps/frontend/`)

React example application (replaceable with any framework).

### Directory Structure

```
apps/frontend/
├── public/             # Static assets
├── src/
│   ├── main.tsx       # React entry point
│   ├── App.tsx        # Root component
│   ├── index.css      # Global styles
│   ├── assets/        # Images, fonts, etc.
│   ├── components/    # React components
│   ├── generated/     # Generated types
│   ├── hooks/         # React hooks
│   └── lib/           # Utilities
├── Dockerfile         # Production image
├── nginx.conf         # Nginx config for serving
├── index.html         # HTML entry
├── vite.config.ts     # Vite configuration
└── package.json       # Frontend dependencies
```

### Key Directories

#### `src/components/`
React components:
- `Auth.tsx` - Login/register forms
- `TodoList.tsx` - Todo management
- `Chat.tsx` - WebSocket chat
- `ChatMessage.tsx` - Message display
- `ChatRoomSelector.tsx` - Room selection
- `MessageInput.tsx` - Message input

#### `src/generated/`
Auto-generated files (don't edit manually):
- `openapi.json` - API specification
- `openapi.d.ts` - TypeScript types
- `websocket-types.ts` - WebSocket types

#### `src/hooks/`
Custom React hooks:
- `useAuth.tsx` - Authentication state
- `useTodos.tsx` - Todo CRUD operations
- `useChat.tsx` - WebSocket chat

#### `src/lib/`
Utility libraries:
- `api-client.ts` - HTTP client setup
- `api-service.ts` - API service functions

## Packages

### `packages/server/`

The HTTP/WebSocket framework.

```
packages/server/
├── src/
│   ├── index.ts           # Main exports
│   ├── server.ts          # Server class
│   ├── core/             # Core functionality
│   │   ├── cors.ts       # CORS middleware
│   │   └── standard-errors.ts
│   ├── http/             # HTTP routing
│   │   ├── route-builder.ts
│   │   ├── route-registry.ts
│   │   ├── request-handler.ts
│   │   ├── openapi/      # OpenAPI generation
│   │   └── types/        # HTTP types
│   ├── websocket/        # WebSocket routing
│   │   ├── websocket-route-builder.ts
│   │   ├── websocket-handler.ts
│   │   ├── websocket-auth.ts
│   │   ├── websocket-type-generator.ts
│   │   └── types/        # WebSocket types
│   └── types/            # Shared types
│       ├── middleware.ts
│       └── server.ts
├── tests/               # Package tests
├── README.md           # Package documentation
└── package.json
```

### `packages/result/`

Result pattern implementation.

```
packages/result/
├── src/
│   └── index.ts        # Result<T, E> implementation
├── tests/
│   └── index.test.ts
├── README.md
└── package.json
```

## Configuration Files

### Root Configuration

#### `package.json`
Workspace configuration:
- Scripts for all apps
- Workspace catalog dependencies
- Monorepo structure

#### `biome.json`
Linting and formatting configuration:
```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      // ... rules
    }
  }
}
```

#### `tsconfig.json`
Root TypeScript configuration

#### `docker-compose.yml`
Service orchestration:
- PostgreSQL database
- pgAdmin (database GUI)
- Backend API
- Frontend app

### Backend Configuration

#### `drizzle.config.ts`
Drizzle ORM configuration:
```typescript
export default {
  schema: "./src/db/schemas/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
}
```

#### `.env.local`
Environment variables (not committed):
- Database URL
- JWT secrets
- CORS origins
- Log level

### Frontend Configuration

#### `vite.config.ts`
Vite build configuration:
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": "/src"
    }
  }
})
```

#### `.env.local`
Frontend environment variables:
- API URL
- WebSocket URL

## Path Aliases

### Backend
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Usage:
```typescript
import { server } from "@/core/server"
import { getUserRepository } from "@/db/repositories"
```

### Frontend
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Usage:
```typescript
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
```

## File Naming Conventions

### Backend
- **Schemas**: `*.schema.ts` (e.g., `users.schema.ts`)
- **Repositories**: `*-repository.ts` (e.g., `user-repository.ts`)
- **Routes**: `*.routes.ts` or `*.websocket.ts`
- **Middleware**: `*.middleware.ts`
- **Services**: `*.service.ts`
- **Tests**: `*.test.ts`

### Frontend
- **Components**: PascalCase `.tsx` (e.g., `TodoList.tsx`)
- **Hooks**: `use*.tsx` (e.g., `useAuth.tsx`)
- **Utils**: camelCase `.ts` (e.g., `api-client.ts`)
- **Types**: `*.types.ts`

## Import Organization

Files are organized with Biome's import sorting:

1. External packages (`react`, `zod`, etc.)
2. Internal packages (`@bunkit/server`, `@bunkit/result`)
3. Absolute imports (`@/config`, `@/db`)
4. Relative imports (`./types`, `../utils`)

## Build Outputs

### Backend
- No build step required (Bun runs TypeScript directly)
- Generated files: `openapi.json`, `drizzle/` migrations

### Frontend
- Build output: `dist/`
- Generated types: `src/generated/`

## Development Files

Files not committed to version control:

```
.env.local              # Environment secrets
node_modules/          # Dependencies
dist/                  # Build output
*.log                  # Log files
.DS_Store             # macOS
```

## Next Steps

- Learn the [Server Package API](./04-server-package.md)
- Explore [Backend Application](./06-backend-application.md) patterns
- Study [Database Guide](./08-database-guide.md)
