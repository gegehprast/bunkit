import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Badge } from "../../../../../components/ui/Badge"
import { Button } from "../../../../../components/ui/Button"
import { Input } from "../../../../../components/ui/Input"
import { Modal } from "../../../../../components/ui/Modal"
import { Select } from "../../../../../components/ui/Select"
import { Spinner } from "../../../../../components/ui/Spinner"
import { Table } from "../../../../../components/ui/Table"
import {
  type CreateConditionBody,
  ruleService,
  type UpdateRuleBody,
} from "../../../../../lib/api-service"

export const Route = createFileRoute(
  "/endpoints/$endpointId/rules/$ruleId/edit",
)({
  component: EditRulePage,
})

const LOGIC_OPERATORS = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
]

const CONDITION_FIELDS = [
  { value: "header", label: "Header" },
  { value: "body", label: "Body (JSON path)" },
  { value: "query", label: "Query Param" },
  { value: "method", label: "HTTP Method" },
  { value: "source_ip", label: "Source IP" },
]

const CONDITION_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "regex", label: "regex" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "not exists" },
]

function EditRulePage() {
  const { endpointId, ruleId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Partial<UpdateRuleBody>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [showAddCondition, setShowAddCondition] = useState(false)
  const [conditionForm, setConditionForm] = useState<
    Partial<CreateConditionBody>
  >({ field: "header", operator: "eq" })
  const [conditionError, setConditionError] = useState<string | null>(null)

  const { data: rule, isLoading } = useQuery({
    queryKey: ["rule", endpointId, ruleId],
    queryFn: async () => {
      const { data, error } = await ruleService.get(endpointId, ruleId)
      if (error) throw new Error("Failed to load rule")
      return data
    },
  })

  const { data: conditions, isLoading: conditionsLoading } = useQuery({
    queryKey: ["conditions", endpointId, ruleId],
    queryFn: async () => {
      const { data, error } = await ruleService.listConditions(
        endpointId,
        ruleId,
      )
      if (error) throw new Error("Failed to load conditions")
      return data ?? []
    },
  })

  useEffect(() => {
    if (rule) {
      setForm({
        name: rule.name,
        logicOperator: rule.logicOperator,
        priority: rule.priority,
        dropOnMatch: rule.dropOnMatch,
        enabled: rule.enabled,
      })
    }
  }, [rule])

  const updateMutation = useMutation({
    mutationFn: (body: UpdateRuleBody) =>
      ruleService.update(endpointId, ruleId, body),
    onSuccess: ({ error }) => {
      if (error) {
        setFormError(
          "message" in error
            ? (error as { message: string }).message
            : "Update failed",
        )
        return
      }
      queryClient.invalidateQueries({ queryKey: ["rules", endpointId] })
      navigate({ to: "/endpoints/$endpointId/rules", params: { endpointId } })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => ruleService.delete(endpointId, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules", endpointId] })
      navigate({ to: "/endpoints/$endpointId/rules", params: { endpointId } })
    },
  })

  const addConditionMutation = useMutation({
    mutationFn: (body: CreateConditionBody) =>
      ruleService.createCondition(endpointId, ruleId, body),
    onSuccess: ({ error }) => {
      if (error) {
        setConditionError(
          "message" in error
            ? (error as { message: string }).message
            : "Failed to add condition",
        )
        return
      }
      queryClient.invalidateQueries({
        queryKey: ["conditions", endpointId, ruleId],
      })
      setShowAddCondition(false)
      setConditionForm({ field: "header", operator: "eq" })
    },
  })

  const deleteConditionMutation = useMutation({
    mutationFn: (conditionId: string) =>
      ruleService.deleteCondition(endpointId, ruleId, conditionId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["conditions", endpointId, ruleId],
      }),
  })

  const handleAddCondition = () => {
    if (!conditionForm.field || !conditionForm.operator) {
      setConditionError("Field and operator are required.")
      return
    }
    addConditionMutation.mutate(conditionForm as CreateConditionBody)
  }

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  if (!rule) return <p className="text-zinc-500">Rule not found.</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/endpoints" className="text-zinc-400 hover:text-zinc-600">
          Endpoints
        </Link>
        <span className="text-zinc-300">/</span>
        <Link
          to="/endpoints/$endpointId/rules"
          params={{ endpointId }}
          className="text-zinc-400 hover:text-zinc-600"
        >
          Rules
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="font-medium text-zinc-700">{rule.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">{rule.name}</h1>
          <Badge variant={rule.enabled ? "success" : "warning"}>
            {rule.enabled ? "Active" : "Disabled"}
          </Badge>
          <Badge variant={rule.dropOnMatch ? "danger" : "success"}>
            {rule.dropOnMatch ? "Drop" : "Pass"}
          </Badge>
        </div>
        <Button variant="danger" onClick={() => setShowDelete(true)}>
          Delete Rule
        </Button>
      </div>

      {/* Rule form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-zinc-900">Rule Settings</h2>
        <div className="flex flex-col gap-4 max-w-lg">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Input
            id="er-name"
            label="Name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            id="er-logic"
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
            id="er-priority"
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
            Drop events on match
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.enabled ?? true}
              onChange={(e) =>
                setForm((f) => ({ ...f, enabled: e.target.checked }))
              }
              className="rounded"
            />
            Enabled
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() =>
                navigate({
                  to: "/endpoints/$endpointId/rules",
                  params: { endpointId },
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate(form as UpdateRuleBody)}
              loading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-zinc-900">Conditions</h2>
          <Button size="sm" onClick={() => setShowAddCondition(true)}>
            + Add Condition
          </Button>
        </div>
        {conditionsLoading ? (
          <Spinner />
        ) : (
          <Table
            keyField="id"
            data={conditions ?? []}
            emptyMessage="No conditions. This rule will match all events."
            columns={[
              {
                key: "field",
                header: "Field",
                render: (c) => <Badge>{c.field}</Badge>,
              },
              {
                key: "fieldKey",
                header: "Field Key",
                render: (c) =>
                  c.fieldKey ?? <span className="text-zinc-300">—</span>,
              },
              {
                key: "operator",
                header: "Operator",
                render: (c) => <Badge variant="info">{c.operator}</Badge>,
              },
              {
                key: "value",
                header: "Value",
                render: (c) =>
                  c.value ?? <span className="text-zinc-300">—</span>,
              },
              {
                key: "delete",
                header: "",
                render: (c) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConditionMutation.mutate(c.id)
                    }}
                  >
                    ✕
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>

      {/* Delete rule modal */}
      <Modal
        open={showDelete}
        title="Delete Rule"
        onClose={() => setShowDelete(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          Delete rule <strong>{rule.name}</strong>? All conditions will also be
          deleted.
        </p>
      </Modal>

      {/* Add condition modal */}
      <Modal
        open={showAddCondition}
        title="Add Condition"
        onClose={() => {
          setShowAddCondition(false)
          setConditionError(null)
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowAddCondition(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCondition}
              loading={addConditionMutation.isPending}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {conditionError && (
            <p className="text-sm text-red-600">{conditionError}</p>
          )}
          <Select
            id="c-field"
            label="Field"
            options={CONDITION_FIELDS}
            value={conditionForm.field ?? "header"}
            onChange={(e) =>
              setConditionForm((f) => ({
                ...f,
                field: e.target.value as CreateConditionBody["field"],
              }))
            }
          />
          <Input
            id="c-fieldkey"
            label="Field Key (e.g. header name or JSON path)"
            value={conditionForm.fieldKey ?? ""}
            onChange={(e) =>
              setConditionForm((f) => ({
                ...f,
                fieldKey: e.target.value || undefined,
              }))
            }
          />
          <Select
            id="c-operator"
            label="Operator"
            options={CONDITION_OPERATORS}
            value={conditionForm.operator ?? "eq"}
            onChange={(e) =>
              setConditionForm((f) => ({
                ...f,
                operator: e.target.value as CreateConditionBody["operator"],
              }))
            }
          />
          <Input
            id="c-value"
            label="Value"
            value={conditionForm.value ?? ""}
            onChange={(e) =>
              setConditionForm((f) => ({
                ...f,
                value: e.target.value || undefined,
              }))
            }
          />
        </div>
      </Modal>
    </div>
  )
}
