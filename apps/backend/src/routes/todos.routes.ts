import { createRoute } from "@bunkit/server"
import { z } from "zod"
import { getTodoRepository } from "@/db/repositories/todo-repository"
import { authMiddleware } from "@/middlewares/auth.middleware"

// Schemas
const TodoSchema = z
  .object({
    id: z.string().meta({ example: "1" }),
    userId: z.string().meta({ example: "user-123" }),
    title: z.string().meta({ example: "Buy groceries" }),
    description: z.string().nullable().meta({ example: "Milk, Bread, Eggs" }),
    completed: z.boolean().meta({ example: false }),
    createdAt: z.string().meta({ example: new Date().toISOString() }),
    updatedAt: z.string().meta({ example: new Date().toISOString() }),
  })
  .meta({
    id: "Todo",
    title: "Todo Item",
    description: "Schema representing a todo item",
  })

const CreateTodoBodySchema = z
  .object({
    title: z.string().min(1).max(100).meta({ example: "Buy groceries" }),
    description: z.string().optional().meta({ example: "Milk, Bread, Eggs" }),
  })
  .meta({
    id: "CreateTodoBody",
    title: "Create Todo Body",
    description: "Schema for creating a new todo item",
  })

const UpdateTodoBodySchema = z
  .object({
    title: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .meta({ example: "Buy groceries" }),
    description: z.string().optional().meta({ example: "Milk, Bread, Eggs" }),
    completed: z.boolean().optional().meta({ example: false }),
  })
  .meta({
    id: "UpdateTodoBody",
    title: "Update Todo Body",
    description: "Schema for updating a todo item",
  })

const ListTodosQuerySchema = z
  .object({
    completed: z.string().optional().meta({
      example: "true",
      description: "Filter todos by completion status",
    }),
    limit: z.string().optional().meta({
      example: "10",
      description: "Maximum number of todos to return",
    }),
  })
  .meta({
    id: "ListTodosQuery",
    title: "List Todos Query",
    description: "Schema for listing todos with optional filters",
  })

/**
 * GET /api/todos - List all todos for authenticated user
 */
createRoute("GET", "/api/todos")
  .openapi({
    operationId: "listTodos",
    summary: "List todos",
    description:
      "Lists all todo items for the authenticated user (requires Bearer token)",
    tags: ["Todos"],
  })
  .middlewares(authMiddleware())
  .query(ListTodosQuerySchema)
  .response(z.array(TodoSchema))
  .handler(async ({ ctx, query, res }) => {
    const todoRepo = getTodoRepository()
    const userId = ctx.userId as string

    const todosResult = await todoRepo.findByUserId(userId, {
      completed:
        query.completed === "true"
          ? true
          : query.completed === "false"
            ? false
            : undefined,
      limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
    })

    if (todosResult.isErr()) {
      return res.internalError({
        message: "Failed to fetch todos",
        code: "DATABASE_ERROR",
      })
    }

    return res.ok(
      todosResult.value.map((todo) => ({
        id: todo.id,
        userId: todo.userId,
        title: todo.title,
        description: todo.description,
        completed: todo.completed,
        createdAt: todo.createdAt.toISOString(),
        updatedAt: todo.updatedAt.toISOString(),
      })),
    )
  })

/**
 * POST /api/todos - Create a new todo
 */
createRoute("POST", "/api/todos")
  .openapi({
    operationId: "createTodo",
    summary: "Create a new todo",
    description:
      "Creates a new todo for the authenticated user (requires Bearer token)",
    tags: ["Todos"],
  })
  .middlewares(authMiddleware())
  .body(CreateTodoBodySchema)
  .response(TodoSchema)
  .handler(async ({ ctx, body, res }) => {
    const todoRepo = getTodoRepository()
    const userId = ctx.userId as string

    const createResult = await todoRepo.create({
      userId,
      title: body.title,
      description: body.description ?? null,
    })

    if (createResult.isErr()) {
      return res.internalError({
        message: "Failed to create todo",
        code: "DATABASE_ERROR",
      })
    }

    const todo = createResult.value
    return res.created({
      id: todo.id,
      userId: todo.userId,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      createdAt: todo.createdAt.toISOString(),
      updatedAt: todo.updatedAt.toISOString(),
    })
  })

