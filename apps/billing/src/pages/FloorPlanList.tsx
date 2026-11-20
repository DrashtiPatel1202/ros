import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ApiError, api } from "../api"

type Row = { id: number; name: string; active: boolean; createdAt: string }

function formatCreatedAt(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  })
  return date.replace(",", "")
}

export function FloorPlanList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameName, setRenameName] = useState("")

  async function load() {
    const data = await api.floorPlans()
    setRows(data.rows)
  }

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load floor plans"))
  }, [])

  return (
    <div className="page-pad floor-plan-wrapper billing-inner-pages-design-wrap">
      <nav className="breadcrumb-pp" aria-label="breadcrumb">
        <Link to="/users/res_new/1">Configuration</Link> › <span>Outlet</span> ›{" "}
        <Link to="/users/res_new/1">Restaurant Configuration</Link> › Floor Plan
      </nav>
      <div className="fp-list-head">
        <h1 className="page-title mb-0">Floor Plan</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setCreating(true)
            setNewName("")
          }}
        >
          Create Floor Plan
        </button>
      </div>
      {error && <p className="text-danger">{error}</p>}
      {creating && (
        <form
          className="fp-list-create card-pp"
          onSubmit={(e) => {
            e.preventDefault()
            const name = newName.trim()
            if (!name) return
            void api
              .addFloorPlan(name)
              .then((row) => {
                setCreating(false)
                return load().then(() => navigate(`/users/floor_plan/design/${row.id}`))
              })
              .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not create"))
          }}
        >
          <label className="form-label">Floor plan name</label>
          <div className="d-flex gap-2 flex-wrap">
            <input
              className="form-control"
              style={{ maxWidth: 320 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ground floor, Rooftop…"
              autoFocus
              required
            />
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="card-pp fp-list-card">
        <table className="table table-hover mb-0 fp-list-table">
          <thead>
            <tr>
              <th>Floor Plan Name</th>
              <th>Created On</th>
              <th>Active/Inactive</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {renameId === row.id ? (
                    <form
                      className="d-flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const name = renameName.trim()
                        if (!name) return
                        void api
                          .updateFloorPlan(row.id, { name })
                          .then(() => {
                            setRenameId(null)
                            return load()
                          })
                          .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not rename"))
                      }}
                    >
                      <input
                        className="form-control form-control-sm"
                        value={renameName}
                        onChange={(e) => setRenameName(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn btn-sm btn-primary">
                        OK
                      </button>
                      <button type="button" className="btn btn-sm btn-link" onClick={() => setRenameId(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button type="button" className="btn btn-link p-0 fp-list-name" onClick={() => navigate(`/users/floor_plan/design/${row.id}`)}>
                      {row.name}
                    </button>
                  )}
                </td>
                <td>{formatCreatedAt(row.createdAt)}</td>
                <td>
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      checked={row.active}
                      onChange={() =>
                        void api
                          .updateFloorPlan(row.id, { active: !row.active })
                          .then(load)
                          .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not update"))
                      }
                    />
                  </div>
                </td>
                <td className="text-end fp-list-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title="Rename"
                    onClick={() => {
                      setRenameId(row.id)
                      setRenameName(row.name)
                    }}
                  >
                    <i className="bi bi-pencil" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title="Design layout"
                    onClick={() => navigate(`/users/floor_plan/design/${row.id}`)}
                  >
                    <i className="bi bi-grid-3x3-gap" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    title="Delete"
                    onClick={() => {
                      if (!window.confirm(`Delete floor plan “${row.name}”?`)) return
                      void api
                        .deleteFloorPlan(row.id)
                        .then(load)
                        .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not delete"))
                    }}
                  >
                    <i className="bi bi-trash" />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="text-muted text-center py-4">
                  No floor plans yet. Click <strong>Create Floor Plan</strong>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}