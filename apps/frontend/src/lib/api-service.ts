import type { components } from "../generated/openapi"
import { apiClient } from "./api-client"

// Type aliases for convenience
export type User = components["schemas"]["AuthResponse"]["user"]
export type Todo = components["schemas"]["Todo"]
export type CreateTodoInput = components["schemas"]["CreateTodoBody"]
export type UpdateTodoInput = components["schemas"]["UpdateTodoBody"]

export const authService = {
  async register(email: string, password: string, name: string) {
    const { data, error } = await apiClient.POST("/auth/register", {
      body: { email, password, name },
    })
    return { data, error }
  },

  async login(email: string, password: string) {
    const { data, error } = await apiClient.POST("/auth/login", {
      body: { email, password },
    })
    return { data, error }
  },

  async getCurrentUser() {
    const { data, error } = await apiClient.GET("/auth/me")
    return { data, error }
  },

  async logout() {
    // Clear token and optionally call backend logout endpoint
    return { success: true }
  },
}

export const todoService = {
  async list() {
    const { data, error } = await apiClient.GET("/api/todos")
    return { data, error }
  },

  async getById(id: string) {
    const { data, error } = await apiClient.GET("/api/todos/{id}", {
      params: { path: { id } },
    })
    return { data, error }
  },

  async create(input: CreateTodoInput) {
    const { data, error } = await apiClient.POST("/api/todos", {
      body: input,
    })
    return { data, error }
  },

  async update(id: string, input: UpdateTodoInput) {
    const { data, error } = await apiClient.PUT("/api/todos/{id}", {
      params: { path: { id } },
      body: input,
    })
    return { data, error }
  },

  async delete(id: string) {
    const { data, error } = await apiClient.DELETE("/api/todos/{id}", {
      params: { path: { id } },
    })
    return { data, error }
  },
}
