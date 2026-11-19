import { useEffect, useState } from "react"
import { api } from "../api"
import { errText, MgmtShell } from "./mgmtUi"

const TYPES = [
  { id: "billing", label: "Billing User" },
  { id: "delivery", label: "Delivery Boy" },
  { id: "waiter", label: "Waiter" },
  { id: "captain", label: "Captain" },
  { id: "online", label: "Online Acceptance App" },
]

type StaffRow = {
  id: number
  name: string
  userType: string
  userName: string
  userCode: string
  phone: string
  passcode: string
  swipeCode: string
  active: boolean
}

const blank = {
  name: "",
  userType: "billing",
  userName: "",
  userCode: "",
  password: "",
  phone: "",
  passcode: "",
  swipeCode: "",
}

export function StaffPage() {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [form, setForm] = useState(blank)
  const [error, setError] = useState("")

  async function load() {
    setRows((await api.staff()).rows)
  }
  useEffect(() => {
    void load().catch((caught) => setError(errText(caught, "Could not load billing users")))
  }, [])

  function set<K extends keyof typeof blank>(key: K, value: (typeof blank)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <MgmtShell crumb="User Management › Biller App" title="Biller App">
      {error && <p className="text-danger">{error}</p>}
      <div className="card-pp mb-3">
        <h2 className="h6">Edit Billing User</h2>
        <form
          className="row g-2"
          onSubmit={(e) => {
            e.preventDefault()
            void api
              .addStaff(form)
              .then(() => {
                setForm(blank)
                return load()
              })
              .catch((caught) => setError(errText(caught, "Could not add the user")))
          }}
        >
          <div className="col-md-3"><input className="form-control" placeholder="Name" required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="col-md-3">
            <select className="form-select" value={form.userType} onChange={(e) => set("userType", e.target.value)}>
              {TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
          </div>
          <div className="col-md-3"><input className="form-control" placeholder="User name" required value={form.userName} onChange={(e) => set("userName", e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="User code" required value={form.userCode} onChange={(e) => set("userCode", e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Password" type="password" required minLength={4} value={form.password} onChange={(e) => set("password", e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Passcode" required inputMode="numeric" maxLength={4} value={form.passcode} onChange={(e) => set("passcode", e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Swipe code" value={form.swipeCode} onChange={(e) => set("swipeCode", e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100" type="submit">Add</button></div>
        </form>
      </div>
      <div className="card-pp">
        <table className="table mb-0">
          <thead>
            <tr><th>Name</th><th>Type</th><th>User name</th><th>Code</th><th>Passcode</th><th>Phone</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-muted">No billing users yet.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{TYPES.find((type) => type.id === row.userType)?.label ?? row.userType}</td>
                <td>{row.userName}</td>
                <td>{row.userCode}</td>
                <td>{row.passcode}</td>
                <td>{row.phone || "—"}</td>
                <td>{row.active ? "Active" : "Inactive"}</td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-link"
                    onClick={() => void api.updateStaff(row.id, { active: !row.active }).then(load).catch((caught) => setError(errText(caught, "Could not update")))}
                  >
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
