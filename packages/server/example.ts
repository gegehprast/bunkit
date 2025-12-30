import { z } from "zod"
import { createRoute, createServer } from "./src/index"

// Define schemas with OpenAPI metadata
const TodoSchema = z
  .object({
    id: z.string().meta({ description: "Todo ID" }),
    title: z.string().meta({ description: "Todo title" }),
    completed: z.boolean().meta({ description: "Completion status" }),
  })
  .meta({ id: "Todo" })

const CreateTodoSchema = z.object({
  title: z.string().min(1).meta({ description: "Todo title" }),
})

const QuerySchema = z.object({
  limit: z.string().optional().meta({ description: "Items per page" }),
})

// Define routes with full type safety
createRoute("GET", "/api/todos")
  .openapi({
    operationId: "listTodos",
    summary: "List all todos",
    tags: ["Todos"],
  })
  .query(QuerySchema)
  .response(z.array(TodoSchema))
  .handler(({ res }) => {
    // query.limit is typed as string | undefined
    const todos = [
      { id: "1", title: "Buy milk", completed: false },
      { id: "2", title: "Walk dog", completed: true },
    ]
    return res.ok(todos)
  })

createRoute("GET", "/api/todos/:id")
  .openapi({
    operationId: "getTodo",
    summary: "Get a todo by ID",
    tags: ["Todos"],
  })
  .response(TodoSchema)
  .errors([404])
  .handler(({ params, res }) => {
    // params.id is automatically typed as string
    const todo = { id: params.id, title: "Test", completed: false }
    return res.ok(todo)
  })

createRoute("POST", "/api/todos")
  .openapi({
    operationId: "createTodo",
    summary: "Create a new todo",
    tags: ["Todos"],
  })
  .body(CreateTodoSchema)
  .response(TodoSchema)
  .errors([400])
  .handler(({ body, res }) => {
    // body.title is typed as string
    const newTodo = {
      id: Math.random().toString(),
      title: body.title,
      completed: false,
    }
    return res.created(newTodo, `/api/todos/${newTodo.id}`)
  })

createRoute("DELETE", "/api/todos/:id")
  .openapi({
    operationId: "deleteTodo",
    summary: "Delete a todo",
    tags: ["Todos"],
  })
  .errors([404])
  .handler(({ params, res }) => {
    // params.id is automatically typed
    console.log(`Deleting todo ${params.id}`)
    return res.noContent()
  })

// Create and configure server
const server = createServer({
  port: 3000,
  cors: {
    origin: ["http://localhost:3000"],
    credentials: true,
  },
  globalMiddlewares: [
    async ({ req, next }) => {
      console.log(`${req.method} ${new URL(req.url).pathname}`)
      return next()
    },
  ],
})

// Start server
const result = await server.start()

if (result.isOk()) {
  console.log("✓ Server started successfully")

  // Export OpenAPI spec
  const exportResult = await server.exportOpenApiSpec("./openapi.json")
  if (exportResult.isOk()) {
    console.log("✓ OpenAPI spec exported to openapi.json")
  }
} else {
  console.error("✗ Failed to start server:", result.error)
  process.exit(1)
}
