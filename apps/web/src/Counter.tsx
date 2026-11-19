import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { formatInr, summarize } from "@rea/pricing"
import { ApiError, api, ORDER_TYPE_LABEL, type Draft, type MenuItem, type Session } from "./api"

export type Notice = { text: string; orderId: number }

type CartLine = {
  key: string
  menuItemId: number
  name: string
  pricePaise: number
  dietary: MenuItem["dietary"]
  qty: number
  note: string
}

export function Counter({
  session,
  editingId,
  onSaved,
  onDiscard,
}: {
  session: Session
  editingId?: number
  onSaved: (notice: Notice) => void
  onDiscard?: () => void
}) {
  const existing = useQuery({
    queryKey: ["order", editingId],
    queryFn: () => api.order(editingId!),
    enabled: editingId !== undefined,
  })
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(editingId === undefined)
  const [orderType, setOrderType] = useState<Draft["orderType"]>("dine_in")
  const [tableLabel, setTableLabel] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [orderNote, setOrderNote] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [error, setError] = useState("")
  const [ticketOpen, setTicketOpen] = useState(false)
  const saveKey = useRef<string | null>(null)
  const narrow = useNarrow()

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 200)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!existing.data || hydrated) return
    setOrderType(existing.data.orderType)
    setTableLabel(existing.data.tableLabel ?? "")
    setCustomerName(existing.data.customerName ?? "")
    setOrderNote(existing.data.note ?? "")
    setLines(
      existing.data.lines.map((line, index) => ({
        key: `${line.menuItemId}:${index}`,
        menuItemId: line.menuItemId,
        name: line.name,
        pricePaise: line.unitPricePaise,
        dietary: "veg",
        qty: line.qty,
        note: line.note ?? "",
      })),
    )
    setHydrated(true)
  }, [existing.data, hydrated])

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories,
    staleTime: 60_000,
  })
  const activeCategory = categoryId ?? categories.data?.categories[0]?.id ?? null
  const menu = useQuery({
    queryKey: ["items", activeCategory],
    queryFn: () => api.items(activeCategory!),
    enabled: activeCategory !== null && debounced.length === 0,
    staleTime: 60_000,
  })
  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length > 0,
    staleTime: 15_000,
  })

  const items = debounced ? results.data?.items ?? [] : menu.data?.items ?? []
  const bill = useMemo(
    () => summarize(lines.map((line) => ({ unitPricePaise: line.pricePaise, qty: line.qty })), session.outlet.taxRateBps),
    [lines, session.outlet.taxRateBps],
  )
  const qtyOf = (id: number) => lines.filter((line) => line.menuItemId === id).reduce((sum, line) => sum + line.qty, 0)

  function addItem(item: MenuItem) {
    setError("")
    setLines((current) => {
      const blank = current.find((line) => line.menuItemId === item.id && line.note === "")
      if (blank) {
        if (blank.qty >= 99) return current
        return current.map((line) => (line.key === blank.key ? { ...line, qty: line.qty + 1 } : line))
      }
      return [
        ...current,
        {
          key: `${item.id}:${crypto.randomUUID()}`,
          menuItemId: item.id,
          name: item.name,
          pricePaise: item.pricePaise,
          dietary: item.dietary,
          qty: 1,
          note: "",
        },
      ]
    })
    if (narrow) setTicketOpen(true)
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setLines((current) => current.flatMap((line) => {
      if (line.key !== key) return [line]
      const next = { ...line, ...patch }
      return next.qty < 1 ? [] : [next]
    }))
  }

  const save = useMutation({
    mutationFn: async () => {
      const draft: Draft = {
        orderType,
        tableLabel: tableLabel.trim() || undefined,
        customerName: customerName.trim() || undefined,
        note: orderNote.trim() || undefined,
        lines: lines.map((line) => ({
          menuItemId: line.menuItemId,
          qty: line.qty,
          note: line.note.trim() || undefined,
        })),
      }
      if (editingId !== undefined && existing.data) {
        return api.updateOrder(editingId, { ...draft, version: existing.data.version })
      }
      saveKey.current ??= crypto.randomUUID()
      return api.createOrder(draft, saveKey.current)
    },
    onSuccess: (saved) => {
      saveKey.current = null
      if (editingId === undefined) {
        setLines([])
        setTableLabel("")
        setCustomerName("")
        setOrderNote("")
        setSearch("")
        setTicketOpen(false)
      }
      onSaved({ text: editingId === undefined ? `Saved order #${saved.orderNo}` : `Updated order #${saved.orderNo}`, orderId: saved.id })
    },
    onError: (caught) => {
      if (!(caught instanceof ApiError) || caught.status >= 500) return
      saveKey.current = null
      setError(caught.message)
    },
  })

  const loadingMenu = debounced ? results.isLoading : menu.isLoading || categories.isLoading
  const menuError = debounced ? results.error : menu.error ?? categories.error

  if (editingId !== undefined && existing.isError) {
    return (
      <p className="boot">
        Couldn't open that order. <button type="button" onClick={onDiscard}>Back</button>
      </p>
    )
  }
  if (editingId !== undefined && !hydrated) {
    return <p className="boot">Opening the order…</p>
  }

  return (
    <div className="workspace">
      <section className="menu-pane">
        {editingId !== undefined && (
          <div className="edit-banner">
            <span>Changing order #{existing.data?.orderNo ?? "…"}</span>
            <button type="button" className="ghost" onClick={onDiscard}>Discard</button>
          </div>
        )}
        <div className="order-meta">
          <div className="segmented" role="radiogroup" aria-label="Order type">
            {(Object.keys(ORDER_TYPE_LABEL) as Draft["orderType"][]).map((type) => (
              <button key={type} type="button" role="radio" aria-checked={orderType === type} className={orderType === type ? "on" : ""} onClick={() => setOrderType(type)}>
                {ORDER_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
          {orderType === "dine_in" && (
            <input value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} placeholder="Table" aria-label="Table" maxLength={20} />
          )}
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Guest name (optional)" aria-label="Guest name" maxLength={80} />
        </div>
        <label className="search">
          <span className="sr-only">Search the menu</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a dish or code, such as NAAN" />
          {search && <button type="button" onClick={() => setSearch("")}>Clear</button>}
        </label>
        {!debounced && (
          <div className="categories" role="tablist">
            {categories.data?.categories.map((category) => (
              <button key={category.id} type="button" role="tab" aria-selected={category.id === activeCategory} className={category.id === activeCategory ? "on" : ""} onClick={() => setCategoryId(category.id)}>
                {category.name}
              </button>
            ))}
          </div>
        )}
        <p className="legend">
          <i className="diet diet-veg" /> Veg <i className="diet diet-non_veg" /> Non-veg <i className="diet diet-egg" /> Egg
        </p>
        {loadingMenu && <p className="muted">Loading dishes…</p>}
        {menuError && (
          <p className="form-error" role="alert">
            Couldn't load the menu.{" "}
            <button type="button" onClick={() => (debounced ? results.refetch() : menu.refetch())}>Retry</button>
          </p>
        )}
        {!loadingMenu && !menuError && items.length === 0 && <p className="muted">No dishes match that search.</p>}
        <div className="items">
          {items.map((item) => {
            const count = qtyOf(item.id)
            return (
              <button key={item.id} type="button" className="item" onClick={() => addItem(item)}>
                <i className={`diet diet-${item.dietary}`} aria-hidden />
                <span>
                  <strong>{item.name}</strong>
                  {item.shortCode && <small>{item.shortCode}</small>}
                </span>
                <span className="price">
                  {formatInr(item.pricePaise)}
                  {count > 0 && <em>{count}</em>}
                </span>
              </button>
            )
          })}
        </div>
      </section>
      <aside className={`ticket ${narrow && !ticketOpen ? "collapsed" : ""}`}>
        {narrow && (
          <button type="button" className="ticket-bar" onClick={() => setTicketOpen((open) => !open)}>
            <span>{bill.itemCount === 0 ? "No dishes yet" : `${bill.itemCount} ${bill.itemCount === 1 ? "dish" : "dishes"}`}</span>
            <strong>{formatInr(bill.totalPaise)}</strong>
            <span>{ticketOpen ? "Hide" : "Review"}</span>
          </button>
        )}
        <div className="ticket-body">
          <h2>{editingId === undefined ? "This order" : `Order #${existing.data?.orderNo ?? ""}`}</h2>
          {lines.length === 0 && <p className="muted">Ask the guest, then tap each dish.</p>}
          <ul>
            {lines.map((line) => (
              <li key={line.key}>
                <div className="line-top">
                  <span>{line.name}</span>
                  <strong>{formatInr(line.pricePaise * line.qty)}</strong>
                </div>
                <div className="stepper">
                  <button type="button" aria-label={line.qty === 1 ? `Remove ${line.name}` : `Decrease ${line.name}`} onClick={() => updateLine(line.key, { qty: line.qty - 1 })}>−</button>
                  <span>{line.qty}</span>
                  <button type="button" aria-label={`Increase ${line.name}`} onClick={() => updateLine(line.key, { qty: Math.min(99, line.qty + 1) })}>+</button>
                </div>
                <input value={line.note} onChange={(event) => updateLine(line.key, { note: event.target.value })} placeholder="Note for this dish" aria-label={`Note for ${line.name}`} maxLength={200} />
              </li>
            ))}
          </ul>
          <label className="order-note">
            Order note
            <textarea value={orderNote} onChange={(event) => setOrderNote(event.target.value)} placeholder="Allergy, packing, anything for the kitchen" maxLength={300} rows={2} />
          </label>
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{formatInr(bill.subtotalPaise)}</dd></div>
            <div><dt>GST {session.outlet.taxRateBps / 100}%</dt><dd>{formatInr(bill.taxPaise)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{formatInr(bill.totalPaise)}</dd></div>
          </dl>
          {error && <p className="form-error" role="alert">{error}</p>}
          {save.isError && !error && (
            <p className="form-error" role="alert">
              {save.error instanceof ApiError ? save.error.message : "Couldn't save. Check the connection and try again."}
            </p>
          )}
          <button type="button" className="primary" disabled={lines.length === 0 || save.isPending || !hydrated} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : editingId === undefined ? "Save order" : "Save changes"}
          </button>
          <p className="hint">Saves the ticket. No payment is taken here.</p>
        </div>
      </aside>
    </div>
  )
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 900px)").matches)
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)")
    const onChange = () => setNarrow(media.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])
  return narrow
}
