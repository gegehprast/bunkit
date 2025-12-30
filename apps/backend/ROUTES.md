# Routes Structure

This document describes the route organization in the BunKit backend.

## Route Files

Routes are organized by feature/domain in separate files under `src/routes/`:

### 1. Health Check Routes (`health.routes.ts`)
- **GET /api/health** - Health check endpoint
  - Returns service status, timestamp, and uptime
  - Tags: System
  - No authentication required

### 2. OpenAPI Routes (`openapi.routes.ts`)
- **GET /api/openapi.json** - Returns the OpenAPI 3.1 specification
  - Automatically generated from route definitions
  - Tags: Documentation
  - No authentication required

### 3. Todo Routes (`todos.routes.ts`)
- **GET /api/todos** - List all todos with optional completion filter
  - Query params: `completed` (optional string: "true" or "false")
  - Tags: Todos
  - No authentication required

- **GET /api/todos/:id** - Get a specific todo by ID
  - Path params: `id` (string)
  - Tags: Todos
  - No authentication required

- **POST /api/todos** - Create a new todo
  - Body: `{ title: string, description?: string, completed?: boolean }`
  - Tags: Todos
  - **Authentication required** (Bearer token)
  - Valid token for demo: `valid-token`

## How Routes Work

1. **Route Registration**: Routes are automatically registered when their files are imported
2. **Import in main.ts**: The `main()` function imports all route files before starting the server:
   ```typescript
   await import("@/routes/health.routes")
   await import("@/routes/openapi.routes")
   await import("@/routes/todos.routes")
   ```
3. **Route Registry**: The `@bunkit/server` package maintains a global route registry
4. **Server Startup**: When the server starts, all registered routes are available

## Adding New Routes

To add new routes:

1. Create a new file in `src/routes/` (e.g., `users.routes.ts`)
2. Define your routes using `createRoute()`:
   ```typescript
   import { createRoute } from "@bunkit/server"
   import { z } from "zod"

   const UserSchema = z.object({
     id: z.string(),
     name: z.string(),
   }).meta({ id: "User" })

   createRoute("GET", "/api/users/:id")
     .openapi({
       operationId: "getUser",
       summary: "Get user by ID",
       tags: ["Users"],
     })
     .response(UserSchema)
     .handler(({ params, res }) => {
       // Your handler logic
       return res.ok({ id: params.id, name: "John" })
     })
   ```
3. Import the file in `src/main.ts`:
   ```typescript
   await import("@/routes/users.routes")
   ```

## Testing Routes

Start the server:
```bash
bun run --cwd apps/backend dev
```

Test endpoints:
```bash
# Health check
curl http://localhost:3001/api/health

# List todos
curl http://localhost:3001/api/todos

# Create todo (requires auth)
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer valid-token" \
  -d '{"title":"Buy milk"}'

# Get OpenAPI spec
curl http://localhost:3001/api/openapi.json
```

## OpenAPI Documentation

The OpenAPI specification is automatically generated from:
- Route paths and methods
- Zod schemas with `.meta()` annotations
- `.openapi()` configuration (operationId, summary, tags, etc.)
- `.response()`, `.body()`, `.query()` schema definitions

View the spec at: http://localhost:3001/api/openapi.json
