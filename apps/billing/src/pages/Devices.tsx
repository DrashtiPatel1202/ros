import { useEffect, useState } from "react"
import { api } from "../api"
import { errText, MgmtShell, when } from "./mgmtUi"

const KINDS = [
  { id: "billing", label: "Billing terminal" },
  { id: "feedback", label: "Feedback App" },
  { id: "scan_qr", label: "Scan & QR" },
  { id: "android_pos", label: "Android POS" },
  { id: "kds", label: "Kitchen Display" },
  { id: "captain", label: "Captain" },
]

export function DevicesPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.devices>>["rows"]>([])
  const [name, setName] = useState("Counter 1")
  const [kind, setKind] = useState("billing")
  const [password, setPassword] = useState("")
  const [pairCode, setPairCode] = useState("")
  const [issued, setIssued] = useState("")
  const [error, setError] = useState("")

  async function load() {
    setRows((await api.devices()).rows)
  }
  useEffect(() => {
    void load().catch((caught) => setError(errText(caught, "Could not load devices")))
  }, [])

  return (
    <MgmtShell crumb="Device Mapping" title="Device Mapping">
      {error && <p className="text-danger">{error}</p>}
      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <div className="card-pp h-100">
            <h2 className="h6">Get a sync code</h2>
            <p className="text-muted">Confirm your login password. Type this code on the terminal to pair it with this outlet.</p>
            <form
              className="row g-2"
              onSubmit={(e) => {
                e.preventDefault()
                void api
                  .syncCode({ password, name, kind })
                  .then((result) => {
                    setIssued(result.mappingCode)
                    setPassword("")
                    return load()
                  })
                  .catch((caught) => setError(errText(caught, "Could not issue a code")))
              }}
            >
              <div className="col-md-5"><input className="form-control" placeholder="Terminal name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="col-md-4">
                <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {KINDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
              <div className="col-md-8"><input className="form-control" type="password" placeholder="Login password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              <div className="col-md-4"><button className="btn btn-primary w-100" type="submit">Get Code</button></div>
            </form>
            {issued && <div className="alert alert-success mt-3 mb-0">Sync code: <strong>{issued}</strong></div>}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card-pp h-100">
            <h2 className="h6">Map a device</h2>
            <p className="text-muted">Enter the mapping code shown on Feedback App, Scan & QR, or Android POS.</p>
            <form
              className="d-flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void api
                  .pairDevice({ code: pairCode })
                  .then(() => {
                    setPairCode("")
                    return load()
                  })
                  .catch((caught) => setError(errText(caught, "Could not map the device")))
              }}
            >
              <input className="form-control" placeholder="Mapping code" value={pairCode} onChange={(e) => setPairCode(e.target.value)} required />
              <button className="btn btn-primary" type="submit">Map Device</button>
            </form>
          </div>
        </div>
      </div>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Terminal</th><th>Kind</th><th>Code</th><th>Last seen</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-muted">No terminals mapped to this outlet.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{KINDS.find((item) => item.id === row.kind)?.label ?? row.kind}</td>
                <td><code>{row.mappingCode}</code></td>
                <td>{when(row.lastSeenAt)}</td>
                <td>{row.active ? "Active" : "Inactive"}</td>
                <td className="text-end">
                  <button type="button" className="btn btn-sm btn-link" onClick={() => void api.setDeviceActive(row.id, !row.active).then(load)}>
                    {row.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

const APPS = {
  Windows: ["Restaurant POS", "Printer Application", "Restaurant POS Local"],
  Linux: ["Restaurant POS", "Printer Application", "Restaurant POS Local"],
  Mac: ["Restaurant POS", "Printer Application"],
  Android: ["Restaurant Merchant", "Online Order Acceptance", "Captain Ordering", "Token Management", "Inventory", "Feedback Management", "Kitchen Display System", "MFR Scanner", "Reservations Manager", "Digital Display"],
  iPhone: ["Restaurant Merchant", "Captain Ordering", "Feedback Management"],
}

export function AppsPage() {
  const [platform, setPlatform] = useState<keyof typeof APPS>("Windows")
  return (
    <MgmtShell crumb="Apps" title="Apps">
      <div className="inv-subnav mb-3">
        {(Object.keys(APPS) as (keyof typeof APPS)[]).map((item) => (
          <button key={item} type="button" className={item === platform ? "on" : ""} onClick={() => setPlatform(item)}>{item}</button>
        ))}
      </div>
      <div className="card-pp">
        <p className="text-muted">Install the app, then pair it from Device Mapping with a sync code for this outlet.</p>
        <table className="table mb-0">
          <thead><tr><th>Application</th><th>Platform</th></tr></thead>
          <tbody>
            {APPS[platform].map((name) => (
              <tr key={name}><td>{name}</td><td>{platform}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}
