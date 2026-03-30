# Backend - BunKit API Server

The backend API server for BunKit, built with [Bun](https://bun.sh) and the custom [`@bunkit/server`](../../packages/server) framework.

> For general project setup and monorepo structure, see the [main README](../../README.md).

## Quick Start

See the [main README](../../README.md#quick-start) for initial setup. Backend-specific commands:

```bash
# Start development server with hot reload
bun run dev

# Apply database migrations
bun run db:migrate

# Open database GUI
bun run db:studio
```

## Available Scripts

All scripts can be run from workspace root with `bun run backend:*` or from this directory directly.

| Script | Description |
|--------|-------------|
| `dev` | Start development server with hot reload |
| `start` | Start production server |
| `typecheck` | Run TypeScript type checking |
| `db:generate` | Generate database migration files |
| `db:migrate` | Apply database migrations |
| `db:studio` | Open Drizzle Studio (database GUI) |
| `openapi:generate` | Generate OpenAPI specification |
| `ws-types:generate` | Generate TypeScript types for WebSocket messages |

## Project Structure

```
apps/backend/
├── drizzle/                    # Database migrations
│   ├── 0000_*.sql             # Migration SQL files
│   └── meta/                   # Migration metadata
├── public/                     # Static files (served at /public)
├── scripts/                    # Build and utility scripts
│   ├── generate-openapi.ts    # OpenAPI spec generator
│   ├── generate-ws-types.ts   # WebSocket types generator
│   └── migrate.ts             # Database migration runner
├── src/
│   ├── main.ts                # Application entry point
│   ├── auth/                  # Authentication logic
│   │   └── auth.service.ts    # JWT & password hashing
│   ├── config/                # Configuration management
│   │   ├── constants.ts       # Application constants
│   │   └── index.ts           # Environment config with validation
│   ├── core/                  # Core infrastructure
│   │   ├── errors.ts          # Custom error classes
│   │   ├── logger.ts          # Structured logging
│   │   ├── server.ts          # Server configuration
│   │   └── shutdown-manager.ts # Graceful shutdown handler
│   ├── db/                    # Database layer
│   │   ├── client.ts          # Database connection
│   │   ├── repositories/      # Data access layer
│   │   └── schemas/           # Drizzle table schemas
│   ├── middlewares/           # Middleware functions
│   │   ├── auth.middleware.ts # JWT authentication
│   │   └── logging.middleware.ts # Request logging
│   └── routes/                # API routes
│       ├── index.ts           # Route loader
│       ├── auth.routes.ts     # Authentication endpoints
│       ├── todos.routes.ts    # Todo CRUD endpoints
│       ├── chat.websocket.ts  # WebSocket chat
│       ├── health.routes.ts   # Health check endpoint
│       ├── docs.routes.ts     # OpenAPI documentation
│       ├── home.routes.ts     # Home page
│       └── static.routes.ts   # Static file serving
└── tests/                     # Test suites
    ├── auth/                  # Authentication tests
    ├── core/                  # Core infrastructure tests
    ├── db/                    # Database tests
    ├── middlewares/           # Middleware tests
    └── integration/           # Integration tests
        ├── test-server.ts     # Test server setup
        └── routes/            # Route integration tests
```

## Environment Configuration

All configuration is managed through environment variables with validation via Zod schemas. Please see `.env.example` or `src/config/index.ts` for up to date variables.

### Required Variables

```bash
# Application
PORT=3001                       # Server port
HOST=0.0.0.0                    # Server host
NODE_ENV=development            # Environment (development|production|test)

# Database
DATABASE_URL=postgresql://localhost:5432/bunkit

# JWT Authentication
JWT_SECRET=min-32-chars         # Access token secret
JWT_EXPIRES_IN=7d               # Access token expiration
JWT_REFRESH_SECRET=min-32-chars # Refresh token secret
JWT_REFRESH_EXPIRES_IN=30d      # Refresh token expiration

# CORS
CORS_ORIGIN=http://localhost:5173  # Allowed origins (comma-separated)

# Logging
LOG_LEVEL=info                  # none|error|warn|info|debug|trace
```

## API Documentation

### Swagger UI

When the server is running, OpenAPI documentation is available at:

- **Swagger UI**: http://localhost:3001/docs
- **OpenAPI JSON**: http://localhost:3001/docs/openapi.json

### Generate Static Spec

```bash
# Generate openapi.json in backend root
bun run openapi:generate

# Generate types for frontend
bun run openapi:generate --types --output=../frontend/src/generated
```

## Database Management

### Schema Definition

Define your schemas in `src/db/schemas/` using Drizzle ORM:

```typescript
// Example: src/db/schemas/users.schema.ts
import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

### Migration Workflow

1. Define or modify schemas in `src/db/schemas/`
2. Generate migration: `bun run db:generate`
3. Review the generated SQL in `drizzle/`
4. Apply migration: `bun run db:migrate`

### Drizzle Studio

Visual database management interface:

```bash
bun run db:studio
```

Opens at `https://local.drizzle.studio` for browsing and editing data.

### Repository Pattern

Access data through repositories in `src/db/repositories/`:

```typescript
// src/db/repositories/user-repository.ts
import { db } from "@/db/client"
import { users } from "@/db/schemas"

export const userRepository = {
  async findById(id: string) {
    return db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, id)
    })
  },
  
  async create(data: InsertUser) {
    const [user] = await db.insert(users).values(data).returning()
    return user
  }
}
```

## Authentication System

JWT-based authentication with password hashing using Bun's native bcrypt.

### Using Auth Middleware

Protect routes with the authentication middleware:

```typescript
import { createRoute } from "@bunkit/server"
import { authMiddleware } from "@/middlewares/auth.middleware"

export const protectedRoute = createRoute("GET", "/api/protected")
  .middlewares(authMiddleware())
  .openapi({
    summary: "Protected endpoint",
    security: [{ bearerAuth: [] }],
  })
  .handler(({ ctx }) => {
    // ctx.user is available and typed
    return { message: `Hello ${ctx.user.email}` }
  })
```

### Auth Service

Core authentication utilities in `src/auth/auth.service.ts`:

```typescript
import { hashPassword, verifyPassword, generateToken, verifyToken } from "@/auth/auth.service"

// Hash password
const hash = await hashPassword("password123")

// Verify password
const isValid = await verifyPassword("password123", hash)

// Generate JWT
const token = await generateToken({ userId: "123", email: "user@example.com" })

// Verify JWT
const result = await verifyToken(token)
if (result.isOk()) {
  console.log(result.value.userId) // "123"
}
```

## WebSocket Implementation

Real-time features using type-safe WebSocket routes.

```typescript
import { createWebSocketRoute } from "@bunkit/server"
import { z } from "zod"

const MessageSchema = z.object({
  type: z.literal("chat"),
  content: z.string(),
})

export const wsRoute = createWebSocketRoute("/ws/chat")
  .authenticate(async (req) => {
    // Your auth logic here
    return { userId: "123", username: "user" }
  })
  .onMessage("chat", MessageSchema, ({ data, ws, user }) => {
    // Handle incoming messages
    ws.send({ type: "chat", content: data.content })
  })
  .onOpen(({ ws, user }) => {
    console.log(`User ${user.username} connected`)
  })
  .onClose(({ ws, user }) => {
    console.log(`User ${user.username} disconnected`)
  })
```

### Define WebSocket Routes

```typescript
import { createWebSocketRoute } from "@bunkit/server"
import { z } from "zod"

const MessageSchema = z.object({
  type: z.literal("chat"),
  content: z.string(),
})

export const wsRoute = createWebSocketRoute("/ws/chat")
  .authenticate(async (req) => {
    // Verify JWT and return user
    return { userId: "123", username: "user" }
  })
  .onMessage("chat", MessageSchema, ({ data, ws, user }) => {
    // Handle messages with full type safety
    ws.send({ type: "chat", content: data.content })
  })
  .onOpen(({ user }) => {
    console.log(`${user.username} connected`)
  })
  .onClose(({ user }) => {
    console.log(`${user.username} disconnected`)
  })
```

### Generate Types for Frontend

```bash
# Generate websocket-types.ts
bun run ws-types:generate

# Or directly to frontend
bun run ws-types:generate --output=../frontend/src/generated
```

## Middleware System

### Global Middleware

Applied to all requests, configured in `src/core/server.ts`:

```typescript
import { createServer } from "@bunkit/server"
import { loggingMiddleware } from "@/middlewares/logging.middleware"

export const server = createServer({
  globalMiddlewares: [loggingMiddleware()],
  // ...
})
```

### Route-Specific Middleware

Applied to individual routes:

```typescript
import { createRoute } from "@bunkit/server"
import { authMiddleware } from "@/middlewares/auth.middleware"

createRoute("GET", "/api/protected")
  .middlewares(authMiddleware())
  .handler(({ ctx }) => {
    // ctx.user is available
    return { message: `Hello ${ctx.user.email}` }
  })
```

### Creating Custom Middleware

```typescript
import type { MiddlewareFn } from "@bunkit/server"

export function customMiddleware(): MiddlewareFn {
  return async ({ req, next, ctx }) => {
    // Before request
    console.log("Request:", req.method, req.url)
    
    // Add to context
    ctx.customData = "value"
    
    // Continue chain
    const response = await next()
    
    // After request
    console.log("Response:", response.status)
    
    return response
  }
}
```

## Error Handling

Standardized error classes in `src/core/errors.ts`:

```typescript
import { NotFoundError, ValidationError, AuthRequiredError } from "@/core/errors"

// In your route handler
throw new NotFoundError("User not found")
throw new ValidationError("Invalid email format")
throw new AuthRequiredError("Please log in")
```

## Error Handling

Standardized error classes in `src/core/errors.ts`:

```typescript
import { 
  NotFoundError, 
  ValidationError, 
  AuthRequiredError,
  ForbiddenError,
  ConflictError
} from "@/core/errors"

// In route handlers
throw new NotFoundError("User not found")
throw new ValidationError("Invalid email format")
throw new AuthRequiredError() // Uses default message
throw new ForbiddenError("Insufficient permissions")
throw new ConflictError("Email already exists")
```

These automatically map to appropriate HTTP status codes:
- `ValidationError` → 400
- `AuthRequiredError` / `AuthInvalidError` → 401
- `ForbiddenError` → 403
- `NotFoundError` → 404
- `ConflictError` → 409
- `InternalError` → 500

## Logging

### Structured Logging

Use the logger from `src/core/logger.ts`:

```typescript
import { logger } from "@/core/logger"

logger.info("User logged in", { userId: "123", ip: "192.168.1.1" })
logger.warn("Rate limit approaching", { current: 95, limit: 100 })
logger.error("Database error", { error, query })
logger.debug("Cache hit", { key: "user:123" })
```

### Request Logging

All HTTP requests are automatically logged by the global logging middleware with:
- Method and path
- Response status code
- Duration in milliseconds
- Request ID (from `x-request-id` header or auto-generated UUID)

Configure log level via `LOG_LEVEL` environment variable.

## Testing

### Run Tests

```bash
# All backend tests
bun test

# With coverage
bun test --coverage

# Watch mode
bun test --watch

# Specific file
bun test tests/auth/auth.service.test.ts
```

### Test Structure

- **Unit Tests**: `tests/auth/`, `tests/core/`, `tests/db/`
- **Integration Tests**: `tests/integration/routes/`
- **Test Utilities**: `tests/integration/test-server.ts`

### Writing Tests

```typescript
import { describe, test, expect } from "bun:test"
import { authService } from "@/auth/auth.service"

describe("AuthService", () => {
  test("should hash password", async () => {
    const hash = await authService.hashPassword("password")
    expect(hash).not.toBe("password")
  })
  
  test("should verify correct password", async () => {
    const hash = await authService.hashPassword("password")
    const isValid = await authService.verifyPassword("password", hash)
    expect(isValid).toBe(true)
  })
})
```

## Development Workflow

### Adding a New Feature

1. **Define Schema** (if needed)
   ```bash
   # Create src/db/schemas/my-feature.schema.ts
   bun run db:generate
   bun run db:migrate
   ```

2. **Create Repository**
   ```typescript
   // src/db/repositories/my-feature-repository.ts
   ```

3. **Create Routes**
   ```typescript
   // src/routes/my-feature.routes.ts
   import { createRoute } from "@bunkit/server"
   
   createRoute("GET", "/api/my-feature")
     .openapi({ summary: "Get my feature" })
     .handler(() => {
       return { message: "Hello" }
     })
   ```

4. **Register Routes**
   ```typescript
   // src/routes/index.ts
   export async function loadRoutes() {
     await import("./my-feature.routes")
   }
   ```

5. **Generate Types**
   ```bash
   bun run openapi:generate:to-frontend
   ```

6. **Write Tests**
   ```typescript
   // tests/integration/routes/my-feature.routes.test.ts
   ```

## Deployment

### Production Configuration

1. Set production environment variables:
   - `NODE_ENV=production`
   - Strong JWT secrets (minimum 32 characters)
   - Production database URL
   - Allowed CORS origins
   - Log level `warn` or `error`

2. Run migrations:
   ```bash
   bun run db:migrate
   ```

3. Start server:
   ```bash
   bun run start
   ```

### Docker Deployment

Example `Dockerfile`:

```dockerfile
FROM oven/bun:1.3.5

WORKDIR /app

# Copy workspace config
COPY package.json bun.lockb ./
COPY apps/backend/package.json apps/backend/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY apps/backend apps/backend
COPY packages packages

# Set working directory to backend
WORKDIR /app/apps/backend

# Run migrations and start
CMD ["sh", "-c", "bun run db:migrate && bun run start"]
```

### Health Checks

Use the health endpoint for load balancers:

```bash
curl http://localhost:3001/api/health
# {"status": "ok", "timestamp": "2026-01-15T..."}
```

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Test connection
psql $DATABASE_URL

# Check if PostgreSQL is running
pg_isready

# Verify connection string format
echo $DATABASE_URL
```

**Port Already in Use**
```bash
# Find and kill process
lsof -ti:3001 | xargs kill -9

# Or change PORT in .env.local
```

**Migration Errors**
```bash
# Check migration status
bun run db:studio

# Reset database (WARNING: destroys data)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
bun run db:migrate
```

**Type Generation Fails**
```bash
# Ensure server can start
bun run typecheck

# Clear and regenerate
rm openapi.json
bun run openapi:generate
```

**Hot Reload Not Working**
```bash
# Check for syntax errors
bun run typecheck

# Restart with clean slate
pkill -f "bun.*main.ts"
bun run dev
```

## Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Zod Documentation](https://zod.dev)
- [OpenAPI Specification](https://swagger.io/specification/)
- [@bunkit/server README](../../packages/server/README.md)
- [@bunkit/result README](../../packages/result/README.md)

---

## Example Features (Template Reference)

This starter template includes **example implementations** to demonstrate best practices. These features can be removed or replaced based on your application needs:

### Authentication System

**Files to modify/remove:**
- `src/auth/auth.service.ts` - JWT and password hashing utilities
- `src/routes/auth.routes.ts` - Login, register, and profile endpoints
- `src/middlewares/auth.middleware.ts` - JWT verification middleware
- `src/db/schemas/users.schema.ts` - User table schema
- `src/db/repositories/user-repository.ts` - User data access

**Features demonstrated:**
- User registration with email/password
- Login with JWT token generation
- Password hashing with bcrypt
- Protected routes with Bearer token authentication
- Token verification and user context

**API Endpoints:**
- `POST /auth/register` - Create new user account
- `POST /auth/login` - Authenticate and receive JWT
- `GET /auth/me` - Get current user profile (protected)

### Todo List System

**Files to modify/remove:**
- `src/routes/todos.routes.ts` - CRUD endpoints for todos
- `src/db/schemas/todos.schema.ts` - Todo table schema
- `src/db/repositories/todo-repository.ts` - Todo data access

**Features demonstrated:**
- RESTful CRUD operations
- User-scoped data (todos belong to users)
- Query parameter validation
- Request body validation with Zod
- Repository pattern for database access

**API Endpoints:**
- `POST /api/todos` - Create todo
- `GET /api/todos` - List user's todos (with filters)
- `GET /api/todos/:id` - Get single todo
- `PUT /api/todos/:id` - Update todo
- `DELETE /api/todos/:id` - Delete todo

### Real-time Chat

**Files to modify/remove:**
- `src/routes/chat.websocket.ts` - WebSocket chat implementation

**Features demonstrated:**
- WebSocket authentication with JWT
- Room-based chat system
- Message broadcasting with `ws.publish()`
- Typing indicators
- User presence notifications
- Real-time bidirectional communication

**WebSocket Messages:**
- `join` - Join a chat room
- `leave` - Leave a chat room
- `message` - Send/receive messages
- `typing` - Broadcast typing status
- `user_joined` / `user_left` - Presence notifications

### Removing Example Features

To start with a clean slate:

1. **Remove example routes:**
   ```bash
   rm src/routes/auth.routes.ts
   rm src/routes/todos.routes.ts
   rm src/routes/chat.websocket.ts
   ```

2. **Remove example schemas:**
   ```bash
   rm src/db/schemas/users.schema.ts
   rm src/db/schemas/todos.schema.ts
   ```

3. **Remove example repositories:**
   ```bash
   rm -rf src/db/repositories/
   ```

4. **Remove example services:**
   ```bash
   rm -rf src/auth/
   rm src/middlewares/auth.middleware.ts
   ```

5. **Update route loader** (`src/routes/index.ts`) to remove references

6. **Generate fresh migrations** for your own schemas:
   ```bash
   # Clear old migrations
   rm -rf drizzle/
   
   # Create your schemas in src/db/schemas/
   # Then generate migrations
   bun run db:generate
   bun run db:migrate
   ```

### Using Examples as Reference

Keep the example code as reference while building your own features:
- Study the authentication flow for implementing your own auth
- Use the todo routes as a template for CRUD operations  
- Reference the chat WebSocket for real-time features
- Copy repository patterns for your data access layer

The examples follow production best practices:
- Type-safe database queries
- Proper error handling
- Request validation
- OpenAPI documentation
- Comprehensive test coverage
