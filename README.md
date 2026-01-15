# BunKit - Full-Stack TypeScript Starter Template

A production-ready, monorepo starter template for building modern web applications with [Bun](https://bun.sh). Features a custom type-safe HTTP/WebSocket framework, automatic OpenAPI generation, and full-stack TypeScript integration.

## 🌟 Overview

BunKit is a complete full-stack starter template that includes:

- **Backend** - Production-ready REST API with WebSocket support
- **Frontend Example** - React 19 + Vite + TailwindCSS 4 (replaceable with any framework)
- **Custom Framework** - [`@bunkit/server`](packages/server) - Type-safe HTTP and WebSocket framework
- **Error Handling** - [`@bunkit/result`](packages/result) - Type-safe Result pattern
- **Monorepo** - Bun workspaces with shared packages
- **Type Generation** - Auto-generate types from backend to frontend
- **OpenAPI** - Automatic API documentation generation
- **Authentication** - JWT-based auth with example implementation
- **Real-time** - WebSocket support with type-safe message schemas
- **Database** - PostgreSQL with Drizzle ORM and type-safe migrations

> 💡 **Note**: The included React frontend is just an example implementation. You can replace it with any frontend framework (Vue, Svelte, Angular, Next.js, etc.) or use the backend as a standalone API for mobile apps or other clients.

## ✨ Key Features

### Production-Ready Infrastructure

- **🚀 Blazing Fast** - Built entirely on Bun runtime for maximum performance
- **📘 Full Type Safety** - End-to-end TypeScript from database to UI
- **🔄 Hot Reload** - Instant feedback during development
- **📚 Auto Documentation** - OpenAPI specs generated from code
- **🔒 Security First** - JWT authentication, CORS, input validation
- **🧪 Comprehensive Testing** - Unit and integration tests included
- **📦 Monorepo Structure** - Organized with Bun workspaces
- **🌐 Real-time Ready** - WebSocket support with type generation

### Developer Experience

- **Type Generation** - Generate TypeScript types for frontend from backend schemas
- **Result Pattern** - Explicit error handling without try-catch
- **Schema Validation** - Request/response validation with Zod
- **Middleware System** - Global and route-level middleware support
- **Code Quality** - Biome for linting and formatting
- **Database Migrations** - Type-safe schema migrations with Drizzle
- **Live Reload** - Changes reflect immediately in both frontend and backend

## 📋 Prerequisites

- **Bun** >= 1.3.3 ([Installation Guide](https://bun.sh/docs/installation))
- **PostgreSQL** >= 14 (local or hosted)
- **Node.js** >= 18 (for some dev tools compatibility)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository (or use as template)
git clone <your-repo-url> my-project
cd my-project

# Install all dependencies
bun install
```

### 2. Environment Setup

Create `.env.local` in `apps/backend/`:

```bash
# Application
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/myapp_dev

# JWT (change these!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=debug
```

### 3. Database Setup

```bash
# Generate migrations from schemas
bun run backend:db:generate

# Run migrations
bun run backend:db:migrate

# (Optional) Open Drizzle Studio
bun run backend:db:studio
```

### 4. Start Development

```bash
# Terminal 1 - Start backend (http://localhost:3001)
bun run backend:dev

# Terminal 2 - Start frontend (http://localhost:5173)
bun run frontend:dev
```

Visit `http://localhost:5173` to see your app!

## � Documentation

BunKit includes comprehensive documentation in the [`docs/`](docs/) folder:

- **[Quick Reference](docs/00-quick-reference.md)** - Fast lookup for common patterns
- **[Introduction](docs/01-introduction.md)** - Overview and key features
- **[Installation & Setup](docs/02-installation.md)** - Detailed setup guide
- **[Project Structure](docs/03-project-structure.md)** - Understanding the codebase
- **[@bunkit/server Package](docs/04-server-package.md)** - Complete framework API reference
- **[@bunkit/result Package](docs/05-result-package.md)** - Type-safe error handling
- **[WebSocket Guide](docs/07-websocket-guide.md)** - Real-time features
- **[Deployment Guide](docs/11-deployment.md)** - Docker and cloud deployment
- **[Development Workflow](docs/12-development-workflow.md)** - Best practices

**Start here**: If you're new to BunKit, begin with the [Introduction](docs/01-introduction.md) and [Installation](docs/02-installation.md).

## �📦 Project Structure

```
bunkit/
├── apps/
│   ├── backend/              # Backend API server
│   │   ├── src/
│   │   │   ├── main.ts       # Application entry point
│   │   │   ├── auth/         # Authentication logic
│   │   │   ├── config/       # Configuration management
│   │   │   ├── core/         # Server, logger, errors, shutdown
│   │   │   ├── db/           # Database client, schemas, repositories
│   │   │   ├── middlewares/  # Request middlewares
│   │   │   └── routes/       # HTTP and WebSocket routes
│   │   ├── tests/            # Backend tests
│   │   └── drizzle/          # Database migrations
│   │
│   └── frontend/             # React frontend
│       ├── src/
│       │   ├── components/   # React components (Auth, Chat, Todos)
│       │   ├── hooks/        # Custom React hooks
│       │   ├── lib/          # API client and utilities
│       │   └── generated/    # Auto-generated types from backend
│       └── public/           # Static assets
│
├── packages/
│   ├── server/               # @bunkit/server - HTTP/WebSocket framework
│   │   ├── src/
│   │   │   ├── http/         # HTTP routing and OpenAPI
│   │   │   ├── websocket/    # WebSocket support
│   │   │   └── core/         # Core middleware and validation
│   │   └── tests/            # Framework tests
│   │
│   └── result/               # @bunkit/result - Result pattern
│       ├── src/
│       └── tests/
│
├── scripts/                  # Workspace-level scripts
│   └── lint.ts              # Run linting across workspace
│
├── package.json             # Root workspace configuration
├── biome.json              # Biome linter/formatter config
└── tsconfig.json           # Root TypeScript config
```

## 🛠️ Available Scripts

### Workspace Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install all dependencies |
| `bun run lint` | Lint all packages |
| `bun run check` | Run Biome checks and auto-fix |
| `bun run format` | Format all code with Biome |

### Backend Commands

| Command | Description |
|---------|-------------|
| `bun run backend:dev` | Start backend with hot reload |
| `bun run backend:start` | Start backend (production) |
| `bun run backend:typecheck` | Type check backend |
| `bun run backend:db:generate` | Generate database migrations |
| `bun run backend:db:migrate` | Run database migrations |
| `bun run backend:db:studio` | Open Drizzle Studio |
| `bun run backend:openapi:generate` | Generate OpenAPI spec |
| `bun run backend:openapi:generate:to-frontend` | Generate OpenAPI types to frontend |
| `bun run backend:ws-types:generate` | Generate WebSocket types |
| `bun run backend:ws-types:generate:to-frontend` | Generate WebSocket types to frontend |

### Frontend Commands

| Command | Description |
|---------|-------------|
| `bun run frontend:dev` | Start frontend dev server |
| `bun run frontend:build` | Build frontend for production |
| `bun run frontend:preview` | Preview production build |
| `bun run frontend:typecheck` | Type check frontend |

## 🔧 Technology Stack

### Backend

- **Runtime**: [Bun](https://bun.sh) v1.3.5+
- **Framework**: Custom [`@bunkit/server`](packages/server)
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team)
- **Validation**: [Zod](https://zod.dev) v4
- **Authentication**: JWT with [jose](https://github.com/panva/jose)
- **API Docs**: OpenAPI 3.1 with [zod-openapi](https://github.com/samchungy/zod-openapi)
- **Testing**: Bun test runner

### Frontend (Example Implementation)

> The frontend is an **example implementation** showing how to integrate with the backend. You can replace it with any framework you prefer.

- **Framework**: [React 19](https://react.dev)
- **Build Tool**: [Vite](https://vite.dev) (Rolldown)
- **Styling**: [TailwindCSS 4](https://tailwindcss.com)
- **API Client**: [openapi-fetch](https://openapi-ts.dev/openapi-fetch/)
- **Type Safety**: TypeScript 5

**Alternative Frameworks**: Vue, Svelte, Angular, TanStack Start, Next.js, SvelteKit, Nuxt, Solid, Qwik, or any other frontend technology. The backend is framework-agnostic and works with any client that can consume REST APIs and WebSocket connections.

### Packages

- **[@bunkit/server](packages/server)** - Type-safe HTTP/WebSocket framework with OpenAPI
- **[@bunkit/result](packages/result)** - Result pattern for error handling

## 🎯 Core Concepts

### Type-Safe API Development

Routes are fully typed from request to response:

```typescript
// Backend: apps/backend/src/routes/todos.routes.ts
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
    // params.id is typed as string
    return { id: params.id, title: "Example", completed: false }
  })
```

### Auto-Generated Types

Generate types from backend to frontend:

```bash
# Generate OpenAPI types
bun run backend:openapi:generate:to-frontend

# Generate WebSocket types
bun run backend:ws-types:generate:to-frontend
```

Use in frontend:

```typescript
// Frontend: apps/frontend/src/lib/api-client.ts
import createClient from "openapi-fetch"
import type { paths } from "@/generated/openapi"

const client = createClient<paths>({
  baseUrl: "http://localhost:3001"
})

// Fully typed request and response
const { data, error } = await client.GET("/api/todos/{id}", {
  params: { path: { id: "123" } }
})
```

### Result Pattern

Explicit error handling without try-catch:

```typescript
import { ok, err, type Result } from "@bunkit/result"

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("Division by zero")
  return ok(a / b)
}

const result = divide(10, 2)
if (result.isOk()) {
  console.log(result.value) // 5
} else {
  console.error(result.error)
}
```

### WebSocket with Type Safety

Define WebSocket routes with schemas:

```typescript
// Backend
import { createWebSocketRoute } from "@bunkit/server"
import { z } from "zod"

const MessageSchema = z.object({
  type: z.literal("chat"),
  content: z.string(),
})

createWebSocketRoute("/ws/chat")
  .onMessage("chat", MessageSchema, ({ data, ws }) => {
    ws.send({ type: "chat", content: data.content })
  })
```

Generate types for frontend:

```bash
bun run backend:ws-types:generate:to-frontend
```

Use in frontend:

```typescript
// Frontend - types are auto-generated
import type { ServerMessage, ClientMessage } from "@/generated/websocket-types"

ws.send({ type: "chat", content: "Hello" } satisfies ClientMessage)

ws.onmessage = (event) => {
  const msg: ServerMessage = JSON.parse(event.data)
  // Fully typed based on backend schemas
}
```

## 📚 Documentation

- **[Backend README](apps/backend/README.md)** - Backend API documentation
- **[@bunkit/server](packages/server/README.md)** - Framework documentation
- **[@bunkit/result](packages/result/README.md)** - Result pattern guide

### API Documentation

When backend is running, visit:
- **Swagger UI**: http://localhost:3001/docs
- **OpenAPI JSON**: http://localhost:3001/docs/openapi.json

## 🔐 Authentication

The starter includes a complete JWT authentication system:

- User registration and login
- Password hashing with bcrypt
- JWT access and refresh tokens
- Protected route middleware
- Auth context in frontend

**Example endpoints:**
- `POST /auth/register` - Create account
- `POST /auth/login` - Get JWT token
- `GET /auth/me` - Get current user (protected)

See [Backend README](apps/backend/README.md) for details.

## 🗄️ Database

### Schema Management

1. Define schemas in `apps/backend/src/db/schemas/`
2. Generate migrations: `bun run backend:db:generate`
3. Apply migrations: `bun run backend:db:migrate`

### Drizzle Studio

Visual database management:

```bash
bun run backend:db:studio
```

Opens at `https://local.drizzle.studio`

## 🧪 Testing

**IMPORTANT:** Tests must be run from the each app or package directory.

```bash
cd apps/backend && bun test
cd packages/server && bun test
cd packages/result && bun test
```

## 🚀 Deployment

### Backend Deployment

1. Build for production (Bun can run TypeScript directly)
2. Set environment variables in production
3. Run migrations: `bun run backend:db:migrate`
4. Start server: `bun run backend:start`

### Frontend Deployment

```bash
bun run frontend:build
```

Deploy the `apps/frontend/dist` folder to:
- Vercel, Netlify, Cloudflare Pages
- Any static hosting service

### Environment Variables

**Production checklist:**
- ✅ Set `NODE_ENV=production`
- ✅ Use strong JWT secrets (minimum 32 characters)
- ✅ Configure production database URL
- ✅ Set allowed CORS origins
- ✅ Adjust log level to `warn` or `error`

## 🎨 Example Features

The template includes **example implementations** in both frontend and backend that demonstrate best practices. These can be customized, replaced, or removed based on your needs.

### Frontend Examples

The React frontend (`apps/frontend/`) is a **reference implementation** showing:
- API integration with type-safe client
- Authentication flow with JWT tokens
- Real-time WebSocket communication
- Component patterns and state management

**You can replace the entire frontend** with your preferred framework or remove it entirely if building:
- Mobile apps (React Native, Flutter, Swift, Kotlin)
- Desktop apps (Electron, Tauri)
- Other web libraries (Vue, Svelte, Angular, etc.)
- Server-side rendered apps (TanStack Start, Next.js, SvelteKit, Nuxt)

### Backend Examples

#### User Authentication
- Registration and login system
- JWT token management
- Protected routes

#### Todo List
- CRUD operations
- User-scoped data
- RESTful API example

#### Real-time Chat
- WebSocket rooms
- Message broadcasting
- Typing indicators
- User presence

These backend features serve as reference implementations. See [Backend README](apps/backend/README.md#removing-example-features) for removal instructions.

## 🛠️ Customization

### Adding New Routes

1. Create route file in `apps/backend/src/routes/`
2. Define route with schemas
3. Import in `apps/backend/src/routes/index.ts`
4. Generate types: `bun run backend:openapi:generate:to-frontend`

### Adding Database Tables

1. Create schema in `apps/backend/src/db/schemas/`
2. Generate migration: `bun run backend:db:generate`
3. Run migration: `bun run backend:db:migrate`
4. Create repository in `apps/backend/src/db/repositories/`

### Using a Different Frontend Framework

The backend is framework-agnostic. To use a different frontend:

1. **Remove the example frontend** (optional):
   ```bash
   rm -rf apps/frontend
   ```

2. **Create your new frontend**:
   ```bash
   # Vue
   cd apps && bun create vite my-vue-frontend --template vue
   
   # Svelte
   cd apps && bun create vite my-vue-frontend --template svelte
   
   # TanStack Start
   cd apps && bun create @tanstack/start@latest
   
   # Or any other framework
   ```

3. **Generate types from backend**:
   ```bash
   bun run backend:openapi:generate --types --output=../your-frontend/src/generated
   ```

4. **Use any OpenAPI client**:
   - `openapi-fetch` (TypeScript)
   - `@hey-api/openapi-ts` (generates hooks/clients)
   - `axios` with generated types
   - Native `fetch` with types

### Adding Pages to Example Frontend

If using the included React frontend:

1. Create component in `apps/frontend/src/components/`
2. Add route in `apps/frontend/src/App.tsx`
3. Use generated types from `src/generated/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `cd <package/path> && bun test`
5. Run linting: `bun run lint`
6. Submit a pull request

## 📄 License

MIT

---

## 🎓 Learning Resources

- [Bun Documentation](https://bun.sh/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [Zod](https://zod.dev)
- [OpenAPI Specification](https://swagger.io/specification/)

## 💡 Why BunKit?

- **Performance**: Bun runtime is significantly faster than Node.js
- **Type Safety**: End-to-end types from database to UI
- **Developer Experience**: Hot reload, auto-generated API docs and types
- **Production Ready**: Authentication, logging, error handling, graceful shutdown
- **Maintainable**: Clean architecture, monorepo structure, comprehensive tests
- **Framework Agnostic**: Use any frontend framework or build API-only backends

**Perfect for**:
- Full-stack web applications
- API backends for mobile apps
- Real-time applications with WebSockets
- Microservices architecture
- Rapid prototyping with type safety

Start building your next project with BunKit today! 🚀
