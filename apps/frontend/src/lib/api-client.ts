import createClient from "openapi-fetch"
import type { paths } from "../generated/openapi"

// Create typed client
export const apiClient = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:3001",
})

// Token management
let authToken: string | null = null

export const setAuthToken = (token: string | null) => {
  authToken = token
  if (token) {
    localStorage.setItem("auth_token", token)
  } else {
    localStorage.removeItem("auth_token")
  }
}

export const getAuthToken = (): string | null => {
  if (!authToken) {
    authToken = localStorage.getItem("auth_token")
  }
  return authToken
}

// Initialize token from localStorage
setAuthToken(getAuthToken())

// Add auth header to all requests
apiClient.use({
  onRequest({ request }) {
    const token = getAuthToken()
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`)
    }
    return request
  },
})
