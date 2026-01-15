# Development Workflow

Best practices and patterns for developing with BunKit.

## Daily Development

### Starting Development

```bash
# Terminal 1: Backend with hot reload
bun run backend:dev

# Terminal 2: Frontend with hot reload
bun run frontend:dev

# Terminal 3: Database GUI (optional)
bun run backend:db:studio
```

### Making Changes

```bash
# 1. Make code changes
# 2. Changes auto-reload
# 3. Test in browser at http://localhost:5173
```

## Code Quality

### Linting and Formatting

```bash
# Check and fix all files
bun run check

# Format only
bun run format

# Lint only
bun run lint

# Manual Biome usage
bunx biome check --write src/
bunx biome format --write src/
```

### Pre-commit Checks

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
bun run check
bun run backend:typecheck
bun run test
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Testing

### Running Tests

```bash
# All tests (uses custom script that handles .env correctly)
bun run test

# With coverage
bun run test --coverage

# Match pattern
bun run test -t "should create user"

# Specific package
cd apps/frontend && bun test

# Specific file of specific package
cd apps/backend && bun test tests/auth/auth.service.test.ts
```

The `bun run test` uses a custom script that ensures the correct environment variables are loaded for each packages. If you want to use `bun test` directly, you have to go into the package folder.

### Writing Tests

#### Unit Test

```typescript
import { describe, expect, it } from "bun:test"
import { hashPassword, verifyPassword } from "@/auth/auth.service"

describe("Password Hashing", () => {
  it("should hash password", async () => {
    const result = await hashPassword("password123")
    expect(result.isOk()).toBe(true)
    expect(result.value).not.toBe("password123")
  })

  it("should verify correct password", async () => {
    const hashResult = await hashPassword("password123")
    const hash = hashResult.value!

    const result = await verifyPassword("password123", hash)
    expect(result.isOk()).toBe(true)
    expect(result.value).toBe(true)
  })
})
```

#### Integration Test

```typescript
import { describe, expect, it } from "bun:test"
import { createTestServer } from "../test-server"

describe("POST /api/auth/register", () => {
  const { request } = createTestServer()

  it("should register new user", async () => {
    const response = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
        name: "Test User"
      })
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.user.email).toBe("test@example.com")
    expect(data.accessToken).toBeDefined()
  })
})
```

## Database Workflow

### Schema Changes

1. **Modify Schema**
   ```typescript
   // apps/backend/src/db/schemas/users.schema.ts
   export const users = pgTable("users", {
     id: primaryId(),
     email: text("email").notNull().unique(),
     name: text("name").notNull(),
     // Add new field
     avatarUrl: text("avatar_url"),
     ...timestamps({ mode: "date" })
   })
   ```

2. **Generate Migration**
   ```bash
   bun run backend:db:generate
   # Creates drizzle/0002_*.sql
   ```

3. **Review SQL**
   ```bash
   cat apps/backend/drizzle/0002_*.sql
   ```

4. **Apply Migration**
   ```bash
   bun run backend:db:migrate
   ```

5. **Update Types**
   TypeScript types update automatically!

### Drizzle Studio

```bash
# Open database GUI
bun run backend:db:studio

# Opens at https://local.drizzle.studio
# Browse tables, run queries, edit data
```

## API Development

### Creating New Routes

1. **Define Schemas**
   ```typescript
   // apps/backend/src/routes/products.routes.ts
   const ProductSchema = z.object({
     id: z.string(),
     name: z.string(),
     price: z.number(),
     createdAt: z.string()
   })

   const CreateProductBody = z.object({
     name: z.string().min(1),
     price: z.number().positive()
   })
   ```

2. **Create Route**
   ```typescript
   createRoute("POST", "/api/products")
     .openapi({
       operationId: "createProduct",
       summary: "Create product",
       tags: ["Products"]
     })
     .body(CreateProductBody)
     .response(ProductSchema, { status: 201 })
     .handler(async ({ body, res }) => {
       const result = await createProduct(body)
       if (result.isErr()) {
         return res.internalError("Failed to create product")
       }
       return res.created(result.value)
     })
   ```

