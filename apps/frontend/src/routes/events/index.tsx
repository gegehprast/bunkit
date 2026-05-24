import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Spinner } from "../../components/ui/Spinner"
import { Table } from "../../components/ui/Table"
import { eventService } from "../../lib/api-service"

export const Route = createFileRoute("/events/")({
  component: EventsPage,
})

function EventsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await eventService.list()
      if (error) throw new Error("Failed to load events")
      return data
    },
  })

  const replayMutation = useMutation({
    mutationFn: (id: string) => eventService.replay(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Events</h1>
        <span className="text-sm text-zinc-500">{data?.total ?? 0} total</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table
          keyField="id"
          data={data?.events ?? []}
          emptyMessage="No events received yet."
          onRowClick={(e) =>
            navigate({ to: "/events/$eventId", params: { eventId: e.id } })
          }
          columns={[
            {
              key: "id",
              header: "ID",
              render: (e) => (
                <code className="text-xs text-zinc-500">
                  {e.id.substring(0, 8)}…
                </code>
              ),
            },
            {
              key: "endpointId",
              header: "Endpoint",
              render: (e) => (
                <code className="text-xs">{e.endpointId.substring(0, 8)}…</code>
              ),
            },
            {
              key: "method",
              header: "Method",
              render: (e) => <Badge variant="info">{e.method}</Badge>,
            },
            {
              key: "signatureValid",
              header: "Sig",
              render: (e) =>
                e.signatureValid == null ? (
                  <Badge>N/A</Badge>
                ) : (
                  <Badge variant={e.signatureValid ? "success" : "danger"}>
                    {e.signatureValid ? "✓" : "✗"}
                  </Badge>
                ),
            },
            {
              key: "receivedAt",
              header: "Received",
              render: (e) => new Date(e.receivedAt).toLocaleString(),
            },
            {
              key: "replay",
              header: "",
              render: (e) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    replayMutation.mutate(e.id)
                  }}
                  loading={
                    replayMutation.isPending &&
                    replayMutation.variables === e.id
                  }
                >
                  Replay
                </Button>
              ),
            },
            {
              key: "detail",
              header: "",
              render: (e) => (
                <Link
                  to="/events/$eventId"
                  params={{ eventId: e.id }}
                  className="text-sm text-indigo-600 hover:underline"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  Details →
                </Link>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
