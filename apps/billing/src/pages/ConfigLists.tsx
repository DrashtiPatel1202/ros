import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ApiError, api, formatInr } from "../api"

function Shell({ title, crumb, children }: { title: string; crumb: string; children: React.ReactNode }) {
  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">
        <Link to="/users/res_new/1">Configuration</Link> › {crumb}
      </div>
      <h1 className="page-title">{title}</h1>
      <div className="card-pp">{children}</div>
    </div>
  )
}

export function SubOrderTypes() {
  const [rows, setRows] = useState<{ id: number; name: string; active: boolean }[]>([])
  const [name, setName] = useState("")
  const [error, setError] = useState("")

  async function load() {
    const data = await api.subOrderTypes()
    setRows(data.rows)
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [])

  return (
    <Shell title="Sub Order Type" crumb="Sub Order Type">
      {error && <p className="text-danger">{error}</p>}
      <form
        className="d-flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void api
            .addSubOrderType(name)
            .then(() => {
              setName("")
              return load()
            })
            .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not add"))
        }}
      >
        <input className="form-control" placeholder="Name (AC, Non AC, Family…)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
      <table className="table mb-0">
        <thead><tr><th>Name</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.active ? "Active" : "Inactive"}</td>
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-link" onClick={() => void api.toggleSubOrderType(row.id, !row.active).then(load)}>
                  {row.active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => void api.deleteSubOrderType(row.id).then(load)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  )
}

export function DeliveryDistances() {
  const [rows, setRows] = useState<{ id: number; fromKm: number; toKm: number; chargePaise: number }[]>([])
  const [fromKm, setFromKm] = useState("0")
  const [toKm, setToKm] = useState("3")
  const [charge, setCharge] = useState("40")
  const [error, setError] = useState("")
  async function load() {
    setRows((await api.deliveryDistances()).rows)
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [])
  return (
    <Shell title="Delivery Distance" crumb="Delivery Distance">
      {error && <p className="text-danger">{error}</p>}
      <form
        className="row g-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void api
            .addDeliveryDistance({ fromKm: Number(fromKm), toKm: Number(toKm), chargePaise: Math.round(Number(charge) * 100) })
            .then(load)
            .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not add"))
        }}
      >
        <div className="col"><input className="form-control" value={fromKm} onChange={(e) => setFromKm(e.target.value)} placeholder="From km" /></div>
        <div className="col"><input className="form-control" value={toKm} onChange={(e) => setToKm(e.target.value)} placeholder="To km" /></div>
        <div className="col"><input className="form-control" value={charge} onChange={(e) => setCharge(e.target.value)} placeholder="Charge ₹" /></div>
        <div className="col-auto"><button className="btn btn-primary" type="submit">Add slab</button></div>
      </form>
      <table className="table mb-0">
        <thead><tr><th>From</th><th>To</th><th>Charge</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.fromKm} km</td>
              <td>{row.toKm} km</td>
              <td>{formatInr(row.chargePaise)}</td>
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => void api.deleteDeliveryDistance(row.id).then(load)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  )
}

export function AreaCharges() {
  const [rows, setRows] = useState<{ id: number; areaName: string; chargePaise: number; active: boolean }[]>([])
  const [area, setArea] = useState("")
  const [charge, setCharge] = useState("30")
  const [error, setError] = useState("")
  async function load() {
    setRows((await api.areaCharges()).rows)
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [])
  return (
    <Shell title="Area / Locality Delivery Charges" crumb="Area charges">
      {error && <p className="text-danger">{error}</p>}
      <form
        className="d-flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void api
            .addAreaCharge(area, Math.round(Number(charge) * 100))
            .then(() => {
              setArea("")
              return load()
            })
            .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not add"))
        }}
      >
        <input className="form-control" placeholder="Area or locality" value={area} onChange={(e) => setArea(e.target.value)} />
        <input className="form-control" style={{ maxWidth: 120 }} value={charge} onChange={(e) => setCharge(e.target.value)} />
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
      <table className="table mb-0">
        <thead><tr><th>Area</th><th>Charge</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.areaName}</td>
              <td>{formatInr(row.chargePaise)}</td>
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => void api.deleteAreaCharge(row.id).then(load)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  )
}

