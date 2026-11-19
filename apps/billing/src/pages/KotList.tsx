import { Fragment, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ApiError, api, formatTableSeat, ORDER_TYPE_LABEL, type PosKot } from "../api"

const STATUS: Record<PosKot["status"], string> = {
  active: "Active",
  used_in_bill: "Used in bill",
  cancelled: "Cancelled",
  shifted: "Shifted",
}

function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
}

export function KotList() {
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [orderType, setOrderType] = useState("all")
  const [status, setStatus] = useState("all")
  const [modified, setModified] = useState("all")
  const [kotId, setKotId] = useState("")
  const [tableNo, setTableNo] = useState("")
  const [customer, setCustomer] = useState("")
  const [rows, setRows] = useState<PosKot[]>([])
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState("")
  const [showingAll, setShowingAll] = useState(false)

  async function load(query: {
    from: string
    to: string
    orderType: string
    status: string
    modified: string
    kotId: string
    tableNo: string
    customer: string
    all: boolean
  }) {
    const data = await api.posKots({
      from: query.all ? "" : query.from,
      to: query.all ? "" : query.to,
      orderType: query.orderType,
      status: query.status,
      modified: query.modified,
      kotId: query.kotId,
      tableNo: query.tableNo,
      customer: query.customer,
      all: query.all ? "1" : "",
    })
    setRows(data.kots)
    setShowingAll(query.all)
    setOpenIds(new Set())
  }

  useEffect(() => {
    void load({ from, to, orderType: "all", status: "all", modified: "all", kotId: "", tableNo: "", customer: "", all: false }).catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not load KOTs"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exportCsv() {
    const header = ["KOT", "Date", "Time", "Order", "Type", "Table", "Customer", "Phone", "Status", "Modified", "Items"]
    const lines = rows.map((row) => [
      row.kotNo,
      row.businessDate,
      new Date(row.punchedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
      row.orderNo,
      ORDER_TYPE_LABEL[row.orderType],
      row.tableLabel ?? "",
      row.customerName ?? "",
      row.customerPhone ?? "",
      STATUS[row.status],
      row.modified ? "Yes" : "No",
      row.items.map((item) => `${item.qty} x ${item.name}`).join("; "),
    ])
    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "kots.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">Daily Operations › KOT</div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="page-title mb-0">KOT</h1>
        <button type="button" className="btn btn-outline-primary" onClick={exportCsv} disabled={rows.length === 0}>
          Export
        </button>
      </div>
      {error && <p className="text-danger">{error}</p>}
      {showingAll && !error && <p className="text-muted">Showing every KOT, {rows.length} in total.</p>}
      <form
        className="card-pp mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void load({ from, to, orderType, status, modified, kotId, tableNo, customer, all: false }).catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not search"))
        }}
      >
        <div className="row g-2">
          <div className="col-md-2"><input className="form-control" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /></div>
          <div className="col-md-2"><input className="form-control" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" /></div>
          <div className="col-md-2">
            <select className="form-select" value={orderType} onChange={(e) => setOrderType(e.target.value)} aria-label="Order type">
              <option value="all">All order types</option>
              <option value="dine_in">Dine In</option>
              <option value="pickup">Pick Up</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="used_in_bill">Used in bill</option>
              <option value="shifted">Shifted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" value={modified} onChange={(e) => setModified(e.target.value)} aria-label="Modified">
              <option value="all">All KOTs</option>
              <option value="modified">Modified KOTs</option>
              <option value="fresh">Unmodified</option>
            </select>
          </div>
          <div className="col-md-2"><input className="form-control" placeholder="KOT no." value={kotId} onChange={(e) => setKotId(e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Table no." value={tableNo} onChange={(e) => setTableNo(e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Customer name / phone" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100" type="submit">Search</button></div>
          <div className="col-md-2">
            <button
              className="btn btn-outline-secondary w-100"
              type="button"
              onClick={() => {
                setFrom("")
                setTo("")
                setOrderType("all")
                setStatus("all")
                setModified("all")
                setKotId("")
                setTableNo("")
                setCustomer("")
                void load({ from: "", to: "", orderType: "all", status: "all", modified: "all", kotId: "", tableNo: "", customer: "", all: true }).catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not load"))
              }}
            >
              Show all
            </button>
          </div>
          <div className="col-md-2">
            <button
              className="btn btn-outline-primary w-100"
              type="button"
              disabled={rows.length === 0}
              onClick={() => setOpenIds(openIds.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)))}
            >
              {openIds.size === rows.length && rows.length > 0 ? "Hide items" : "View all"}
            </button>
          </div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead>
            <tr>
              <th>KOT</th>
              <th>When</th>
              <th>Type</th>
              <th>Table</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Bill</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="text-muted">No KOTs for this search.</td></tr>
            )}
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr>
                  <td>
                    <strong>{row.kotNo}</strong>
                    {row.modified && <span className="badge text-bg-warning ms-2">Modified</span>}
                  </td>
                  <td>{when(row.punchedAt)}</td>
                  <td>{ORDER_TYPE_LABEL[row.orderType]}</td>
                  <td>{row.tableLabel ? formatTableSeat(row.tableLabel) : "—"}</td>
                  <td>{row.customerName || row.customerPhone || "—"}</td>
                  <td>{STATUS[row.status]}</td>
                  <td>
                    <Link to={`/orders/order_list?invoice=${row.orderNo}`}>#{row.orderNo}</Link>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-link"
                      onClick={() => setOpenIds((current) => {
                        const next = new Set(current)
                        if (next.has(row.id)) next.delete(row.id)
                        else next.add(row.id)
                        return next
                      })}
                    >
                      {openIds.has(row.id) ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                {openIds.has(row.id) && (
                  <tr className="kot-detail">
                    <td colSpan={8}>
                      {row.items.length === 0 && <span className="text-muted">No items on this KOT.</span>}
                      <div className="kot-items">
                      {row.items.map((item, index) => (
                        <div key={`${item.name}-${index}`}>
                          {item.qty} × {item.name}
                          {item.note ? <small className="text-muted"> — {item.note}</small> : null}
                        </div>
                      ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
