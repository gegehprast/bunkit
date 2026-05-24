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
import {
  type CreateTargetBody,
  type TestReceiver,
  type TestReceiverRequest,
  targetService,
  testReceiverService,
} from "../../../../lib/api-service"

export const Route = createFileRoute("/endpoints/$endpointId/targets/")({
  component: TargetsPage,
})

const SIGNING_SCHEMES = [
  { value: "none", label: "None" },
  { value: "hmac_sha256", label: "HMAC SHA-256" },
  { value: "hmac_sha1", label: "HMAC SHA-1" },
]

function TargetsPage() {
  const { endpointId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // --- regular target create state ---
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Partial<CreateTargetBody>>({
    outboundSigningScheme: "none",
    enabled: true,
    maxRetries: 3,
    retryBackoffSeconds: 60,
  })
  const [formError, setFormError] = useState<string | null>(null)

  // --- test receiver state ---
  const [showCreateTest, setShowCreateTest] = useState(false)
  const [testName, setTestName] = useState("")
  const [testFormError, setTestFormError] = useState<string | null>(null)
  const [selectedReceiver, setSelectedReceiver] = useState<TestReceiver | null>(
    null,
  )

  // --- queries ---
  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ["targets", endpointId],
    queryFn: async () => {
      const { data, error } = await targetService.list(endpointId)
      if (error) throw new Error("Failed to load targets")
      return data ?? []
    },
  })

  const { data: testReceivers, isLoading: testReceiversLoading } = useQuery({
    queryKey: ["test-receivers", endpointId],
    queryFn: async () => {
      const { data, error } = await testReceiverService.list(endpointId)
      if (error) throw new Error("Failed to load test receivers")
      return data ?? []
    },
  })

  const { data: capturedRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ["test-receiver-requests", selectedReceiver?.id],
    queryFn: async () => {
      if (!selectedReceiver) return []
      const { data, error } = await testReceiverService.listRequests(
        endpointId,
        selectedReceiver.id,
      )
      if (error) throw new Error("Failed to load captured requests")
      return data ?? []
    },
    enabled: !!selectedReceiver,
  })

  // --- mutations ---
  const createMutation = useMutation({
    mutationFn: (body: CreateTargetBody) =>
      targetService.create(endpointId, body),
    onSuccess: ({ error }) => {
      if (error) {
        setFormError(
          "message" in error
            ? (error as { message: string }).message
            : "Create failed",
        )
        return
      }
      queryClient.invalidateQueries({ queryKey: ["targets", endpointId] })
      setShowCreate(false)
      setForm({
        outboundSigningScheme: "none",
        enabled: true,
        maxRetries: 3,
        retryBackoffSeconds: 60,
      })
      setFormError(null)
    },
  })

  const createTestMutation = useMutation({
    mutationFn: (name: string) =>
      testReceiverService.create(endpointId, { name }),
    onSuccess: ({ error }) => {
      if (error) {
        setTestFormError(error.message)
        return
      }
      queryClient.invalidateQueries({
        queryKey: ["test-receivers", endpointId],
      })
      queryClient.invalidateQueries({ queryKey: ["targets", endpointId] })
      setShowCreateTest(false)
      setTestName("")
      setTestFormError(null)
    },
  })

  const deleteTestMutation = useMutation({
    mutationFn: (receiverId: string) =>
      testReceiverService.delete(endpointId, receiverId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["test-receivers", endpointId],
      })
      queryClient.invalidateQueries({ queryKey: ["targets", endpointId] })
    },
  })

  const clearRequestsMutation = useMutation({
    mutationFn: (receiverId: string) =>
      testReceiverService.clearRequests(endpointId, receiverId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["test-receiver-requests", selectedReceiver?.id],
      })
    },
  })

  // --- handlers ---
  const handleCreate = () => {
    if (!form.name || !form.url) {
      setFormError("Name and URL are required.")
      return
    }
    createMutation.mutate(form as CreateTargetBody)
  }

  const handleCreateTest = () => {
    if (!testName.trim()) {
      setTestFormError("Name is required.")
      return
    }
    createTestMutation.mutate(testName.trim())
  }

  // Filter out test targets from the regular list
  const regularTargets = (targets ?? []).filter(
    (t) => !(t as typeof t & { isTest?: boolean }).isTest,
  )

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
        <span className="font-medium text-zinc-700">Targets</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Delivery Targets</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowCreateTest(true)}>
            + Test Target
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ New Target</Button>
        </div>
      </div>

      {targetsLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table
          keyField="id"
          data={regularTargets}
          emptyMessage="No delivery targets yet."
          onRowClick={(t) =>
            navigate({
              to: "/endpoints/$endpointId/targets/$targetId/edit",
              params: { endpointId, targetId: t.id },
            })
          }
          columns={[
            {
              key: "name",
              header: "Name",
              render: (t) => <span className="font-medium">{t.name}</span>,
            },
            {
              key: "url",
              header: "URL",
              render: (t) => <code className="text-xs">{t.url}</code>,
            },
            { key: "maxRetries", header: "Retries" },
            {
              key: "outboundSigningScheme",
              header: "Signing",
              render: (t) => <Badge>{t.outboundSigningScheme}</Badge>,
            },
            {
              key: "enabled",
              header: "Status",
              render: (t) => (
                <Badge variant={t.enabled ? "success" : "warning"}>
                  {t.enabled ? "Active" : "Disabled"}
                </Badge>
              ),
            },
          ]}
        />
      )}

      {/* Test Receivers section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-800">Test Receivers</h2>
        <p className="text-sm text-zinc-500">
          Test receivers capture incoming webhook deliveries so you can inspect
          the exact payloads the gateway sends.
        </p>

        {testReceiversLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (testReceivers ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400 py-4">
            No test receivers yet. Click "+ Test Target" to create one.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(testReceivers ?? []).map((receiver) => (
              <div
                key={receiver.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 flex items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-medium text-zinc-900">
                    {receiver.name}
                  </span>
                  <code className="text-xs text-zinc-500 truncate">
                    {receiver.url}
                  </code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedReceiver(receiver)}
                  >
                    View Requests
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => deleteTestMutation.mutate(receiver.id)}
                    loading={deleteTestMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create regular target modal */}
      <Modal
        open={showCreate}
        title="New Delivery Target"
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
            id="t-name"
            label="Name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            id="t-url"
            label="URL"
            type="url"
            placeholder="https://example.com/webhook"
            value={form.url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="t-retries"
              label="Max Retries"
              type="number"
              min={0}
              max={10}
              value={form.maxRetries ?? 3}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxRetries: Number(e.target.value) }))
              }
            />
            <Input
              id="t-backoff"
              label="Backoff (s)"
              type="number"
              min={1}
              value={form.retryBackoffSeconds ?? 60}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  retryBackoffSeconds: Number(e.target.value),
                }))
              }
            />
          </div>
          <Select
            id="t-scheme"
            label="Outbound Signing"
            options={SIGNING_SCHEMES}
            value={form.outboundSigningScheme ?? "none"}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                outboundSigningScheme: e.target
                  .value as CreateTargetBody["outboundSigningScheme"],
              }))
            }
          />
        </div>
      </Modal>

      {/* Create test receiver modal */}
      <Modal
        open={showCreateTest}
        title="Create Test Receiver"
        onClose={() => {
          setShowCreateTest(false)
          setTestFormError(null)
          setTestName("")
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowCreateTest(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTest}
              loading={createTestMutation.isPending}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {testFormError && (
            <p className="text-sm text-red-600">{testFormError}</p>
          )}
          <p className="text-sm text-zinc-500">
            A test receiver creates an in-app capture endpoint. The gateway will
            POST delivered webhooks to it, letting you inspect the exact headers
            and body.
          </p>
          <Input
            id="tr-name"
            label="Name"
            placeholder="e.g. Local debug capture"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
          />
        </div>
      </Modal>

      {/* Captured requests modal */}
      <Modal
        open={!!selectedReceiver}
        title={`Captured Requests — ${selectedReceiver?.name ?? ""}`}
        onClose={() => setSelectedReceiver(null)}
        footer={
          <>
            <Button
              variant="danger"
              onClick={() =>
                selectedReceiver &&
                clearRequestsMutation.mutate(selectedReceiver.id)
              }
              loading={clearRequestsMutation.isPending}
            >
              Clear All
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelectedReceiver(null)}
            >
              Close
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          {requestsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (capturedRequests ?? []).length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">
              No requests captured yet.
            </p>
          ) : (
            (capturedRequests ?? []).map((req) => (
              <CapturedRequestCard key={req.id} request={req} />
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}

function CapturedRequestCard({ request }: { request: TestReceiverRequest }) {
  const [expanded, setExpanded] = useState(false)
  const receivedAt = new Date(request.receivedAt).toLocaleString()

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex flex-col gap-2">
      <button
        type="button"
        className="flex items-center justify-between w-full cursor-pointer text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Badge>{request.method}</Badge>
          <span className="text-xs text-zinc-500">{receivedAt}</span>
        </div>
        <span className="text-xs text-zinc-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 mt-1">
          <div>
            <p className="text-xs font-semibold text-zinc-600 mb-1">Headers</p>
            <pre className="text-xs bg-white border border-zinc-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(request.headers, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-600 mb-1">Body</p>
            <pre className="text-xs bg-white border border-zinc-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {request.body || "(empty)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
