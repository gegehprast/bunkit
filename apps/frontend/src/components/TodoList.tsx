import { useState } from "react"
import type { components } from "../generated/openapi"
import { useTodos } from "../hooks/useTodos"

type Todo = components["schemas"]["Todo"]

export const TodoList = () => {
  const { todos, isLoading, error, createTodo, updateTodo, deleteTodo } =
    useTodos()
  const [newTodoTitle, setNewTodoTitle] = useState("")

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoTitle.trim()) return

    const result = await createTodo({
      title: newTodoTitle,
    })

    if (result.success) {
      setNewTodoTitle("")
    }
  }

  const handleToggle = async (todo: Todo) => {
    await updateTodo(todo.id, { completed: !todo.completed })
  }

  const handleDelete = async (id: string) => {
    if (confirm("Delete this todo?")) {
      await deleteTodo(id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">{error}</div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Todos</h2>

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="New todo..."
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition duration-200 shadow-md hover:shadow-lg"
        >
          Add
        </button>
      </form>

      {todos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No todos yet. Create one!</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border border-gray-200"
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggle(todo)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <span
                className={`flex-1 ${todo.completed ? "line-through text-gray-500" : "text-gray-900"}`}
              >
                {todo.title}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(todo.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition font-medium"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
