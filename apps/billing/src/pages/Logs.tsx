import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { api } from "../api"
import { errText, MgmtShell, today, when } from "./mgmtUi"

const LOG_PAGES: Record<string, { category: string; title: string; crumb: string; empty: string }> = {
  "/logs/online_log_status/1": {
    category: "online_store",
    title: "Online Store Logs",
    crumb: "User Logs › Online Store Logs",
    empty: "Store open and close events appear here once an aggregator is connected.",
  },
  "/logs/online_log_status/2": {
    category: "item_onoff",
    title: "Online Item On/Off Logs",
    crumb: "User Logs › Online Item On/Off Logs",
    empty: "Item on/off changes from Menu on/off show up here.",
  },
  "/logs/auto_accept_log_status": {
    category: "auto_accept",
    title: "Auto Accept Change Logs",
    crumb: "User Logs › Auto Accept Change Logs",
    empty: "Auto-accept changes appear here once online orders are connected.",
  },
  "/settings/zomato_menu_callbacks": {
    category: "menu_trigger",
    title: "Menu Trigger Logs",
    crumb: "User Logs › Menu Trigger Logs",
    empty: "Aggregator menu pushes are logged here with their status.",
  },
  "/logs/closing_hours_logs": {
    category: "closing_hours",
    title: "Closing Hour Logs",
    crumb: "User Logs › Closing Hour Logs",
    empty: "Saving outlet timings writes a row here.",
  },
  "/logs/expense_logs": {
    category: "expense",
    title: "Expense Logs",
    crumb: "User Logs › Expense Logs",
    empty: "Expense adds and removals are logged here.",
  },
  "/logs/withdrawl_logs": {
    category: "withdrawal",
    title: "Withdrawal Logs",
    crumb: "User Logs › Withdrawal Logs",
    empty: "Withdrawal adds and removals are logged here.",
  },
  "/logs/cashtopup_logs": {
    category: "cash_topup",
    title: "Cash Top-Up Logs",
    crumb: "User Logs › Cash Top-Up Logs",
    empty: "Cash top-up adds and removals are logged here.",
  },
}

export function LogsPage() {
  const { pathname } = useLocation()
  if (pathname.endsWith("support_note_list")) return <Support />
  if (pathname.endsWith("notifications_list")) return <Notifications />
  if (pathname.endsWith("logs_redirect")) return <Audit />
  const page = LOG_PAGES[pathname]
  if (!page) return <Audit />
  return <FilteredLog {...page} />
}

