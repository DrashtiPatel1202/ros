import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatInr } from "@rea/pricing"
import { ApiError, api, ORDER_TYPE_LABEL, type OrderSummary } from "./api"

export function Orders({ timezone, onOpen }: { timezone: string; onOpen: (id: number) => void }) {
  const [status, setStatus] = useState<"" | "open" | "cancelled">("")
  const [pages, setPages] = useState<string[]>([""])
  const query = useQuery({
    queryKey: ["orders", status, pages.at(-1)],
    queryFn: () => api.orders(status, pages.at(-1) || undefined),
  })
  const orders = query.data?.orders ?? []

  return (
    <main className="sheet">
      <div className="sheet-head">
        <h1>Today's orders</h1>
        <div className="segmented" role="radiogroup" aria-label="Status">
          {([["", "All"], ["open", "Open"], ["cancelled", "Cancelled"]] as const).map(([value, label]) => (
            <button key={label} type="button" className={status === value ? "on" : ""} onClick={() => { setStatus(value); setPages([""]) }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {query.isLoading && <p className="muted">Loading orders…</p>}
      {query.isError && (
        <p className="form-error" role="alert">
          Couldn't load orders. <button type="button" onClick={() => query.refetch()}>Retry</button>
        </p>
      )}
      {query.isSuccess && orders.length === 0 && pages.length === 1 && (
        <p className="empty">No {status === "cancelled" ? "cancelled " : status === "open" ? "open " : ""}orders yet today.</p>
      )}
      <ul className="order-list">
        {orders.map((order) => (
          <li key={order.id}>
            <button type="button" onClick={() => onOpen(order.id)}>
              <OrderRow order={order} timezone={timezone} />
            </button>
          </li>
        ))}
      </ul>
      <div className="pager">
        {pages.length > 1 && (
          <button type="button" className="ghost" onClick={() => setPages((current) => current.slice(0, -1))}>Newer</button>
        )}
        {query.data?.nextCursor && (
          <button type="button" className="ghost" onClick={() => setPages((current) => [...current, query.data.nextCursor!])}>Earlier orders</button>
        )}
      </div>
    </main>
  )
}

function OrderRow({ order, timezone }: { order: OrderSummary; timezone: string }) {
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(order.createdAt))
  return (
    <>
      <span className="order-no">#{order.orderNo}</span>
      <span>
        <strong>{ORDER_TYPE_LABEL[order.orderType]}{order.tableLabel ? ` · Table ${order.tableLabel}` : ""}</strong>
        <small>{order.customerName || "No guest name"} · {order.itemCount} {order.itemCount === 1 ? "dish" : "dishes"} · {time}</small>
      </span>
      <span className={`status status-${order.status}`}>{order.status === "open" ? "Open" : "Cancelled"}</span>
      <strong>{formatInr(order.totalPaise)}</strong>
    </>
  )
}

export function OrderDetail({
  id,
  timezone,
  onBack,
  onEdit,
}: {
  id: number
  timezone: string
  onBack: () => void
  onEdit: () => void
}) {
  const queryClient = useQueryClient()
  const order = useQuery({ queryKey: ["order", id], queryFn: () => api.order(id) })
  const [confirming, setConfirming] = useState(false)
  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(id, order.data!.version),
    onSuccess: async () => {
      setConfirming(false)
      await queryClient.invalidateQueries({ queryKey: ["order", id] })
      await queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
  })
  const data = order.data
  const when = data
    ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(data.createdAt))
    : ""

  return (
    <main className="sheet detail">
      <button type="button" className="ghost back" onClick={onBack}>Back to today's orders</button>
      {order.isLoading && <p className="muted">Loading the order…</p>}
      {order.isError && (
        <p className="form-error" role="alert">
          {order.error instanceof ApiError ? order.error.message : "Couldn't load that order."}{" "}
          <button type="button" onClick={() => order.refetch()}>Retry</button>
        </p>
      )}
      {data && (
        <>
          <div className="detail-head">
            <h1>Order #{data.orderNo}</h1>
            <span className={`status status-${data.status}`}>{data.status === "open" ? "Open" : "Cancelled"}</span>
          </div>
          <p className="muted">
            {ORDER_TYPE_LABEL[data.orderType]}
            {data.tableLabel ? ` · Table ${data.tableLabel}` : ""} · {data.customerName || "No guest name"} · {when}
          </p>
          <ul className="detail-lines">
            {data.lines.map((line, index) => (
              <li key={`${line.menuItemId}-${index}`}>
                <span>{line.qty} × {line.name}{line.note ? <small>{line.note}</small> : null}</span>
                <strong>{formatInr(line.lineTotalPaise)}</strong>
              </li>
            ))}
          </ul>
          {data.note && <p className="order-note-read">Order note: {data.note}</p>}
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{formatInr(data.subtotalPaise)}</dd></div>
            <div><dt>GST</dt><dd>{formatInr(data.taxPaise)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{formatInr(data.totalPaise)}</dd></div>
          </dl>
          {data.status === "open" && !confirming && (
            <div className="detail-actions">
              <button type="button" className="primary" onClick={onEdit}>Change order</button>
              <button type="button" className="danger" onClick={() => setConfirming(true)}>Cancel order</button>
            </div>
          )}
          {confirming && (
            <div className="confirm" role="alert">
              <p>Cancel order #{data.orderNo}? It stays on today's list, marked cancelled.</p>
              {cancel.isError && <p className="form-error">{cancel.error instanceof ApiError ? cancel.error.message : "Couldn't cancel."}</p>}
              <button type="button" className="danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                {cancel.isPending ? "Cancelling…" : "Yes, cancel it"}
              </button>
              <button type="button" className="ghost" onClick={() => setConfirming(false)}>Keep the order</button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