3. **Test Route**
   ```bash
   # Via curl
   curl -X POST http://localhost:3001/api/products \
     -H "Content-Type: application/json" \
     -d '{"name":"Widget","price":9.99}'

   # Via OpenAPI docs
   open http://localhost:3001/docs
   ```

4. **Generate Types for Frontend**
   ```bash
   bun run backend:openapi:generate:to-frontend
   ```

5. **Use in Frontend**
   ```typescript
   // apps/frontend/src/lib/api-service.ts
   import type { components } from "@/generated/openapi"

   type Product = components["schemas"]["Product"]

   async function createProduct(data: CreateProductBody): Promise<Product> {
     const response = await apiClient.post("/api/products", data)
     return response.data
   }
   ```

### API Testing Workflow

```bash
# 1. Create route with tests
# 2. Run backend tests
bun run test apps/backend/tests/routes/products.test.ts

# 3. Test manually with curl or Postman
curl http://localhost:3001/api/products

# 4. Check OpenAPI docs
open http://localhost:3001/docs

# 5. Generate types and test frontend
bun run backend:openapi:generate:to-frontend
cd apps/frontend && bun run test
```

## Frontend Development

### Adding New Features

1. **Generate API Types**
   ```bash
   bun run backend:openapi:generate:to-frontend
   ```

2. **Create Service**
   ```typescript
   // apps/frontend/src/lib/products-service.ts
   import { apiClient } from "./api-client"
   import type { components } from "@/generated/openapi"

   type Product = components["schemas"]["Product"]

   export const productsService = {
     async list(): Promise<Product[]> {
       const response = await apiClient.get("/api/products")
       return response.data
     },

     async create(data: CreateProductBody): Promise<Product> {
       const response = await apiClient.post("/api/products", data)
       return response.data
     }
   }
   ```

3. **Create Hook**
   ```typescript
   // apps/frontend/src/hooks/useProducts.tsx
   import { useQuery, useMutation } from "@tanstack/react-query"
   import { productsService } from "@/lib/products-service"

   export function useProducts() {
     return useQuery({
       queryKey: ["products"],
       queryFn: () => productsService.list()
     })
   }

   export function useCreateProduct() {
     return useMutation({
       mutationFn: (data: CreateProductBody) => 
         productsService.create(data)
     })
   }
   ```

4. **Create Component**
   ```typescript
   // apps/frontend/src/components/Products.tsx
   import { useProducts } from "@/hooks/useProducts"

   export function Products() {
     const { data, isLoading, error } = useProducts()

     if (isLoading) return <div>Loading...</div>
     if (error) return <div>Error: {error.message}</div>

     return (
       <ul>
         {data?.map(product => (
           <li key={product.id}>{product.name}</li>
         ))}
       </ul>
     )
   }
   ```

## Git Workflow

### Branch Strategy

```bash
# Main branches
main          # Production
develop       # Development

# Feature branches
git checkout -b feature/add-products
git checkout -b fix/login-bug
git checkout -b docs/api-guide
```

### Commit Messages

Follow conventional commits:

```bash
# Format: <type>(<scope>): <subject>

# Types: feat, fix, docs, style, refactor, test, chore

git commit -m "feat(api): add products endpoints"
git commit -m "fix(auth): resolve token expiry issue"
git commit -m "docs: update deployment guide"
git commit -m "refactor(db): improve repository pattern"
git commit -m "test: add integration tests for todos"
```

### Pull Request Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes
# ... code changes ...

# 3. Test
bun run test
bun run check

# 4. Commit
git add .
git commit -m "feat: add new feature"

# 5. Push
git push origin feature/new-feature

# 6. Create PR on GitHub
# 7. Review and merge
```

## Debugging

### Backend Debugging

```typescript
// Use built-in logger
import { logger } from "@/core/logger"

logger.debug("Debug info", { userId: "123" })
logger.info("User logged in", { email: user.email })
logger.warn("Slow query", { duration: 1000 })
logger.error("Failed to process", { error: err.message })
```

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "bun",
      "request": "launch",
      "program": "${workspaceFolder}/apps/backend/src/main.ts",
      "cwd": "${workspaceFolder}/apps/backend",
      "env": {
        "NODE_ENV": "development"
      },
      "watchMode": true
    }
  ]
}
```

