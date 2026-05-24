import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "../components/ui/Badge"
import { Button } from "../components/ui/Button"
import { useLiveFeed } from "../hooks/useLiveFeed"
import type { ConnectionStatus } from "../lib/websocket-client"

export const Route = createFileRoute("/feed")({
  component: FeedPage,
})

const statusVariantMap: Record<
  ConnectionStatus,
  "success" | "warning" | "danger" | "default"
> = {
  connected: "success",
  connecting: "warning",
  disconnected: "default",
  error: "danger",
}

function FeedPage() {
  const { events, status, clear } = useLiveFeed()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">Live Feed</h1>
          <Badge variant={statusVariantMap[status]}>{status}</Badge>
        </div>
        <Button variant="secondary" size="sm" onClick={clear}>
          Clear
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <p className="text-4xl">📡</p>
          <p className="mt-3 text-sm">Waiting for events…</p>
          {status !== "connected" && (
            <p className="mt-1 text-xs text-zinc-300">
              WebSocket status: {status}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm"
            >
              <Badge variant="info">{event.method}</Badge>
              <code className="text-zinc-500 text-xs">
                {event.id.substring(0, 8)}…
              </code>
              <code className="text-zinc-400 text-xs">
                {event.endpointId.substring(0, 8)}…
              </code>
              {event.signatureValid != null && (
                <Badge variant={event.signatureValid ? "success" : "danger"}>
                  {event.signatureValid ? "sig ✓" : "sig ✗"}
                </Badge>
              )}
              {event.sourceIp && (
                <span className="text-zinc-400 text-xs">{event.sourceIp}</span>
              )}
              <span className="ml-auto text-zinc-400 text-xs">
                {new Date(event.receivedAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
