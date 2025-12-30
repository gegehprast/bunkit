# @bunkit/server

Type-safe HTTP server with automatic OpenAPI 3.1 generation using `zod-openapi`, route management, and middleware support for BunKit applications.

## Features

- ✅ **Type-Safe** - Full TypeScript inference with compile-time validation
- ✅ **Auto Path Parameters** - Automatically extracted from route strings
- ✅ **OpenAPI Generation** - Automatic spec generation via `zod-openapi`
- ✅ **Zod Validation** - Request validation with helpful error messages
- ✅ **Middleware Support** - Global and route-level middlewares
- ✅ **CORS Built-in** - Configurable CORS with automatic preflight handling
- ✅ **Result Pattern** - Error handling without exceptions
- ✅ **Bun Native** - Uses `Bun.serve` for optimal performance

## Installation

```bash
bun add @bunkit/server
```

## Quick Start

```typescript
import { z } from "zod"
import { createRoute, createServer } from "@bunkit/server"

// Define a schema with OpenAPI metadata
const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
}).meta({ id: "Todo" })

// Create a route with automatic type inference
createRoute("GET", "/api/todos/:id")
  .openapi({ 
    operationId: "getTodo", 
    tags: ["Todos"] 
  })
  .response(TodoSchema)
  .errors([404])
  .handler(({ params, res }) => {
    // params.id is automatically typed as string!
    const todo = { id: params.id, title: "Test", completed: false }
    return res.ok(todo)
  })

// Create and start server
const server = createServer({ port: 3000 })
await server.start()

// Export OpenAPI spec
await server.exportOpenApiSpec("./openapi.json")
```

## Documentation

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for complete API reference and usage examples.

## Key Features

### Automatic Path Parameter Extraction

Path parameters are automatically extracted and typed:

```typescript
createRoute("GET", "/api/users/:userId/posts/:postId")
  .handler(({ params, res }) => {
    // params.userId and params.postId are automatically typed as string
    return res.ok({ userId: params.userId, postId: params.postId })
  })
```

### Type-Safe Request/Response

```typescript
const TodoSchema = z.object({ id: z.string(), title: z.string() })

createRoute("POST", "/api/todos")
  .body(z.object({ title: z.string() }))
  .response(TodoSchema)
  .handler(({ body, res }) => {
    // body.title is typed as string
    // Return type is validated at compile time
    return res.created({ id: "1", title: body.title })
  })
```

### Middleware System

```typescript
const logger: MiddlewareFn = async ({ req, next }) => {
  console.log(`${req.method} ${new URL(req.url).pathname}`)
  return next()
}

const server = createServer({
  globalMiddlewares: [logger]
})
```

### OpenAPI Generation

Automatic OpenAPI 3.1 spec generation using `zod-openapi`:

```typescript
const server = createServer()
const spec = server.getOpenApiSpec()
await server.exportOpenApiSpec("./openapi.json")
```

## Testing

```bash
bun test
```

## License

MIT
