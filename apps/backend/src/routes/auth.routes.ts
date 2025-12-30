import { createRoute } from "@bunkit/server"
import { err, ok } from "@bunstart/result"
import { z } from "zod"
import { authMiddleware } from "@/middlewares/auth.middleware"

// These schemas will be registered as part of OpenAPI documentation
// as a reusable component schemas
const CreateTodoBodySchema = z
  .object({
    title: z.string().min(1).max(100).meta({ example: "Buy groceries" }),
    description: z.string().optional().meta({ example: "Milk, Bread, Eggs" }),
    completed: z.boolean().optional().meta({ example: false }),
  })
  .meta({
    id: "CreateTodoBody", // This ID will be used as ref
    title: "Create Todo Body",
    description: "Schema for creating a new todo item",
  })

const ListTodosQuerySchema = z
  .object({
    completed: z.string().optional().meta({
      example: "true",
      description: "Filter todos by completion status",
    }),
  })
  .meta({
    id: "ListTodosQuery", // This ID will be used as ref
    title: "List Todos Query",
    description: "Schema for listing todos with optional completion filter",
  })

const TodoSchema = z
  .object({
    id: z.string().meta({ example: "1" }),
    title: z.string().meta({ example: "Buy groceries" }),
    description: z.string().optional().meta({ example: "Milk, Bread, Eggs" }),
    completed: z.boolean().meta({ example: false }),
    createdAt: z.string().meta({ example: new Date().toISOString() }),
  })
  .meta({
    id: "Todo", // This ID will be used as ref
    title: "Todo Item",
    description: "Schema representing a todo item",
  })

const todos = new Map<string, z.infer<typeof TodoSchema>>()

// Get specific todo by ID
createRoute("GET", "/api/todos/:id")
  .openapi({
    operationId: "getTodo",
    summary: "Get a todo by ID",
    description: "Retrieves a todo item by its unique ID",
    tags: ["Todos"],
  })
  .response(TodoSchema) // This method will register any schema for the OpenAPI docs
  .handler(async ({ req, res, params, query, body, ctx }) => {
    const todo = todos.get(params.id)
    if (!todo) {
      return res.notFound("Todo not found")
    }
    return res.ok(todo)
  })

// List todos by completion status
createRoute("GET", "/api/todos")
  .openapi({
    operationId: "listTodos",
    summary: "List todos",
    description:
      "Lists all todo items, optionally filtered by completion status",
    tags: ["Todos"],
  })
  .query(ListTodosQuerySchema) // This method will register any schema for the OpenAPI docs
  .response(z.array(TodoSchema)) // This method will register any schema for the OpenAPI docs
  .handler(async ({ req, res, params, query, body, ctx }) => {
    let result = Array.from(todos.values())
    if (query.completed !== undefined) {
      const isCompleted = query.completed === "true"
      result = result.filter((todo) => todo.completed === isCompleted)
    }
    return res.ok(result)
  })

// create an in-memory store for todos
createRoute("POST", "/api/todos")
  .openapi({
    operationId: "createTodo",
    summary: "Create a new todo",
    description: "Creates a new todo with the provided data",
    tags: ["Todos"],
  })
  .middlewares(
    authMiddleware({
      validate: ({ req }) => {
        const bearer = req.headers.get("authorization")?.split(" ")[1]
        if (bearer === "valid-token") {
          return ok(void 0)
        }
        return err(new Error("Invalid token"))
      },
    }),
  )
  .body(CreateTodoBodySchema)
  .response(TodoSchema)
  .handler(async ({ req, res, params, query, body, ctx }) => {
    const id = String(todos.size + 1)
    const newTodo: z.infer<typeof TodoSchema> = {
      id,
      title: body.title,
      description: body.description,
      completed: body.completed ?? false,
      createdAt: new Date().toISOString(),
    }

    // save to in-memory store
    todos.set(id, newTodo)

    return res.ok(newTodo)
  })
