import type { ReactNode } from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { getAuthToken, setAuthToken } from "../lib/api-client"
import { authService, type User } from "../lib/api-service"

export interface ValidationDetail {
  field: string
  message: string
}

interface AuthResult {
  success: boolean
  error?: string
  validationErrors?: ValidationDetail[]
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (
    email: string,
    password: string,
    name: string,
  ) => Promise<AuthResult>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      const token = getAuthToken()
      if (token) {
        const { data } = await authService.getCurrentUser()
        console.log("Loaded current user:", data)
        if (data) {
          setUser(data)
        }
      }
      setIsLoading(false)
    }
    loadUser()
  }, [])

  const login = async (email: string, password: string) => {
    const { data, error } = await authService.login(email, password)
    if (data) {
      setAuthToken(data.token)
      setUser(data.user)
      return { success: true }
    }
    const errorMessage = error?.message || "Login failed"
    const validationErrors = error?.details as ValidationDetail[] | undefined
    return { success: false, error: errorMessage, validationErrors }
  }

  const register = async (email: string, password: string, name: string) => {
    const { data, error } = await authService.register(email, password, name)
    if (data) {
      setAuthToken(data.token)
      setUser(data.user)
      return { success: true }
    }
    const errorMessage = error?.message || "Registration failed"
    const validationErrors = error?.details as ValidationDetail[] | undefined
    return { success: false, error: errorMessage, validationErrors }
  }

  const logout = () => {
    setAuthToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
