import { useEffect, useState } from "react"
import {
  type CreateTodoInput,
  type Todo,
  todoService,
  type UpdateTodoInput,
} from "../lib/api-service"

export const useTodos = () => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTodos = async () => {
    setIsLoading(true)
    setError(null)
    const { data, error: err } = await todoService.list()
    if (data) {
      setTodos(data)
    } else if (err) {
      setError(String(err) || "Failed to fetch todos")
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchTodos()
  }, [])

  const createTodo = async (input: CreateTodoInput) => {
    const { data, error: err } = await todoService.create(input)
    if (data) {
      setTodos((prev) => [...prev, data])
      return { success: true }
    }
    return { success: false, error: String(err) || "Failed to create todo" }
  }

  const updateTodo = async (id: string, input: UpdateTodoInput) => {
    const { data, error: err } = await todoService.update(id, input)
    if (data) {
      setTodos((prev) => prev.map((t) => (t.id === id ? data : t)))
      return { success: true }
    }
    return { success: false, error: String(err) || "Failed to update todo" }
  }

  const deleteTodo = async (id: string) => {
    const { error: err } = await todoService.delete(id)
    if (!err) {
      setTodos((prev) => prev.filter((t) => t.id !== id))
      return { success: true }
    }
    return { success: false, error: String(err) || "Failed to delete todo" }
  }

  return {
    todos,
    isLoading,
    error,
    createTodo,
    updateTodo,
    deleteTodo,
    refetch: fetchTodos,
  }
}
