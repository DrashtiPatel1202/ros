import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ApiError, api, type TableShape } from "../api"

type TableDraft = {
  id: number
  area: string
  tableNo: string
  seats: number
  x: number
  y: number
  width: number
  height: number
  shape: TableShape
  textSize: number
  placed: boolean
}

type BarrierDraft = { key: string; x: number; y: number; width: number; height: number }

const SHAPES: { id: TableShape; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
  { id: "diamond", label: "Diamond" },
  { id: "arch", label: "Arch" },
  { id: "rect", label: "Rectangle" },
  { id: "oval", label: "Oval" },
]

function snap(value: number) {
  return Math.max(0, Math.round(value / 8) * 8)
}

function byTable(a: TableDraft, b: TableDraft) {
  return a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true })
}

export function FloorPlan() {
  const [tables, setTables] = useState<TableDraft[]>([])
  const [barriers, setBarriers] = useState<BarrierDraft[]>([])
  const [selected, setSelected] = useState<{ kind: "table" | "barrier"; id: string } | null>(null)
  const [preview, setPreview] = useState(false)
  const [areaName, setAreaName] = useState("AC")
  const [tableNo, setTableNo] = useState("")
  const [seats, setSeats] = useState("4")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  async function load() {
    const data = await api.floorPlan()
    setTables(
      data.tables.map((table) => ({
        ...table,
        shape: SHAPES.some((shape) => shape.id === table.shape) ? table.shape : "square",
      })),
    )
    setBarriers(data.barriers.map((barrier) => ({ ...barrier, key: String(barrier.id) })))
    setSaved(false)
  }

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the floor"))
  }, [])

  const areas = [...new Set(tables.map((table) => table.area))]
  const current = selected?.kind === "table" ? tables.find((table) => String(table.id) === selected.id) : null
  const currentBarrier = selected?.kind === "barrier" ? barriers.find((barrier) => barrier.key === selected.id) : null

  function patchTable(id: number, patch: Partial<TableDraft>) {
    setTables((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    setSaved(false)
  }

  function patchBarrier(key: string, patch: Partial<BarrierDraft>) {
    setBarriers((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
    setSaved(false)
  }

  function place(table: TableDraft) {
    setSelected({ kind: "table", id: String(table.id) })
    if (table.placed) return
    const placed = tables.filter((row) => row.placed).length
    patchTable(table.id, {
      placed: true,
      x: 48 + (placed % 8) * 96,
      y: 48 + Math.floor(placed / 8) * 96,
    })
  }

  function drag(event: React.PointerEvent, apply: (x: number, y: number) => void, originX: number, originY: number) {
    if (preview) return
    const startX = event.clientX
    const startY = event.clientY
    function move(ev: PointerEvent) {
      apply(snap(originX + ev.clientX - startX), snap(originY + ev.clientY - startY))
    }
    function up() {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  function nudgeSize(field: "width" | "height", delta: number) {
    if (current) patchTable(current.id, { [field]: Math.min(400, Math.max(40, current[field] + delta)) })
    if (currentBarrier) patchBarrier(currentBarrier.key, { [field]: Math.min(800, Math.max(8, currentBarrier[field] + delta)) })
  }

  return (
    <div className="page-pad floor-designer">
      <div className="fp-top">
        <div>
          <div className="breadcrumb-pp">
            <Link to="/users/res_new/1">Configuration</Link> › Floor Plan
          </div>
          <h1 className="page-title">Floor Plan</h1>
        </div>
        <div className="fp-actions">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setPreview((value) => !value)}>
            {preview ? "Edit" : "Preview"}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => void load()}>
            Discard
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setError("")
              void api
                .saveFloor({
                  tables: tables.map((table) => ({
                    id: table.id,
                    x: table.x,
                    y: table.y,
                    width: table.width,
                    height: table.height,
                    shape: table.shape,
                    textSize: table.textSize,
                    placed: table.placed,
                  })),
                  barriers: barriers.map((barrier) => ({
                    x: barrier.x,
                    y: barrier.y,
                    width: barrier.width,
                    height: barrier.height,
                  })),
                })
                .then(() => setSaved(true))
                .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not save"))
            }}
          >
            Save Floor Plan
          </button>
          <Link className="btn btn-outline-secondary" to="/users/res_new/1">
            ‹ Back
          </Link>
        </div>
      </div>
      {error && <p className="text-danger">{error}</p>}
      {saved && <p className="text-success">Floor plan saved. Table Management uses this layout.</p>}
      <div className="fp-body">
        <aside className="fp-palette">
          <form
            className="fp-add"
            onSubmit={(e) => {
              e.preventDefault()
              void api
                .saveTable({ area: areaName, tableNo, seats: Number(seats) || 4 })
                .then(() => {
                  setTableNo("")
                  return load()
                })
                .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not add the table"))
            }}
          >
            <input className="form-control form-control-sm" value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="Area" />
            <input className="form-control form-control-sm" value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="Table" required />
            <input className="form-control form-control-sm" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="Seats" />
            <button className="btn btn-sm btn-primary" type="submit">Add</button>
          </form>
          {areas.map((area) => (
            <div key={area} className="fp-area">
              <h2>{area}</h2>
              <div className="fp-chips">
                {tables.filter((table) => table.area === area).sort(byTable).map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    className={`fp-chip ${table.placed ? "placed" : ""} ${selected?.kind === "table" && selected.id === String(table.id) ? "on" : ""}`}
                    onClick={() => place(table)}
                  >
                    {table.tableNo}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
        <div className={`fp-canvas ${preview ? "preview" : ""}`} ref={canvasRef}>
          {tables.filter((table) => table.placed).map((table) => (
            <button
              key={table.id}
              type="button"
              className={`fp-shape ${table.shape} ${selected?.kind === "table" && selected.id === String(table.id) ? "on" : ""}`}
              style={{
                left: table.x,
                top: table.y,
                width: table.width,
                height: table.height,
                fontSize: table.textSize,
              }}
              onPointerDown={(event) => {
                setSelected({ kind: "table", id: String(table.id) })
                drag(event, (x, y) => patchTable(table.id, { x, y }), table.x, table.y)
              }}
            >
              <span>{table.tableNo}</span>
            </button>
          ))}
          {barriers.map((barrier) => (
            <button
              key={barrier.key}
              type="button"
              className={`fp-barrier ${selected?.kind === "barrier" && selected.id === barrier.key ? "on" : ""}`}
              style={{ left: barrier.x, top: barrier.y, width: barrier.width, height: barrier.height }}
              onPointerDown={(event) => {
                setSelected({ kind: "barrier", id: barrier.key })
                drag(event, (x, y) => patchBarrier(barrier.key, { x, y }), barrier.x, barrier.y)
              }}
            />
          ))}
        </div>
      </div>
      {!preview && (
        <div className="fp-tools">
          <label>
            Height
            <span>
              <button type="button" onClick={() => nudgeSize("height", -8)}>−</button>
              {current?.height ?? currentBarrier?.height ?? "—"}
              <button type="button" onClick={() => nudgeSize("height", 8)}>+</button>
            </span>
          </label>
          <label>
            Width
            <span>
              <button type="button" onClick={() => nudgeSize("width", -8)}>−</button>
              {current?.width ?? currentBarrier?.width ?? "—"}
              <button type="button" onClick={() => nudgeSize("width", 8)}>+</button>
            </span>
          </label>
          <label>
            Text Size
            <span>
              <button type="button" disabled={!current} onClick={() => current && patchTable(current.id, { textSize: Math.max(10, current.textSize - 1) })}>−</button>
              {current?.textSize ?? "—"}
              <button type="button" disabled={!current} onClick={() => current && patchTable(current.id, { textSize: Math.min(32, current.textSize + 1) })}>+</button>
            </span>
          </label>
          <div className="fp-shapes" aria-label="Shape">
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                title={shape.label}
                className={`fp-shape-btn ${shape.id} ${current?.shape === shape.id ? "on" : ""}`}
                disabled={!current}
                onClick={() => current && patchTable(current.id, { shape: shape.id })}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              const key = `new-${Date.now()}`
              setBarriers((rows) => [...rows, { key, x: 80, y: 80, width: 16, height: 140 }])
              setSelected({ kind: "barrier", id: key })
              setSaved(false)
            }}
          >
            Barrier
          </button>
          <button
            type="button"
            className="btn btn-outline-danger"
            disabled={!selected}
            onClick={() => {
              if (selected?.kind === "table") patchTable(Number(selected.id), { placed: false })
              if (selected?.kind === "barrier") setBarriers((rows) => rows.filter((row) => row.key !== selected.id))
              setSelected(null)
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
