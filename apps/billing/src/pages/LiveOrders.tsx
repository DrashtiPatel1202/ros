import { useCallback, useEffect, useState } from "react"
import {
  ApiError,
  api,
  formatInr,
  formatTableSeat,
  ORDER_TYPE_LABEL,
  STATUS_LABEL,
  type PosLiveResponse,
  type PosOrder,
} from "../api"

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso))
}

export function LiveOrders() {
  const [data, setData] = useState<PosLiveResponse | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [timezone, setTimezone] = useState("Asia/Kolkata")
  const [tab, setTab] = useState<"orders" | "tables">("orders")

  const load = useCallback(async () => {
    try {
      const [live, boot] = await Promise.all([api.posLive(), api.posBootstrap()])
      setData(live)
      setTimezone(boot.outlet.timezone)
      setError("")
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load live orders")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 8_000)
    return () => window.clearInterval(timer)
  }, [load])

  const orders = data?.orders ?? []
  const byTable = new Map<string, PosOrder>()
  for (const order of orders) {
    if (order.tableLabel) byTable.set(order.tableLabel, order)
  }

  return (
    <div className="page-pad">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <nav className="breadcrumb-pp">Tables › Running Orders</nav>
          <h1 className="page-title mb-0">Live Orders</h1>
        </div>
        <a className="btn btn-primary" href="/pos/billing">
          <i className="bi bi-plus-lg me-1" />
          New order
        </a>
      </div>

      <div className="pos-tabs mb-3">
        <button type="button" className={tab === "orders" ? "on" : ""} onClick={() => setTab("orders")}>
          Running Orders
        </button>
        <button type="button" className={tab === "tables" ? "on" : ""} onClick={() => setTab("tables")}>
          Running Tables
        </button>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span>Running orders</span>
          <strong>{data?.kpis.runningOrderCount ?? "—"}</strong>
        </div>
        <div className="kpi-card">
          <span>Running amount</span>
          <strong>{data ? formatInr(data.kpis.runningAmountPaise) : "—"}</strong>
        </div>
        <div className="kpi-card">
          <span>Pending orders</span>
          <strong>{data?.kpis.pendingOrders ?? "—"}</strong>
        </div>
      </div>

      {loading && <p className="text-muted mt-3">Loading live orders…</p>}
      {error && (
        <p className="text-danger mt-3" role="alert">
          {error}{" "}
          <button type="button" className="btn btn-sm btn-link" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}

      {!loading && !error && tab === "orders" && (
        <div className="card-pp mt-3">
          {orders.length === 0 ? (
            <p className="empty-state mb-0">No running orders. Start a bill from POS.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Type</th>
                    <th>Table / Guest</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th className="text-end">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>#{order.orderNo}</strong>
                        {order.kotNo != null && <small className="d-block text-muted">KOT {order.kotNo}</small>}
                      </td>
                      <td>{ORDER_TYPE_LABEL[order.orderType]}</td>
                      <td>
                        {order.tableLabel ? formatTableSeat(order.tableLabel) : "—"}
                        <small className="d-block text-muted">{order.customerName || "Walk-in"}</small>
                      </td>
                      <td>{order.itemCount}</td>
                      <td>
                        <span className={`status-pill status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
                      </td>
                      <td>{formatTime(order.updatedAt, timezone)}</td>
                      <td className="text-end">{formatInr(order.totalPaise)}</td>
                      <td className="text-end">
                        <a className="btn btn-sm btn-outline-primary" href={`/pos/billing?edit=${order.id}`}>
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && !error && tab === "tables" && (
        <div className="card-pp mt-3">
          {byTable.size === 0 ? (
            <p className="empty-state mb-0">No occupied tables right now.</p>
          ) : (
            <div className="live-table-grid">
              {[...byTable.entries()].map(([table, order]) => (
                <a key={table} className="live-table-card" href={`/pos/billing?edit=${order.id}`}>
                  <strong>{formatTableSeat(table)}</strong>
                  <span>#{order.orderNo} · {STATUS_LABEL[order.status]}</span>
                  <span>{formatInr(order.totalPaise)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
