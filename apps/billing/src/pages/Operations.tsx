import { useEffect, useState } from "react"
import { ApiError, api, formatInr } from "../api"

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting For Acceptance",
  accepted: "Accepted",
  preparing_kot: "Preparing Food/KOT Created",
  preparing_bill: "Preparing/Bill Created",
  food_ready: "Food Is Ready",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

const PROVIDERS = ["In house", "Adloggs Rider", "Borzo", "Dunzo B2B", "Shadowfax", "Porter"]

export function OnlineOrders() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.onlineOrders>>["rows"]>([])
  const [menu, setMenu] = useState<Awaited<ReturnType<typeof api.menuAdmin>> | null>(null)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("all")
  const [client, setClient] = useState("Zomato")
  const [orderNo, setOrderNo] = useState("")
  const [customer, setCustomer] = useState("")
  const [phone, setPhone] = useState("")
  const [itemId, setItemId] = useState(0)
  const [qty, setQty] = useState(1)

  async function load() {
    const [orders, menuData] = await Promise.all([api.onlineOrders({ status }), api.menuAdmin()])
    setRows(orders.rows)
    setMenu(menuData)
    if (!itemId && menuData.items[0]) setItemId(menuData.items[0].id)
  }

  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [status])

  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">Orders And Billing › Online Orders Activity</div>
      <h1 className="page-title">Online Orders</h1>
      {error && <p className="text-danger">{error}</p>}
      <p className="text-muted">Aggregator apps are not connected. Record an order here and move it through the same steps: accept, kitchen, bill, ready, dispatch, delivered.</p>
      <form className="card-pp mb-3" onSubmit={(event) => {
        event.preventDefault()
        void api.createOnlineOrder({ client, clientOrderId: orderNo, customerName: customer, customerPhone: phone, note: "", lines: [{ menuItemId: itemId, qty }] })
          .then(() => { setOrderNo(""); return load() })
          .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not save"))
      }}>
        <div className="d-flex flex-wrap gap-2">
          <select className="form-select" style={{ maxWidth: 160 }} value={client} onChange={(e) => setClient(e.target.value)}>
            {["Zomato", "Swiggy", "Website", "Magicpin"].map((name) => <option key={name}>{name}</option>)}
          </select>
          <input className="form-control" style={{ maxWidth: 160 }} placeholder="Order no." value={orderNo} onChange={(e) => setOrderNo(e.target.value)} required />
          <input className="form-control" style={{ maxWidth: 180 }} placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <input className="form-control" style={{ maxWidth: 140 }} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select className="form-select" style={{ maxWidth: 200 }} value={itemId} onChange={(e) => setItemId(Number(e.target.value))}>
            {(menu?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input className="form-control" style={{ maxWidth: 80 }} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <button className="btn btn-primary" type="submit">Record</button>
        </div>
      </form>
      <div className="d-flex gap-2 mb-3">
        <select className="form-select" style={{ maxWidth: 260 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All</option>
          {Object.entries(STATUS_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Order</th><th>From</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.clientOrderId}</td>
                <td>{row.client}</td>
                <td>{row.customerName || "—"}<div className="text-muted small">{row.customerPhone}</div></td>
                <td>{formatInr(row.totalPaise)}</td>
                <td>{STATUS_LABEL[row.status] ?? row.status}</td>
                <td className="text-nowrap">
                  {row.status !== "delivered" && row.status !== "cancelled" && (
                    <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => void api.advanceOnlineOrder(row.id).then(load)}>Next</button>
                  )}
                  {(row.status === "waiting" || row.status === "accepted") && (
                    <button type="button" className="btn btn-sm btn-outline-danger me-1" onClick={() => void api.cancelOnlineOrder(row.id).then(load)}>Cancel</button>
                  )}
                  {!row.orderId && row.status !== "cancelled" && (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void api.invoiceOnlineOrder(row.id).then(load)}>Bill</button>
                  )}
                  {row.orderId && <span className="text-muted">Bill #{row.orderId}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-muted">No online orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DayEnd() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.dayEnd>> | null>(null)
  const [error, setError] = useState("")
  const [password, setPassword] = useState("")

  async function load() {
    setData(await api.dayEnd())
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [])

  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">Reports › Day End Summary</div>
      <h1 className="page-title">Day End Summary</h1>
      {error && <p className="text-danger">{error}</p>}
      {data && (
        <div className="card-pp mb-3">
          <h2 className="h5">Today · {data.today.businessDate}</h2>
          <p className="mb-2">{data.today.orderCount} settled bills · {formatInr(data.today.totalPaise)}</p>
          <p className="text-muted">Cash {formatInr(data.today.cashPaise)} · Card {formatInr(data.today.cardPaise)} · UPI {formatInr(data.today.upiPaise)} · Other {formatInr(data.today.otherPaise)}</p>
          <button type="button" className="btn btn-primary" disabled={data.today.closed} onClick={() => void api.closeDay().then(load).catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not close"))}>
            {data.today.closed ? "Closed" : "Close day"}
          </button>
        </div>
      )}
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Date</th><th>Biller</th><th>Orders</th><th>Total</th><th>Cash</th><th>Card</th><th>UPI</th><th></th></tr></thead>
          <tbody>
            {(data?.rows ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.businessDate}</td>
                <td>{row.billerName}</td>
                <td>{row.orderCount}</td>
                <td>{formatInr(row.totalPaise)}</td>
                <td>{formatInr(row.cashPaise)}</td>
                <td>{formatInr(row.cardPaise)}</td>
                <td>{formatInr(row.upiPaise)}</td>
                <td>
                  <form className="d-flex gap-1" onSubmit={(event) => {
                    event.preventDefault()
                    void api.removeDayEnd(row.id, password).then(() => { setPassword(""); return load() }).catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not remove"))
                  }}>
                    <input className="form-control form-control-sm" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button className="btn btn-sm btn-outline-danger" type="submit">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {(data?.rows.length ?? 0) === 0 && <tr><td colSpan={8} className="text-muted">No closed days yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DeliveryManagement() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.deliveries>> | null>(null)
  const [error, setError] = useState("")

  async function load() {
    setData(await api.deliveries())
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [])

  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">Reports › Delivery Management</div>
      <h1 className="page-title">Delivery Management</h1>
      {error && <p className="text-danger">{error}</p>}
      <div className="d-flex gap-3 mb-3">
        {(data?.chart ?? []).map((day) => (
          <div key={day.day} className="card-pp p-2">
            <div className="text-muted small">{day.day}</div>
            <div>{day.orders} orders</div>
            <div>{day.delivered} delivered</div>
          </div>
        ))}
        {(data?.chart.length ?? 0) === 0 && <p className="text-muted">No delivery orders in the last 7 days.</p>}
      </div>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th>Status</th><th>Total</th><th>Provider</th></tr></thead>
          <tbody>
            {(data?.rows ?? []).map((row) => (
              <tr key={row.id}>
                <td>#{row.orderNo}</td>
                <td>{row.businessDate}</td>
                <td>{row.customerName || "—"}<div className="text-muted small">{row.customerPhone}</div></td>
                <td>{row.status}</td>
                <td>{formatInr(row.totalPaise)}</td>
                <td>
                  <select className="form-select form-select-sm" value={row.provider} onChange={(e) => void api.assignDelivery(row.id, e.target.value).then(load)}>
                    <option value="">Assign</option>
                    {PROVIDERS.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {(data?.rows.length ?? 0) === 0 && <tr><td colSpan={6} className="text-muted">No delivery bills yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
