import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type FormEvent, useState } from "react"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { setupService } from "../lib/api-service"

function SetupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState("Admin")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: apiError } = await setupService.run(
      name.trim() || "Admin",
    )

    if (apiError || !data) {
      setError(
        (apiError as { message?: string } | undefined)?.message ??
          "Setup failed. The app may already be configured.",
      )
      setLoading(false)
      return
    }

    setCreatedKey(data.key)
    setLoading(false)
  }

  async function handleCopy() {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleContinue() {
    // Cookie was set server-side when the setup response was received
    navigate({ to: "/" })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">
            Welcome to hookitup
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            First-time setup — create your admin API key
          </p>
        </div>

        {!createdKey ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Key name"
              placeholder="Admin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={error ?? undefined}
              autoFocus
            />
            <Button type="submit" loading={loading} className="w-full">
              Create key &amp; get started
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="mb-2 text-xs font-medium text-green-800">
                Your API key — copy it now, it won't be shown again
              </p>
              <code className="block break-all text-xs text-green-900">
                {createdKey}
              </code>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleCopy}
              >
                {copied ? "Copied!" : "Copy key"}
              </Button>
              <Button className="flex-1" onClick={handleContinue}>
                Continue
              </Button>
            </div>
            <p className="text-center text-xs text-zinc-400">
              "Continue" will sign you in automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/setup")({
  component: SetupPage,
})
