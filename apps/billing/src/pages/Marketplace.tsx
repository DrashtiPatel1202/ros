import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { api } from "../api"
import { errText, MgmtShell } from "./mgmtUi"

type Service = Awaited<ReturnType<typeof api.services>>["rows"][number]

export function MarketplacePage() {
  const { pathname } = useLocation()
  const settings = pathname.endsWith("/settings")
  const [rows, setRows] = useState<Service[]>([])
  const [error, setError] = useState("")

  async function load() {
    setRows((await api.services()).rows)
  }
  useEffect(() => {
    void load().catch((caught) => setError(errText(caught, "Could not load marketplace")))
  }, [])

  const visible = settings ? rows.filter((row) => row.enabled || row.storeId) : rows
  const groups = [...new Set(visible.map((row) => row.category))]

  return (
    <MgmtShell crumb={settings ? "Explore Products › Marketplace Setting" : "Explore Products › Marketplace"} title={settings ? "Marketplace Setting" : "Marketplace"}>
      {error && <p className="text-danger">{error}</p>}
      {settings && visible.length === 0 && <p className="text-muted">No service is enabled yet. Turn one on from Marketplace.</p>}
      {groups.map((group) => (
        <div key={group} className="mb-3">
          <h2 className="h6 text-muted">{group}</h2>
          <div className="row g-3">
            {visible.filter((row) => row.category === group).map((row) => (
              <div className="col-md-6 col-xl-4" key={row.id}>
                <ServiceCard row={row} onChanged={load} onError={setError} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </MgmtShell>
  )
}

function ServiceCard({ row, onChanged, onError }: { row: Service; onChanged: () => Promise<void>; onError: (value: string) => void }) {
  const [storeId, setStoreId] = useState(row.storeId)
  return (
    <div className="card-pp h-100">
      <div className="d-flex justify-content-between">
        <strong>{row.name}</strong>
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => void api.saveService(row.id, { enabled: e.target.checked, storeId }).then(onChanged).catch((caught) => onError(errText(caught, "Could not update")))}
          />
        </div>
      </div>
      <p className="text-muted mb-2">{row.blurb}</p>
      <form
        className="d-flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void api.saveService(row.id, { enabled: row.enabled, storeId }).then(onChanged).catch((caught) => onError(errText(caught, "Could not save")))
        }}
      >
        <input className="form-control form-control-sm" placeholder="Store / merchant id" value={storeId} onChange={(e) => setStoreId(e.target.value)} />
        <button className="btn btn-sm btn-outline-primary" type="submit">Save</button>
      </form>
    </div>
  )
}
