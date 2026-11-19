import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  ApiError,
  api,
  formatInr,
  formatTableSeat,
  ORDER_TYPE_LABEL,
  PAYMENT_LABEL,
  STATUS_LABEL,
  type PosOrder,
  type PosPaymentType,
  type PosStatus,
} from "../api"

function formatWhen(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso))
}

export function AllOrders() {
  const [orders, setOrders] = useState<PosOrder[]>([])
  const [businessDate, setBusinessDate] = useState("")
  const [timezone, setTimezone] = useState("Asia/Kolkata")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("all")
  const [orderType, setOrderType] = useState("all")
  const [paymentType, setPaymentType] = useState("all")
  const [params] = useSearchParams()
  const [invoiceId, setInvoiceId] = useState(params.get("invoice") ?? "")
  const [customer, setCustomer] = useState("")
  const [selected, setSelected] = useState<PosOrder | null>(null)
  const [detailLines, setDetailLines] = useState<{ name: string; qty: number; lineTotalPaise: number; note: string | null }[]>([])
  const [cancelReason, setCancelReason] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, boot] = await Promise.all([
        api.posOrders({ status, orderType, paymentType, invoiceId, customer }),
        api.posBootstrap(),
      ])
      setOrders(list.orders)
      setBusinessDate(list.businessDate)
      setTimezone(boot.outlet.timezone)
      setError("")
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load orders")
    } finally {
      setLoading(false)
    }
  }, [status, orderType, paymentType, invoiceId, customer])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const invoice = params.get("invoice")
    if (!invoice || loading) return
    const match = orders.find((order) => String(order.orderNo) === invoice)
    if (match) void openDetail(match)
  }, [orders, loading, params])

  async function openDetail(order: PosOrder) {
    setSelected(order)
    setCancelReason("")
    try {
      const detail = await api.posOrder(order.id)
      setDetailLines(detail.lines)
    } catch {
      setDetailLines([])
    }
  }

  async function cancelSelected() {
    if (!selected || cancelReason.trim().length < 2) return
    setBusy(true)
    try {
      await api.posCancelOrder(selected.id, selected.version, cancelReason.trim())
      setSelected(null)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not cancel")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-pad">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <nav className="breadcrumb-pp">Orders And Billing › All Orders</nav>
          <h1 className="page-title mb-0">All Orders</h1>
          {businessDate && <p className="text-muted mb-0">Business date {businessDate}</p>}
        </div>
        <a className="btn btn-primary" href="/pos/billing">
          Open POS
        </a>
      </div>

      <form
        className="card-pp filter-bar"
        onSubmit={(e) => {
          e.preventDefault()
          void load()
        }}
      >
        <div className="row g-2 align-items-end">
          <div className="col-md-2">
            <label className="form-label">Status</label>
            <select className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="saved">Saved</option>
              <option value="printed">Printed</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
              <option value="complimentary">Complimentary</option>
              <option value="sales_return">Sales Return</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Order type</label>
            <select className="form-select form-select-sm" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
              <option value="all">All</option>
              <option value="dine_in">Dine In</option>
              <option value="pickup">Pick Up</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Payment</label>
            <select className="form-select form-select-sm" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="all">All</option>
              <option value="not_paid">Not Paid</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="due">Due</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Order ID</label>
            <input className="form-control form-control-sm" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Customer</label>
            <input className="form-control form-control-sm" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-sm btn-primary w-100">
              Search
            </button>
          </div>
        </div>
      </form>

      {loading && <p className="text-muted mt-3">Loading orders…</p>}
      {error && (
        <p className="text-danger mt-3" role="alert">
          {error}
        </p>
      )}

      {!loading && (
        <div className="card-pp mt-3">
          {orders.length === 0 ? (
            <p className="empty-state mb-0">No orders match these filters today.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Type</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>When</th>
                    <th className="text-end">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>#{order.orderNo}</strong>
                        {order.tableLabel && <small className="d-block text-muted">{formatTableSeat(order.tableLabel)}</small>}
                      </td>
                      <td>{ORDER_TYPE_LABEL[order.orderType]}</td>
                      <td>
                        {order.customerName || "—"}
                        {order.customerPhone && <small className="d-block text-muted">{order.customerPhone}</small>}
                      </td>
                      <td>{PAYMENT_LABEL[order.paymentType as PosPaymentType] ?? order.paymentType}</td>
                      <td>
                        <span className={`status-pill status-${order.status}`}>
                          {STATUS_LABEL[order.status as PosStatus] ?? order.status}
                        </span>
                      </td>
                      <td>{formatWhen(order.createdAt, timezone)}</td>
                      <td className="text-end">{formatInr(order.totalPaise)}</td>
                      <td className="text-end text-nowrap">
                        <button type="button" className="btn btn-sm btn-link" onClick={() => void openDetail(order)}>
                          View
                        </button>
                        {["saved", "printed"].includes(order.status) && (
                          <a className="btn btn-sm btn-link" href={`/pos/billing?edit=${order.id}`}>
                            Edit
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="pos-modal" role="dialog" aria-modal="true">
          <div className="pos-modal-card settle" style={{ maxWidth: 480 }}>
            <div className="pos-modal-head">
              <h2>Order #{selected.orderNo}</h2>
              <button type="button" className="btn-close" onClick={() => setSelected(null)} aria-label="Close" />
            </div>
            <p className="text-muted">
              {ORDER_TYPE_LABEL[selected.orderType]}
              {selected.tableLabel ? ` · ${formatTableSeat(selected.tableLabel)}` : ""} ·{" "}
              {STATUS_LABEL[selected.status]} · {PAYMENT_LABEL[selected.paymentType]}
            </p>
            <ul className="list-unstyled mb-3">
              {detailLines.map((line, i) => (
                <li key={i} className="d-flex justify-content-between py-1 border-bottom">
                  <span>
                    {line.qty} × {line.name}
                    {line.note ? <small className="d-block text-muted">{line.note}</small> : null}
                  </span>
                  <strong>{formatInr(line.lineTotalPaise)}</strong>
                </li>
              ))}
            </ul>
            <dl className="pos-totals mb-3">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatInr(selected.subtotalPaise)}</dd>
              </div>
              {selected.discountPaise > 0 && (
                <div>
                  <dt>Discount</dt>
                  <dd>−{formatInr(selected.discountPaise)}</dd>
                </div>
              )}
              <div>
                <dt>GST</dt>
                <dd>{formatInr(selected.taxPaise)}</dd>
              </div>
              <div className="grand">
                <dt>Total</dt>
                <dd>{formatInr(selected.totalPaise)}</dd>
              </div>
            </dl>
            {["saved", "printed"].includes(selected.status) && (
              <>
                <label className="form-label">Cancel reason</label>
                <textarea
                  className="form-control mb-2"
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <div className="d-flex gap-2">
                  <a className="btn btn-outline-primary" href={`/pos/billing?edit=${selected.id}`}>
                    Edit in POS
                  </a>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={busy || cancelReason.trim().length < 2}
                    onClick={() => void cancelSelected()}
                  >
                    Cancel order
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
