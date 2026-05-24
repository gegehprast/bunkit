import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Spinner } from "../../components/ui/Spinner"
import { Table } from "../../components/ui/Table"
import { type DeliveryAttempt, eventService } from "../../lib/api-service"

export const Route = createFileRoute("/events/$eventId")({
  component: EventDetailPage,
})

function EventDetailPage() {
  const { eventId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await eventService.get(eventId)
      if (error) throw new Error("Failed to load event")
      return data
    },
  })

  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ["event-attempts", eventId],
    queryFn: async () => {
      const { data, error } = await eventService.listAttempts(eventId)
      if (error) throw new Error("Failed to load attempts")
      return (data ?? []) as DeliveryAttempt[]
    },
  })

  const replayMutation = useMutation({
    mutationFn: () => eventService.replay(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attempts", eventId] })
    },
  })

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  if (!event) return <p className="text-zinc-500">Event not found.</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/events" className="text-zinc-400 hover:text-zinc-600">
          Events
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="font-medium text-zinc-700">
          {event.id.substring(0, 8)}…
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">Event Detail</h1>
          <Badge variant="info">{event.method}</Badge>
          {event.signatureValid != null && (
            <Badge variant={event.signatureValid ? "success" : "danger"}>
              Signature {event.signatureValid ? "valid" : "invalid"}
            </Badge>
          )}
        </div>
        <Button
          onClick={() => replayMutation.mutate()}
          loading={replayMutation.isPending}
        >
          Replay
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white p-6 text-sm">
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">
            Event ID
          </p>
          <code className="mt-1 block text-zinc-800">{event.id}</code>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">
            Endpoint ID
          </p>
          <code className="mt-1 block text-zinc-800">{event.endpointId}</code>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">
            Source IP
          </p>
          <p className="mt-1 text-zinc-800">{event.sourceIp ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">
            Received At
          </p>
          <p className="mt-1 text-zinc-800">
            {new Date(event.receivedAt).toLocaleString()}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs font-medium uppercase text-zinc-500">Headers</p>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-zinc-50 p-3 text-xs text-zinc-800">
            {JSON.stringify(event.headers, null, 2)}
          </pre>
        </div>
        <div className="col-span-2">
          <p className="text-xs font-medium uppercase text-zinc-500">Body</p>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-50 p-3 text-xs text-zinc-800">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(event.body), null, 2)
              } catch {
                return event.body
              }
            })()}
          </pre>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-zinc-900">Delivery Attempts</h2>
        {attemptsLoading ? (
          <Spinner />
        ) : (
          <Table<DeliveryAttempt>
            keyField="id"
            data={attempts ?? []}
            emptyMessage="No delivery attempts."
            columns={[
              { key: "attemptNumber", header: "#" },
              {
                key: "targetId",
                header: "Target",
                render: (a) => (
                  <code className="text-xs">{a.targetId.substring(0, 8)}…</code>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (a) => (
                  <Badge
                    variant={
                      a.status === "delivered"
                        ? "success"
                        : a.status === "failed" || a.status === "dlq"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {a.status}
                  </Badge>
                ),
              },
              {
                key: "responseStatus",
                header: "HTTP",
                render: (a) => a.responseStatus ?? "—",
              },
              {
                key: "responseLatencyMs",
                header: "Latency",
                render: (a) =>
                  a.responseLatencyMs ? `${a.responseLatencyMs}ms` : "—",
              },
              {
                key: "isReplay",
                header: "Replay",
                render: (a) =>
                  a.isReplay ? <Badge variant="info">Yes</Badge> : "—",
              },
              {
                key: "createdAt",
                header: "At",
                render: (a) => new Date(a.createdAt).toLocaleString(),
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}