/**
 * GET /api/todos/:id - Get a specific todo by ID
 */
createRoute("GET", "/api/todos/:id")
  .openapi({
    operationId: "getTodo",
    summary: "Get a todo by ID",
    description:
      "Retrieves a specific todo item by its ID (requires Bearer token)",
    tags: ["Todos"],
  })
  .middlewares(authMiddleware())
  .response(TodoSchema)
  .handler(async ({ ctx, params, res }) => {
    const todoRepo = getTodoRepository()
    const userId = ctx.userId as string

    const todoResult = await todoRepo.findById(params.id)

    if (todoResult.isErr()) {
      return res.internalError({
        message: "Failed to fetch todo",
        code: "DATABASE_ERROR",
      })
    }

    if (!todoResult.value) {
      return res.notFound("Todo not found")
    }

    const todo = todoResult.value

    // Check if todo belongs to user
    if (todo.userId !== userId) {
      return res.forbidden({ message: "Access denied" })
    }

    return res.ok({
      id: todo.id,
      userId: todo.userId,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      createdAt: todo.createdAt.toISOString(),
      updatedAt: todo.updatedAt.toISOString(),
    })
  })

/**
 * PUT /api/todos/:id - Update a todo
 */
createRoute("PUT", "/api/todos/:id")
  .openapi({
    operationId: "updateTodo",
    summary: "Update a todo",
    description: "Updates a todo item by its ID (requires Bearer token)",
    tags: ["Todos"],
  })
  .middlewares(authMiddleware())
  .body(UpdateTodoBodySchema)
  .response(TodoSchema)
  .handler(async ({ ctx, params, body, res }) => {
    const todoRepo = getTodoRepository()
    const userId = ctx.userId as string

    // First check if todo exists and belongs to user
    const existingResult = await todoRepo.findById(params.id)

    if (existingResult.isErr()) {
      return res.internalError({
        message: "Failed to fetch todo",
        code: "DATABASE_ERROR",
      })
    }

    if (!existingResult.value) {
      return res.notFound("Todo not found")
    }

    if (existingResult.value.userId !== userId) {
      return res.forbidden({ message: "Access denied" })
    }

    // Update the todo
    const updateResult = await todoRepo.update(params.id, body)

    if (updateResult.isErr()) {
      return res.internalError({
        message: "Failed to update todo",
        code: "DATABASE_ERROR",
      })
    }

    if (!updateResult.value) {
      return res.notFound("Todo not found")
    }

    const todo = updateResult.value
    return res.ok({
      id: todo.id,
      userId: todo.userId,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      createdAt: todo.createdAt.toISOString(),
      updatedAt: todo.updatedAt.toISOString(),
    })
  })

/**
 * DELETE /api/todos/:id - Delete a todo
 */
createRoute("DELETE", "/api/todos/:id")
  .openapi({
    operationId: "deleteTodo",
    summary: "Delete a todo",
    description: "Deletes a todo item by its ID (requires Bearer token)",
    tags: ["Todos"],
  })
  .middlewares(authMiddleware())
  .response(z.object({ message: z.string() }))
  .handler(async ({ ctx, params, res }) => {
    const todoRepo = getTodoRepository()
    const userId = ctx.userId as string

    // First check if todo exists and belongs to user
    const existingResult = await todoRepo.findById(params.id)

    if (existingResult.isErr()) {
      return res.internalError({
        message: "Failed to fetch todo",
        code: "DATABASE_ERROR",
      })
    }

    if (!existingResult.value) {
      return res.notFound("Todo not found")
    }

    if (existingResult.value.userId !== userId) {
      return res.forbidden({ message: "Access denied" })
    }

    // Delete the todo
    const deleteResult = await todoRepo.delete(params.id)

    if (deleteResult.isErr()) {
      return res.internalError({
        message: "Failed to delete todo",
        code: "DATABASE_ERROR",
      })
    }

    return res.ok({ message: "Todo deleted successfully" })
  })
