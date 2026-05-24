import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Spinner } from "../../components/ui/Spinner"
import { Table } from "../../components/ui/Table"
import type { DeliveryAttempt } from "../../lib/api-service"
import { dlqService } from "../../lib/api-service"

export const Route = createFileRoute("/dlq/")({
  component: DlqPage,
})

function DlqPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDiscardAll, setShowDiscardAll] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["dlq"],
    queryFn: async () => {
      const { data, error } = await dlqService.list()
      if (error) throw new Error("Failed to load DLQ")
      return data
    },
  })

  const replayMutation = useMutation({
    mutationFn: (ids: string[]) => dlqService.replay({ ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dlq"] }),
  })

  const discardMutation = useMutation({
    mutationFn: (ids: string[]) => dlqService.discard({ ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlq"] })
      setSelected(new Set())
      setShowDiscardAll(false)
    },
  })

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const attempts = data?.attempts ?? []
  const selectedIds = Array.from(selected)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Dead Letter Queue
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {data?.total ?? 0} failed deliveries
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <Button
                variant="secondary"
                onClick={() => replayMutation.mutate(selectedIds)}
                loading={replayMutation.isPending}
              >
                Replay Selected ({selected.size})
              </Button>
              <Button
                variant="danger"
                onClick={() => discardMutation.mutate(selectedIds)}
                loading={discardMutation.isPending}
              >
                Discard Selected
              </Button>
            </>
          )}
          {attempts.length > 0 && selected.size === 0 && (
            <>
              <Button
                variant="secondary"
                onClick={() => replayMutation.mutate(attempts.map((a) => a.id))}
                loading={replayMutation.isPending}
              >
                Replay All
              </Button>
              <Button variant="danger" onClick={() => setShowDiscardAll(true)}>
                Discard All
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table
          keyField="id"
          data={attempts}
          emptyMessage="DLQ is empty."
          columns={[
            {
              key: "select",
              header: "",
              render: (a: DeliveryAttempt) => (
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggleSelect(a.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-zinc-300"
                />
              ),
            },
            {
              key: "eventId",
              header: "Event",
              render: (a) => (
                <code className="text-xs">{a.eventId.substring(0, 8)}…</code>
              ),
            },
            {
              key: "targetId",
              header: "Target",
              render: (a) => (
                <code className="text-xs">{a.targetId.substring(0, 8)}…</code>
              ),
            },
            { key: "attemptNumber", header: "Attempt #" },
            {
              key: "status",
              header: "Status",
              render: (a) => <Badge variant="danger">{a.status}</Badge>,
            },
            {
              key: "responseStatus",
              header: "HTTP",
              render: (a) => a.responseStatus ?? "—",
            },
            {
              key: "errorMessage",
              header: "Error",
              render: (a) => (
                <span className="text-xs text-zinc-500 truncate max-w-40 block">
                  {a.errorMessage ?? "—"}
                </span>
              ),
            },
            {
              key: "createdAt",
              header: "Failed At",
              render: (a) => new Date(a.createdAt).toLocaleString(),
            },
          ]}
        />
      )}

      <Modal
        open={showDiscardAll}
        title="Discard All DLQ Entries"
        onClose={() => setShowDiscardAll(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowDiscardAll(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => discardMutation.mutate(attempts.map((a) => a.id))}
              loading={discardMutation.isPending}
            >
              Discard All
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          This will permanently delete all {attempts.length} DLQ entries. This
          cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
