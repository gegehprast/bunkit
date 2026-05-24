import createClient from "openapi-fetch"
import type { paths } from "../generated/openapi"

// In dev the Vite proxy forwards /api → http://localhost:3001.
// In production the frontend is served by the same origin as the backend.
// Using a relative base URL means cookies are always same-origin.
export const apiClient = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:3001",
  credentials: "include",
})
