import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Select } from "../../components/ui/Select"
import { Spinner } from "../../components/ui/Spinner"
import { Table } from "../../components/ui/Table"
import { type CreateEndpointBody, endpointService } from "../../lib/api-service"

export const Route = createFileRoute("/endpoints/")({
  component: EndpointsPage,
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

function EndpointsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Partial<CreateEndpointBody>>({
    signingScheme: "none",
    enabled: true,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const { data: endpoints, isLoading } = useQuery({
    queryKey: ["endpoints"],
    queryFn: async () => {
      const { data, error } = await endpointService.list()
      if (error) throw new Error("Failed to load endpoints")
      return data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateEndpointBody) => endpointService.create(body),
    onSuccess: ({ error }) => {
      if (error) {
        setFormError(
          "message" in error
            ? (error as { message: string }).message
            : "Create failed",
        )
        return
      }
      queryClient.invalidateQueries({ queryKey: ["endpoints"] })
      setShowCreate(false)
      setForm({ signingScheme: "none", enabled: true })
      setFormError(null)
    },
  })

  const handleCreate = () => {
    if (!form.name || !form.slug) {
      setFormError("Name and slug are required.")
      return
    }
    createMutation.mutate(form as CreateEndpointBody)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Endpoints</h1>
        <Button onClick={() => setShowCreate(true)}>+ New Endpoint</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table
          keyField="id"
          data={endpoints ?? []}
          emptyMessage="No endpoints yet. Create one to start receiving webhooks."
          onRowClick={(ep) =>
            navigate({
              to: "/endpoints/$endpointId",
              params: { endpointId: ep.id },
            })
          }
          columns={[
            {
              key: "name",
              header: "Name",
              render: (ep) => (
                <span className="font-medium text-zinc-900">{ep.name}</span>
              ),
            },
            {
              key: "slug",
              header: "Slug",
              render: (ep) => (
                <code className="text-xs bg-zinc-100 px-1 py-0.5 rounded">
                  /hooks/{ep.slug}
                </code>
              ),
            },
            {
              key: "signingScheme",
              header: "Signing",
              render: (ep) => <Badge>{ep.signingScheme}</Badge>,
            },
            {
              key: "enabled",
              header: "Status",
              render: (ep) => (
                <Badge variant={ep.enabled ? "success" : "warning"}>
                  {ep.enabled ? "Active" : "Disabled"}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (ep) => (
                <Link
                  to="/endpoints/$endpointId"
                  params={{ endpointId: ep.id }}
                  className="text-sm text-indigo-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Manage →
                </Link>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={showCreate}
        title="New Endpoint"
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
            id="name"
            label="Name"
            placeholder="My Webhook"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            id="slug"
            label="Slug"
            placeholder="my-webhook"
            value={form.slug ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <Input
            id="description"
            label="Description (optional)"
            value={form.description ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <Select
            id="signingScheme"
            label="Signing Scheme"
            options={SIGNING_SCHEMES}
            value={form.signingScheme ?? "none"}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                signingScheme: e.target
                  .value as CreateEndpointBody["signingScheme"],
              }))
            }
          />
        </div>
      </Modal>
    </div>
  )
}
