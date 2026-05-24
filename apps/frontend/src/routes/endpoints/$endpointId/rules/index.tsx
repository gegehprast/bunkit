import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Badge } from "../../../../components/ui/Badge"
import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Modal } from "../../../../components/ui/Modal"
import { Select } from "../../../../components/ui/Select"
import { Spinner } from "../../../../components/ui/Spinner"
import { Table } from "../../../../components/ui/Table"
import { type CreateRuleBody, ruleService } from "../../../../lib/api-service"

export const Route = createFileRoute("/endpoints/$endpointId/rules/")({
  component: RulesPage,
})

const LOGIC_OPERATORS = [
  { value: "AND", label: "AND (all conditions must match)" },
  { value: "OR", label: "OR (any condition must match)" },
]

function RulesPage() {
  const { endpointId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Partial<CreateRuleBody>>({
    logicOperator: "AND",
    priority: 0,
    dropOnMatch: false,
    enabled: true,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const { data: rules, isLoading } = useQuery({
    queryKey: ["rules", endpointId],
    queryFn: async () => {
      const { data, error } = await ruleService.list(endpointId)
      if (error) throw new Error("Failed to load rules")
      return data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateRuleBody) => ruleService.create(endpointId, body),
    onSuccess: ({ error }) => {
      if (error) {
        setFormError(
          "message" in error
            ? (error as { message: string }).message
            : "Create failed",
        )
        return
      }
      queryClient.invalidateQueries({ queryKey: ["rules", endpointId] })
      setShowCreate(false)
      setForm({
        logicOperator: "AND",
        priority: 0,
        dropOnMatch: false,
        enabled: true,
      })
      setFormError(null)
    },
  })

  const handleCreate = () => {
    if (!form.name) {
      setFormError("Name is required.")
      return
    }
    createMutation.mutate(form as CreateRuleBody)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/endpoints" className="text-zinc-400 hover:text-zinc-600">
          Endpoints
        </Link>
        <span className="text-zinc-300">/</span>
        <Link
          to="/endpoints/$endpointId"
          params={{ endpointId }}
          className="text-zinc-400 hover:text-zinc-600"
        >
          Detail
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="font-medium text-zinc-700">Filter Rules</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Filter Rules</h1>
        <Button onClick={() => setShowCreate(true)}>+ New Rule</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table
          keyField="id"
          data={rules ?? []}
          emptyMessage="No filter rules. All events will be forwarded."
          onRowClick={(r) =>
            navigate({
              to: "/endpoints/$endpointId/rules/$ruleId/edit",
              params: { endpointId, ruleId: r.id },
            })
          }
          columns={[
            {
              key: "name",
              header: "Name",
              render: (r) => <span className="font-medium">{r.name}</span>,
            },
            {
              key: "logicOperator",
              header: "Logic",
              render: (r) => <Badge>{r.logicOperator}</Badge>,
            },
            { key: "priority", header: "Priority" },
            {
              key: "dropOnMatch",
              header: "Action",
              render: (r) => (
                <Badge variant={r.dropOnMatch ? "danger" : "success"}>
                  {r.dropOnMatch ? "Drop" : "Pass"}
                </Badge>
              ),
            },
            {
              key: "enabled",
              header: "Status",
              render: (r) => (
                <Badge variant={r.enabled ? "success" : "warning"}>
                  {r.enabled ? "Active" : "Disabled"}
                </Badge>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={showCreate}
        title="New Filter Rule"
        onClose={() => {
          setShowCreate(false)
          setFormError(null)
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createMutation.isPending}>
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Input
            id="r-name"
            label="Rule Name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            id="r-logic"
            label="Logic Operator"
            options={LOGIC_OPERATORS}
            value={form.logicOperator ?? "AND"}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                logicOperator: e.target.value as "AND" | "OR",
              }))
            }
          />
          <Input
            id="r-priority"
            label="Priority"
            type="number"
            value={form.priority ?? 0}
            onChange={(e) =>
              setForm((f) => ({ ...f, priority: Number(e.target.value) }))
            }
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.dropOnMatch ?? false}
              onChange={(e) =>
                setForm((f) => ({ ...f, dropOnMatch: e.target.checked }))
              }
              className="rounded"
            />
            Drop events on match (default: pass through)
          </label>
        </div>
      </Modal>
    </div>
  )
}
