import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { authService } from "../lib/api-service"

function LoginPage() {
  const navigate = useNavigate()
  const [key, setKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) {
      setError("API key is required")
      return
    }

    setLoading(true)
    setError(null)

    const { error: apiError } = await authService.login(trimmed)

    if (apiError) {
      setError("Invalid API key")
      setLoading(false)
      return
    }

    // Cookie is set by the server — just navigate
    navigate({ to: "/" })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">hookitup</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your API key to continue
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="API Key"
            type="password"
            placeholder="••••••••"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            error={error ?? undefined}
            autoFocus
          />
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
})
