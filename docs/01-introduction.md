# Introduction to BunKit

BunKit is a production-ready, full-stack TypeScript starter template built entirely on the [Bun](https://bun.sh) runtime. It provides everything you need to build modern web applications with a focus on type safety, developer experience, and performance.

## What is BunKit?

BunKit consists of three main components:

1. **Custom Framework** - [`@bunkit/server`](./04-server-package.md) - A type-safe HTTP and WebSocket framework with automatic OpenAPI generation
2. **Backend Application** - A fully-featured REST API demonstrating best practices
3. **Frontend Example** - React 19 + Vite + TailwindCSS 4 (replaceable with any framework)

The included React frontend is just an example. You can replace it with Vue, Svelte, Angular, Next.js, or use the backend as a standalone API for mobile apps or other clients.

## Why BunKit?

### For Startups & MVPs
- **Fast to Market** - Start with a complete foundation instead of building from scratch
- **Proven Patterns** - Authentication, validation, error handling all configured
- **Scalable** - Monorepo structure supports growth from prototype to production

### For Learning
- **Best Practices** - Learn modern TypeScript patterns and architecture
- **Complete Examples** - Real-world code for REST APIs, WebSockets, authentication
- **Type Safety** - See how end-to-end type safety works in practice

### For Production
- **Battle-Tested** - Includes graceful shutdown, structured logging, error handling
- **Docker Ready** - Production Dockerfiles and docker-compose configuration
- **OpenAPI** - Automatic API documentation for clients and teams

## Core Philosophy

### Type Safety First
Every part of BunKit is designed for maximum type safety:
- Path parameters automatically extracted and typed
- Request/response schemas validated with Zod
- Database queries type-safe with Drizzle ORM
- WebSocket messages fully typed

### Explicit Error Handling
No hidden exceptions - all errors are explicit using the Result pattern:
```typescript
const result = await userService.create(data)
if (result.isErr()) {
  return res.badRequest(result.error.message)
}
return res.ok(result.value)
```

### Developer Experience
Features that make development enjoyable:
- Hot reload for instant feedback
- Type generation from backend to frontend
- Automatic OpenAPI documentation
- Comprehensive test examples

## Key Features

### 🚀 Performance
- **Bun Runtime** - Up to 4x faster than Node.js
- **Native TypeScript** - No transpilation needed
- **Fast Development** - Sub-second server restarts

### 📘 Type Safety
- **End-to-End Types** - Database → Backend → Frontend
- **Schema Validation** - Runtime validation with compile-time types
- **Path Parameter Extraction** - Automatic type inference from routes

### 🔄 Real-Time
- **WebSocket Support** - Type-safe real-time communication
- **Room Broadcasting** - Built-in support for WebSocket rooms
- **Type Generation** - Auto-generate WebSocket types for clients

### 📚 Documentation
- **OpenAPI 3.1** - Automatic API spec generation
- **Type Generation** - Generate TypeScript types for frontend
- **Interactive Docs** - Swagger UI included

### 🔒 Security
- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - Bcrypt with configurable rounds
- **CORS** - Configurable cross-origin support
- **Input Validation** - All inputs validated with Zod

### 🧪 Testing
- **Bun Test Runner** - Fast, built-in testing
- **Test Examples** - Unit and integration tests included
- **Test Server** - Dedicated test server setup

### 📦 Monorepo
- **Bun Workspaces** - Efficient package management
- **Shared Packages** - Reusable code across apps
- **Type References** - TypeScript project references

## What's Included

### Backend Application (`apps/backend`)
- REST API with example routes (todos, auth, health)
- WebSocket chat implementation
- JWT authentication with refresh tokens
- Database integration with Drizzle ORM
- Middleware system (auth, logging)
- Graceful shutdown handler
- Structured logging
- OpenAPI documentation generation
- WebSocket type generation

### Frontend Application (`apps/frontend`)
- React 19 with TypeScript
- Vite for fast development
- TailwindCSS 4 styling
- React Query for data fetching
- WebSocket hooks
- Generated API types
- Example components (Auth, Todos, Chat)

### Framework Packages

#### @bunkit/server
- HTTP route builder with fluent API
- WebSocket route builder
- Automatic OpenAPI 3.1 generation
- Type-safe request/response handling
- Middleware system
- CORS support
- Security schemes (Bearer, API Key, OAuth2)
- Path parameter extraction
- Query and body validation

#### @bunkit/result
- Type-safe Result<T, E> pattern
- Eliminates try-catch blocks
- Composable error handling
- map, mapErr, andThen, orElse operations
- match for exhaustive handling

## Architecture Overview

```
BunKit Monorepo
│
├── apps/
│   ├── backend/         → REST API + WebSocket server
│   └── frontend/        → React example (replaceable)
│
├── packages/
│   ├── server/          → HTTP/WebSocket framework
│   └── result/          → Result pattern library
│
└── scripts/             → Shared build and test scripts
```

### Request Flow

```
Client Request
    ↓
CORS Middleware
    ↓
Global Middlewares
    ↓
Route Matcher
    ↓
Route Middlewares (e.g., auth)
    ↓
Schema Validation (query, body)
    ↓
Route Handler
    ↓
Response Schema Validation
    ↓
Response to Client
```

### WebSocket Flow

```
WebSocket Upgrade Request
    ↓
Authentication (optional)
    ↓
Connection Established
    ↓
Message Received
    ↓
Message Type Detection
    ↓
Schema Validation
    ↓
Message Handler
    ↓
Response/Broadcast
```

## Technology Stack

### Runtime & Language
- **Bun** 1.3.3+ - JavaScript runtime and toolkit
- **TypeScript** 5.x - Type-safe JavaScript

### Backend
- **@bunkit/server** - Custom HTTP/WebSocket framework
- **Drizzle ORM** - Type-safe database toolkit
- **PostgreSQL** - Production database
- **Zod** - Schema validation
- **JWT** - Authentication tokens

### Frontend (Example)
- **React** 19 - UI library
- **Vite** - Build tool
- **TailwindCSS** 4 - Utility-first CSS
- **React Query** - Data fetching
- **TypeScript** - Type safety

### Development
- **Biome** - Fast linter and formatter
- **Drizzle Kit** - Database migrations
- **Docker** - Containerization
- **Bun Test** - Testing framework

## Project Status

BunKit is actively maintained and production-ready. It's designed to be:
- **Stable** - Core APIs are stable and documented
- **Extensible** - Easy to add features and customize
- **Educational** - Well-documented code for learning
- **Production-Ready** - Includes essential features for deployment

## Use Cases

### Perfect For
- REST APIs with OpenAPI documentation
- Real-time applications with WebSockets
- Full-stack TypeScript projects
- Microservices and backend services
- Learning modern TypeScript patterns
- Rapid prototyping and MVPs

### Not Ideal For
- Projects requiring Node.js-specific libraries
- Teams requiring specific frameworks (though frontend is replaceable)
- Projects with extensive Bun incompatibilities

## Getting Help

- **Documentation** - You're reading it! Continue to [Installation & Setup](./02-installation.md)
- **Example Code** - Check `apps/backend/src/routes/` for real implementations
- **GitHub Issues** - Report bugs or request features
- **Source Code** - All code is well-commented and readable

## Next Steps

Ready to get started?

1. **[Installation & Setup →](./02-installation.md)** - Set up your development environment
2. **[Project Structure →](./03-project-structure.md)** - Understand the codebase organization
3. **[@bunkit/server Package →](./04-server-package.md)** - Learn the framework API

Or jump directly to:
- [WebSocket Development](./07-websocket-guide.md)
- [Authentication & Security](./09-authentication.md)
- [Deployment Guide](./11-deployment.md)
