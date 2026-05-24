import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Spinner } from "../../components/ui/Spinner"
import { Table } from "../../components/ui/Table"
import { apiKeyService, type CreateApiKeyBody } from "../../lib/api-service"

export const Route = createFileRoute("/keys/")({
  component: KeysPage,
})

function KeysPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showKey, setShowKey] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<CreateApiKeyBody>>({ isAdmin: false })
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await apiKeyService.list()
      if (error) throw new Error("Failed to load API keys")
      return data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateApiKeyBody) => apiKeyService.create(body),
    onSuccess: ({ data, error }) => {
      if (error) {
        setFormError(
          "message" in error
            ? (error as { message: string }).message
            : "Create failed",
        )
        return
      }
      queryClient.invalidateQueries({ queryKey: ["api-keys"] })
      setShowCreate(false)
      setForm({})
      setFormError(null)
      if (data?.key) setShowKey(data.key)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiKeyService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] })
      setDeleteId(null)
    },
  })

  const handleCreate = () => {
    if (!form.name) {
      setFormError("Name is required.")
      return
    }
    createMutation.mutate(form as CreateApiKeyBody)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">API Keys</h1>
        <Button onClick={() => setShowCreate(true)}>+ New Key</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table
          keyField="id"
          data={keys ?? []}
          emptyMessage="No API keys. Create one to authenticate API requests."
          columns={[
            {
              key: "isAdmin",
              header: "Type",
              render: (k) => (
                <Badge variant={k.isAdmin ? "warning" : "default"}>
                  {k.isAdmin ? "Admin" : "API Key"}
                </Badge>
              ),
            },
            {
              key: "name",
              header: "Name",
              render: (k) => <span className="font-medium">{k.name}</span>,
            },
            {
              key: "keyPrefix",
              header: "Key",
              render: (k) => <code className="text-xs">{k.keyPrefix}…</code>,
            },
            {
              key: "createdBy",
              header: "Created By",
              render: (k) => k.createdBy ?? "—",
            },
            {
              key: "expiresAt",
              header: "Expires",
              render: (k) =>
                k.expiresAt ? (
                  new Date(k.expiresAt).toLocaleDateString()
                ) : (
                  <Badge variant="success">Never</Badge>
                ),
            },
            {
              key: "lastUsedAt",
              header: "Last Used",
              render: (k) =>
                k.lastUsedAt
                  ? new Date(k.lastUsedAt).toLocaleString()
                  : "Never",
            },
            {
              key: "enabled",
              header: "Status",
              render: (k) => (
                <Badge variant={k.enabled ? "success" : "warning"}>
                  {k.enabled ? "Active" : "Disabled"}
                </Badge>
              ),
            },
            {
              key: "delete",
              header: "",
              render: (k) => (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteId(k.id)
                  }}
                >
                  Revoke
                </Button>
              ),
            },
          ]}
        />
      )}

      {/* Create modal */}
      <Modal
        open={showCreate}
        title="New API Key"
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
            id="k-name"
            label="Name"
            placeholder="My integration"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            id="k-created-by"
            label="Created By (optional)"
            value={form.createdBy ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, createdBy: e.target.value || undefined }))
            }
          />
          <Input
            id="k-expires"
            label="Expires At (optional)"
            type="datetime-local"
            value={form.expiresAt ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, expiresAt: e.target.value || undefined }))
            }
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.isAdmin ?? false}
              onChange={(e) =>
                setForm((f) => ({ ...f, isAdmin: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
            Admin key (can log into dashboard &amp; manage keys)
          </label>
        </div>
      </Modal>

      {/* Show key modal */}
      <Modal
        open={showKey !== null}
        title="API Key Created"
        onClose={() => setShowKey(null)}
        footer={<Button onClick={() => setShowKey(null)}>Done</Button>}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600">
            Copy your API key now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <code className="flex-1 break-all text-sm text-zinc-900">
              {showKey}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard.writeText(showKey ?? "")}
            >
              Copy
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={deleteId !== null}
        title="Revoke API Key"
        onClose={() => setDeleteId(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              loading={deleteMutation.isPending}
            >
              Revoke
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          This will permanently revoke the API key and any requests using it
          will fail immediately.
        </p>
      </Modal>
    </div>
  )
}
