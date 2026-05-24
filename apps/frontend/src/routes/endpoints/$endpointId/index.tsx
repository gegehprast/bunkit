import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Badge } from "../../../components/ui/Badge"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import { Select } from "../../../components/ui/Select"
import { Spinner } from "../../../components/ui/Spinner"
import {
  endpointService,
  type SendTestBody,
  type SendTestResult,
  type UpdateEndpointBody,
} from "../../../lib/api-service"

export const Route = createFileRoute("/endpoints/$endpointId/")({
  component: EndpointDetailPage,
})

const SIGNING_SCHEMES = [
  { value: "none", label: "None" },
  { value: "hmac_sha256", label: "HMAC SHA-256" },
  { value: "hmac_sha1", label: "HMAC SHA-1" },
  { value: "stripe", label: "Stripe" },
  { value: "github", label: "GitHub" },
  { value: "svix", label: "Svix" },
  { value: "custom", label: "Custom" },
]

function EndpointDetailPage() {
  const { endpointId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showSendTest, setShowSendTest] = useState(false)
  const [testForm, setTestForm] = useState<Partial<SendTestBody>>({
    body: "{}",
    method: "POST",
  })
  const [testResult, setTestResult] = useState<SendTestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<UpdateEndpointBody>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const { data: endpoint, isLoading } = useQuery({
    queryKey: ["endpoint", endpointId],
    queryFn: async () => {
      const { data, error } = await endpointService.get(endpointId)
      if (error) throw new Error("Failed to load endpoint")
      return data
    },
  })

  const updateMutation = useMutation({
    mutationFn: (body: UpdateEndpointBody) =>
      endpointService.update(endpointId, body),
    onSuccess: ({ error }) => {
      if (error) {
        setFormError(
          "message" in error
            ? (error as { message: string }).message
            : "Update failed",
        )
        return
      }
      queryClient.invalidateQueries({ queryKey: ["endpoint", endpointId] })
      queryClient.invalidateQueries({ queryKey: ["endpoints"] })
      setShowEdit(false)
      setFormError(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => endpointService.delete(endpointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["endpoints"] })
      navigate({ to: "/endpoints" })
    },
  })

  const openEdit = () => {
    if (endpoint) {
      setForm({
        name: endpoint.name,
        slug: endpoint.slug,
        description: endpoint.description ?? undefined,
        signingScheme: endpoint.signingScheme,
        enabled: endpoint.enabled,
      })
    }
    setShowEdit(true)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (!endpoint) {
    return <p className="text-zinc-500">Endpoint not found.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          to="/endpoints"
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          Endpoints
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="text-sm font-medium text-zinc-700">
          {endpoint.name}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">{endpoint.name}</h1>
          <Badge variant={endpoint.enabled ? "success" : "warning"}>
            {endpoint.enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setTestForm({ body: "{}", method: "POST" })
              setTestResult(null)
              setTestError(null)
              setShowSendTest(true)
            }}
          >
            Send Test
          </Button>
          <Button variant="secondary" onClick={openEdit}>
            Edit
          </Button>
          <Button variant="danger" onClick={() => setShowDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase">
            Webhook URL
          </p>
          <code className="mt-1 block text-sm text-zinc-800">
            /hooks/{endpoint.slug}
          </code>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase">
            Signing Scheme
          </p>
          <p className="mt-1 text-sm text-zinc-800">{endpoint.signingScheme}</p>
        </div>
        {endpoint.description && (
          <div className="col-span-2">
            <p className="text-xs font-medium text-zinc-500 uppercase">
              Description
            </p>
            <p className="mt-1 text-sm text-zinc-800">{endpoint.description}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase">Created</p>
          <p className="mt-1 text-sm text-zinc-800">
            {new Date(endpoint.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Sub-sections */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/endpoints/$endpointId/targets"
          params={{ endpointId }}
          className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
        >
          <h2 className="font-semibold text-zinc-900">Delivery Targets</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Configure where to forward webhooks.
          </p>
        </Link>
        <Link
          to="/endpoints/$endpointId/rules"
          params={{ endpointId }}
          className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
        >
          <h2 className="font-semibold text-zinc-900">Filter Rules</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Define conditions to accept or drop events.
          </p>
        </Link>
      </div>

      {/* Send Test modal */}
      <Modal
        open={showSendTest}
        title="Send Test Webhook"
        onClose={() => setShowSendTest(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSendTest(false)}>
              Close
            </Button>
            <Button
              onClick={async () => {
                setTestResult(null)
                setTestError(null)
                const { data, error } = await endpointService.sendTest(
                  endpointId,
                  testForm as SendTestBody,
                )
                if (error) {
                  setTestError(
                    "message" in error
                      ? (error as { message: string }).message
                      : "Request failed",
                  )
                } else {
                  setTestResult(data ?? null)
                }
              }}
            >
              Send
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            {(["POST", "GET", "PUT", "PATCH", "DELETE"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTestForm((f) => ({ ...f, method: m }))}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  testForm.method === m
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-zinc-600 border-zinc-300 hover:border-indigo-400"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div>
            <label
              htmlFor="test-body"
              className="block text-sm font-medium text-zinc-700 mb-1"
            >
              Body
            </label>
            <textarea
              id="test-body"
              rows={6}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={testForm.body ?? "{}"}
              onChange={(e) =>
                setTestForm((f) => ({ ...f, body: e.target.value }))
              }
            />
          </div>

          {testError && <p className="text-sm text-red-600">{testError}</p>}

          {testResult && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-700">Result</span>
                {testResult.dropped ? (
                  <Badge variant="warning">Dropped</Badge>
                ) : (
                  <Badge variant="success">Delivered</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-600">
                <span className="text-zinc-500">Event ID</span>
                <code className="text-xs break-all">{testResult.eventId}</code>
                <span className="text-zinc-500">Matched Rule</span>
                <code className="text-xs break-all">
                  {testResult.matchedRuleId ?? "—"}
                </code>
                <span className="text-zinc-500">Received At</span>
                <span>{new Date(testResult.receivedAt).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={showEdit}
        title="Edit Endpoint"
        onClose={() => {
          setShowEdit(false)
          setFormError(null)
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate(form as UpdateEndpointBody)}
              loading={updateMutation.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Input
            id="edit-name"
            label="Name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            id="edit-slug"
            label="Slug"
            value={form.slug ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <Input
            id="edit-desc"
            label="Description"
            value={form.description ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <Select
            id="edit-scheme"
            label="Signing Scheme"
            options={SIGNING_SCHEMES}
            value={form.signingScheme ?? "none"}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                signingScheme: e.target
                  .value as UpdateEndpointBody["signingScheme"],
              }))
            }
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.enabled ?? true}
              onChange={(e) =>
                setForm((f) => ({ ...f, enabled: e.target.checked }))
              }
              className="rounded border-zinc-300"
            />
            Enabled
          </label>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={showDelete}
        title="Delete Endpoint"
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
          Are you sure you want to delete <strong>{endpoint.name}</strong>? This
          cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