### Database Debugging

```bash
# Open Drizzle Studio
bun run backend:db:studio

# Or use psql
docker-compose exec postgres psql -U bunkit bunkit

# View tables
\dt

# Query data
SELECT * FROM users LIMIT 10;

# Check queries in logs
# Enable query logging in drizzle
const db = drizzle(client, {
  logger: true  // Logs all queries
})
```

## Performance Optimization

### Backend Profiling

```typescript
// Time operations
const start = performance.now()
await someOperation()
const duration = performance.now() - start
logger.info("Operation completed", { duration })

// Profile database queries
const result = await db.query.users.findMany()
// Check logs for query timing
```

### Frontend Profiling

```bash
# Build with source maps
bun run frontend:build

# Analyze bundle
cd apps/frontend
bunx vite-bundle-visualizer
```

## Common Tasks

### Add New Package

```bash
# To backend
cd apps/backend
bun add <package-name>

# To frontend
cd apps/frontend
bun add <package-name>

# To workspace (shared)
bun add -w <package-name>
```

### Update Dependencies

```bash
# Update all
bun update

# Update specific package
bun update <package-name>

# Check outdated
bun outdated
```

### Clean Install

```bash
# Remove and reinstall
rm -rf node_modules bun.lockb
bun install
```

### Environment Switching

```bash
# Development
cp .env.example .env.local

# Production
cp .env.example .env.production
# Edit with production values
```

## Project Maintenance

### Regular Tasks

Weekly:
- [ ] Update dependencies
- [ ] Review and merge PRs
- [ ] Check error logs
- [ ] Run security audit

Monthly:
- [ ] Review performance metrics
- [ ] Update documentation
- [ ] Clean up old branches
- [ ] Database optimization

### Dependency Updates

```bash
# Check outdated packages
bun outdated

# Update non-breaking
bun update --latest

# Update breaking changes carefully
# Read changelogs before updating
bun add <package>@latest
```

### Security Audits

```bash
# Check for vulnerabilities
bun audit

# Update vulnerable packages
bun update
```

## Best Practices

### 1. Use TypeScript Strictly

```typescript
// ✅ Good
function getUser(id: string): Promise<Result<User, Error>> {
  // ...
}

// ❌ Bad
function getUser(id: any): any {
  // ...
}
```

### 2. Always Validate Input

```typescript
// ✅ Good
createRoute("POST", "/api/users")
  .body(CreateUserSchema)
  .handler(({ body, res }) => {
    // body is validated
  })

// ❌ Bad
createRoute("POST", "/api/users")
  .handler(({ req, res }) => {
    const body = await req.json() // No validation!
  })
```

### 3. Handle Errors Explicitly

```typescript
// ✅ Good
const result = await userService.create(data)
if (result.isErr()) {
  return res.badRequest(result.error.message)
}

// ❌ Bad
const user = await userService.create(data) // Might throw!
```

### 4. Keep Routes Thin

```typescript
// ✅ Good
createRoute("POST", "/api/users")
  .handler(async ({ body, res }) => {
    const result = await userService.create(body)
    if (result.isErr()) {
      return res.badRequest(result.error.message)
    }
    return res.created(result.value)
  })

// ❌ Bad - business logic in route
createRoute("POST", "/api/users")
  .handler(async ({ body, res }) => {
    // Hash password
    // Validate email
    // Save to database
    // Send email
    // 50 lines of logic...
  })
```

### 5. Use Consistent Naming

```typescript
// Routes: kebab-case
/api/user-profiles

// Files: kebab-case
user-profile.service.ts

// Functions: camelCase
function getUserProfile() {}

// Types: PascalCase
type UserProfile = {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3
```

## Next Steps

- Review [Testing Guide](./13-testing.md)
- Learn [Deployment Guide](./11-deployment.md)
- Check [Backend Application](./06-backend-application.md) for patterns
