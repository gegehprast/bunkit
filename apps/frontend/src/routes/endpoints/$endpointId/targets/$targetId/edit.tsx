import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Badge } from "../../../../../components/ui/Badge"
import { Button } from "../../../../../components/ui/Button"
import { Input } from "../../../../../components/ui/Input"
import { Modal } from "../../../../../components/ui/Modal"
import { Select } from "../../../../../components/ui/Select"
import { Spinner } from "../../../../../components/ui/Spinner"
import {
  targetService,
  type UpdateTargetBody,
} from "../../../../../lib/api-service"

export const Route = createFileRoute(
  "/endpoints/$endpointId/targets/$targetId/edit",
)({
  component: EditTargetPage,
})

const SIGNING_SCHEMES = [
  { value: "none", label: "None" },
  { value: "hmac_sha256", label: "HMAC SHA-256" },
  { value: "hmac_sha1", label: "HMAC SHA-1" },
]

function EditTargetPage() {
  const { endpointId, targetId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Partial<UpdateTargetBody>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  const { data: target, isLoading } = useQuery({
    queryKey: ["target", endpointId, targetId],
    queryFn: async () => {
      const { data, error } = await targetService.get(endpointId, targetId)
      if (error) throw new Error("Failed to load target")
      return data
    },
  })

  useEffect(() => {
    if (target) {
      setForm({
        name: target.name,
        url: target.url,
        maxRetries: target.maxRetries,
        retryBackoffSeconds: target.retryBackoffSeconds,
        outboundSigningScheme: target.outboundSigningScheme,
        enabled: target.enabled,
      })
    }
  }, [target])

  const updateMutation = useMutation({
    mutationFn: (body: UpdateTargetBody) =>
      targetService.update(endpointId, targetId, body),
    onSuccess: ({ error }) => {
      if (error) {
        setFormError(
          "message" in error
            ? (error as { message: string }).message
            : "Update failed",
        )
        return
      }
      queryClient.invalidateQueries({ queryKey: ["targets", endpointId] })
      navigate({ to: "/endpoints/$endpointId/targets", params: { endpointId } })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => targetService.delete(endpointId, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets", endpointId] })
      navigate({ to: "/endpoints/$endpointId/targets", params: { endpointId } })
    },
  })

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  if (!target) return <p className="text-zinc-500">Target not found.</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/endpoints" className="text-zinc-400 hover:text-zinc-600">
          Endpoints
        </Link>
        <span className="text-zinc-300">/</span>
        <Link
          to="/endpoints/$endpointId/targets"
          params={{ endpointId }}
          className="text-zinc-400 hover:text-zinc-600"
        >
          Targets
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="font-medium text-zinc-700">{target.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">{target.name}</h1>
          <Badge variant={target.enabled ? "success" : "warning"}>
            {target.enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
        <Button variant="danger" onClick={() => setShowDelete(true)}>
          Delete
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-4 max-w-lg">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Input
            id="et-name"
            label="Name"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            id="et-url"
            label="URL"
            type="url"
            value={form.url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="et-retries"
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
              id="et-backoff"
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
            id="et-scheme"
            label="Outbound Signing"
            options={SIGNING_SCHEMES}
            value={form.outboundSigningScheme ?? "none"}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                outboundSigningScheme: e.target
                  .value as UpdateTargetBody["outboundSigningScheme"],
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
              className="rounded"
            />
            Enabled
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() =>
                navigate({
                  to: "/endpoints/$endpointId/targets",
                  params: { endpointId },
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate(form as UpdateTargetBody)}
              loading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={showDelete}
        title="Delete Target"
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
          Delete target <strong>{target.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
