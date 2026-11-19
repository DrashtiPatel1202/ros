import { useEffect, useState } from "react"
import {
  ApiError,
  api,
  formatInr,
  ORDER_TYPE_LABEL,
  STATUS_LABEL,
  type PosKot,
  type PosOrder,
} from "../api"

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso))
}

const KOT_STATUS: Record<PosKot["status"], string> = {
  active: "Active",
  used_in_bill: "Used in bill",
  cancelled: "Cancelled",
  shifted: "Shifted",
}

export function PosRunningScreen({
  timeZone,
  onOpenOrder,
}: {
  timeZone: string
  onOpenOrder: (id: number) => void
}) {
  const [orders, setOrders] = useState<PosOrder[]>([])
  const [kpis, setKpis] = useState({ runningOrderCount: 0, runningAmountPaise: 0, pendingOrders: 0 })
  const [error, setError] = useState("")

  useEffect(() => {
    let stop = false
    async function load() {
      try {
        const live = await api.posLive()
        if (stop) return
        setOrders(live.orders)
        setKpis(live.kpis)
        setError("")
      } catch (caught) {
        if (!stop) setError(caught instanceof ApiError ? caught.message : "Could not load orders")
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 8_000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <section className="poss-floor">
      <div className="poss-floor-bar">
        <h1>Running Orders</h1>
        <div className="poss-legend">
          <span>{kpis.runningOrderCount} orders</span>
          <span>{formatInr(kpis.runningAmountPaise)}</span>
          <span>{kpis.pendingOrders} pending</span>
        </div>
      </div>
      {error && <p className="poss-error">{error}</p>}
      <div className="poss-sheet">
        {orders.length === 0 && <p className="poss-empty">No running orders.</p>}
        {orders.map((order) => (
          <button key={order.id} type="button" className="poss-row" onClick={() => onOpenOrder(order.id)}>
            <strong>#{order.orderNo}</strong>
            <span>
              {ORDER_TYPE_LABEL[order.orderType]}
              {order.tableLabel ? ` · Table ${order.tableLabel}` : ""}
              <small>{order.customerName || "Walk-in"} · {order.itemCount} items · {clock(order.updatedAt, timeZone)}</small>
            </span>
            <em className={`kot-status ${order.status}`}>{STATUS_LABEL[order.status]}</em>
            <b>{formatInr(order.totalPaise)}</b>
          </button>
        ))}
      </div>
    </section>
  )
}

export function PosKotScreen({
  timeZone,
  onOpenOrder,
}: {
  timeZone: string
  onOpenOrder: (id: number) => void
}) {
  const [kots, setKots] = useState<PosKot[]>([])
  const [status, setStatus] = useState("all")
  const [orderType, setOrderType] = useState("all")
  const [tableNo, setTableNo] = useState("")
  const [kotId, setKotId] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let stop = false
    api
      .posKots({ status, orderType, tableNo, kotId })
      .then((data) => {
        if (!stop) {
          setKots(data.kots)
          setError("")
        }
      })
      .catch((caught) => {
        if (!stop) setError(caught instanceof ApiError ? caught.message : "Could not load KOTs")
      })
    return () => {
      stop = true
    }
  }, [status, orderType, tableNo, kotId])

  return (
    <section className="poss-floor">
      <div className="poss-floor-bar">
        <h1>KOT</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="used_in_bill">Used in bill</option>
          <option value="shifted">Shifted</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
          <option value="all">All types</option>
          <option value="dine_in">Dine In</option>
          <option value="pickup">Pick Up</option>
          <option value="delivery">Delivery</option>
        </select>
        <input placeholder="KOT no." value={kotId} onChange={(e) => setKotId(e.target.value)} />
        <input placeholder="Table no." value={tableNo} onChange={(e) => setTableNo(e.target.value)} />
      </div>
      {error && <p className="poss-error">{error}</p>}
      <div className="poss-sheet">
        {kots.length === 0 && <p className="poss-empty">No KOTs for today.</p>}
        {kots.map((kot) => (
          <button key={kot.id} type="button" className="poss-row kot" onClick={() => onOpenOrder(kot.orderId)}>
            <strong>KOT {kot.kotNo}</strong>
            <span>
              Bill #{kot.orderNo}
              {kot.tableLabel ? ` · Table ${kot.tableLabel}` : ""} · {ORDER_TYPE_LABEL[kot.orderType]}
              <small>
                {kot.items.map((item) => `${item.qty}× ${item.name}`).join(", ") || "No items"} · {clock(kot.punchedAt, timeZone)}
              </small>
            </span>
            <em className={`kot-status ${kot.status}`}>
              {KOT_STATUS[kot.status]}
              {kot.modified ? " · Modified" : ""}
            </em>
          </button>
        ))}
      </div>
    </section>
  )
}