function FilteredLog({ category, title, crumb, empty }: { category: string; title: string; crumb: string; empty: string }) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState(today())
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.audit>>["rows"]>([])
  const [error, setError] = useState("")
  async function load() {
    setRows((await api.audit({ category, from, to, q })).rows)
  }
  useEffect(() => {
    void load().catch((caught) => setError(errText(caught, "Could not load logs")))
  }, [category])
  return (
    <MgmtShell crumb={crumb} title={title}>
      {error && <p className="text-danger">{error}</p>}
      <form className="card-pp mb-3" onSubmit={(e) => { e.preventDefault(); void load() }}>
        <div className="row g-2">
          <div className="col-md-2"><input className="form-control" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="col-md-4"><input className="form-control" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary" type="submit">Search</button></div>
          <div className="col-md-2"><button className="btn btn-outline-secondary" type="button" onClick={() => { setFrom(""); setQ(""); void api.audit({ category }).then((data) => setRows(data.rows)) }}>Reset</button></div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="text-muted">{empty}</td></tr>}
            {rows.map((row) => (
              <tr key={row.id}><td>{when(row.createdAt)}</td><td>{row.actorName}</td><td>{row.action}</td><td>{row.summary}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

function Support() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.supportNotes>> | null>(null)
  const [category, setCategory] = useState("Billing Issue")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  async function load() { setData(await api.supportNotes()) }
  useEffect(() => { void load().catch((caught) => setError(errText(caught, "Could not load support notes"))) }, [])
  return (
    <MgmtShell crumb="User Logs › Support Management" title="Support Management">
      {error && <p className="text-danger">{error}</p>}
      <form className="card-pp mb-3" onSubmit={(e) => { e.preventDefault(); void api.addSupportNote(category, note).then(() => { setNote(""); return load() }).catch((caught) => setError(errText(caught, "Could not add the note"))) }}>
        <div className="row g-2">
          <div className="col-md-3">
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {(data?.categories ?? [category]).map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="col-md-7"><input className="form-control" placeholder="Note" required value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100" type="submit">Add</button></div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>No.</th><th>When</th><th>Category</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>
            {(data?.rows ?? []).length === 0 && <tr><td colSpan={5} className="text-muted">No support notes for this outlet.</td></tr>}
            {data?.rows.map((row) => (
              <tr key={row.id}><td>{row.supportNo}</td><td>{when(row.createdAt)}</td><td>{row.category}</td><td>{row.note}</td><td>{row.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

function Notifications() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.notifications>> | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState("")
  async function load() { setData(await api.notifications()) }
  useEffect(() => { void load().catch((caught) => setError(errText(caught, "Could not load notifications"))) }, [])
  return (
    <MgmtShell crumb="User Logs › Notification" title="Notification">
      {error && <p className="text-danger">{error}</p>}
      <form className="card-pp mb-3" onSubmit={(e) => { e.preventDefault(); void api.addNotification(title, body).then(() => { setTitle(""); setBody(""); return load() }).catch((caught) => setError(errText(caught, "Could not add"))) }}>
        <div className="row g-2">
          <div className="col-md-4"><input className="form-control" placeholder="Title" required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="col-md-6"><input className="form-control" placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100" type="submit">Add</button></div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>When</th><th>Title</th><th>Message</th><th /></tr></thead>
          <tbody>
            {(data?.rows ?? []).length === 0 && <tr><td colSpan={4} className="text-muted">No notifications.</td></tr>}
            {data?.rows.map((row) => (
              <tr key={row.id} className={row.read ? "text-muted" : ""}>
                <td>{when(row.createdAt)}</td><td>{row.title}</td><td>{row.body}</td>
                <td className="text-end">{!row.read && <button type="button" className="btn btn-sm btn-link" onClick={() => void api.readNotification(row.id).then(load)}>Mark read</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

const AUDIT_LABEL: Record<string, string> = {
  staff: "Billing users",
  device: "Devices",
  item_onoff: "Item on/off",
  closing_hours: "Closing hours",
  expense: "Expenses",
  withdrawal: "Withdrawals",
  cash_topup: "Cash top-up",
  gst: "GST",
  bank: "Bank",
  wallet: "Wallet",
  payment: "Payments",
  recon: "Reconciliation",
  support: "Support",
  marketplace: "Marketplace",
}

function Audit() {
  const [category, setCategory] = useState("")
  const [data, setData] = useState<Awaited<ReturnType<typeof api.audit>> | null>(null)
  const [error, setError] = useState("")
  async function load(next = category) {
    setData(await api.audit({ category: next }))
  }
  useEffect(() => { void load("").catch((caught) => setError(errText(caught, "Could not load the audit trail"))) }, [])
  return (
    <MgmtShell crumb="Audit Trail" title="Audit Trail">
      {error && <p className="text-danger">{error}</p>}
      <p className="text-muted">Every action on this outlet for the last 180 days.</p>
      <div className="audit-layout">
        <div className="card-pp">
          <button type="button" className={`btn btn-link d-block text-start ${category === "" ? "fw-bold" : ""}`} onClick={() => { setCategory(""); void load("") }}>All</button>
          {(data?.categories ?? []).map((row) => (
            <button key={row.category} type="button" className={`btn btn-link d-block text-start ${category === row.category ? "fw-bold" : ""}`} onClick={() => { setCategory(row.category); void load(row.category) }}>
              {AUDIT_LABEL[row.category] ?? row.category} <span className="text-muted">{row.count}</span>
            </button>
          ))}
          {(data?.categories ?? []).length === 0 && <p className="text-muted mb-0">No activity yet.</p>}
        </div>
        <div className="card-pp">
          <table className="table mb-0">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>
              {(data?.rows ?? []).length === 0 && <tr><td colSpan={4} className="text-muted">Select a category to view activity.</td></tr>}
              {data?.rows.map((row) => (
                <tr key={row.id}><td>{when(row.createdAt)}</td><td>{row.actorName}</td><td>{row.action}</td><td>{row.summary}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MgmtShell>
  )
}
