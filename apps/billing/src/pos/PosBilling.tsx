import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  ApiError,
  api,
  formatInr,
  formatTableSeat,
  type PosAction,
  type PosBootstrap,
  type PosOrderType,
  type PosPaymentType,
} from "../api"
import { PosKotScreen, PosRunningScreen } from "./PosOps"

function formatTax(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

type CartLine = {
  key: string
  menuItemId: number
  name: string
  pricePaise: number
  dietary: "veg" | "non_veg" | "egg"
  qty: number
  note: string
  variantId?: number
  addonIds?: number[]
}

type Screen = "tables" | "billing" | "kots" | "running"
type Slip = "kot" | "bill" | null

function moneySummary(lines: CartLine[], taxRateBps: number, discountPaise: number) {
  const subtotalPaise = lines.reduce((sum, line) => sum + line.pricePaise * line.qty, 0)
  const discount = Math.min(Math.max(0, discountPaise), subtotalPaise)
  const taxable = Math.max(0, subtotalPaise - discount)
  const taxPaise = Math.round((taxable * taxRateBps) / 10_000)
  const cgst = Math.floor(taxPaise / 2)
  return {
    itemCount: lines.reduce((sum, line) => sum + line.qty, 0),
    subtotalPaise,
    discountPaise: discount,
    taxPaise,
    cgstPaise: cgst,
    sgstPaise: taxPaise - cgst,
    totalPaise: taxable + taxPaise,
  }
}

export function PosBilling() {
  const [params] = useSearchParams()
  const editFromUrl = params.get("edit") ? Number(params.get("edit")) : undefined

  const [boot, setBoot] = useState<PosBootstrap | null>(null)
  const [bootError, setBootError] = useState("")
  const [screen, setScreen] = useState<Screen>("tables")
  const [area, setArea] = useState<string>("")
  const [lines, setLines] = useState<CartLine[]>([])
  const [orderType, setOrderType] = useState<PosOrderType>("dine_in")
  const [tableLabel, setTableLabel] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [pax, setPax] = useState(1)
  const [orderNote, setOrderNote] = useState("")
  const [discountRupees, setDiscountRupees] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [paymentType, setPaymentType] = useState<PosPaymentType>("cash")
  const [paidRupees, setPaidRupees] = useState("")
  const [orderId, setOrderId] = useState<number | null>(null)
  const [orderNo, setOrderNo] = useState<number | null>(null)
  const [version, setVersion] = useState<number | null>(null)
  const [kotNo, setKotNo] = useState<number | null>(null)
  const [slip, setSlip] = useState<Slip>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [picker, setPicker] = useState<PosBootstrap["items"][number] | null>(null)
  const [pickVariant, setPickVariant] = useState<number | null>(null)
  const [pickAddons, setPickAddons] = useState<number[]>([])
  const saveKey = useRef<string | null>(null)
  const inflight = useRef(false)

  async function loadBoot() {
    const data = await api.posBootstrap()
    setBoot(data)
    setCategoryId((current) => current ?? data.categories[0]?.id ?? null)
    setArea((current) => current || data.tables[0]?.area || "")
    return data
  }

  useEffect(() => {
    let cancelled = false
    loadBoot()
      .then((data) => {
        if (cancelled) return
        if (editFromUrl) void hydrate(editFromUrl, data)
        else {
          setOrderType(data.settings.defaultOrderType)
          if (data.settings.defaultScreen === "billing") setScreen("billing")
        }
      })
      .catch((caught) => {
        if (!cancelled) setBootError(caught instanceof Error ? caught.message : "Could not load POS")
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (screen !== "tables") return
    let stop = false
    api
      .posBootstrap()
      .then((data) => {
        if (!stop) setBoot(data)
      })
      .catch(() => {})
    return () => {
      stop = true
    }
  }, [screen])

  async function hydrate(id: number, data = boot) {
    const order = await api.posOrder(id)
    if (!["saved", "printed"].includes(order.status)) {
      setError("That order is already closed.")
      setScreen("tables")
      return
    }
    const byId = new Map((data?.items ?? []).map((item) => [item.id, item]))
    setOrderType(order.orderType)
    setTableLabel(order.tableLabel ?? "")
    setCustomerName(order.customerName ?? "")
    setCustomerPhone(order.customerPhone ?? "")
    setPax(order.pax)
    setOrderNote(order.note ?? "")
    setDiscountRupees(order.discountPaise ? String(order.discountPaise / 100) : "")
    setOrderId(order.id)
    setOrderNo(order.orderNo)
    setVersion(order.version)
    setKotNo(order.kotNo)
    setLines(
      order.lines.map((line, index) => ({
        key: `${line.menuItemId}:${index}`,
        menuItemId: line.menuItemId,
        name: line.name,
        pricePaise: line.unitPricePaise,
        dietary: byId.get(line.menuItemId)?.dietary ?? "veg",
        qty: line.qty,
        note: line.note ?? "",
      })),
    )
    setScreen("billing")
    setError("")
  }

  const discountPaise = Math.round((Number(discountRupees) || 0) * 100)
  const bill = useMemo(
    () => moneySummary(lines, boot?.outlet.taxRateBps ?? 500, discountPaise),
    [lines, boot?.outlet.taxRateBps, discountPaise],
  )
  const halfRate = ((boot?.outlet.taxRateBps ?? 500) / 2 / 100).toFixed(2).replace(/\.00$/, "")

  const filteredItems = useMemo(() => {
    if (!boot) return []
    const q = search.trim().toLowerCase()
    return boot.items.filter((item) => {
      if (q) {
        return item.name.toLowerCase().includes(q) || (item.shortCode?.toLowerCase().includes(q) ?? false)
      }
      return categoryId == null || item.categoryId === categoryId
    })
  }, [boot, categoryId, search])

  function addItem(item: PosBootstrap["items"][number]) {
    if ((item.variants?.length ?? 0) > 0 || (item.addonGroups?.length ?? 0) > 0) {
      setPicker(item)
      setPickVariant(item.variants?.[0]?.id ?? null)
      setPickAddons([])
      return
    }
    pushItem(item, item.name, item.pricePaise)
  }

  function pushItem(item: PosBootstrap["items"][number], name: string, pricePaise: number, variantId?: number, addonIds?: number[]) {
    setError("")
    setNotice("")
    setLines((current) => {
      const extras = (addonIds ?? []).slice().sort().join(",")
      const blank = boot?.settings.mergeDuplicateItems
        ? current.find((line) => line.menuItemId === item.id && line.note === "" && (line.variantId ?? 0) === (variantId ?? 0) && (line.addonIds ?? []).slice().sort().join(",") === extras)
        : undefined
      if (blank) {
        if (blank.qty >= 99) return current
        return current.map((line) => (line.key === blank.key ? { ...line, qty: line.qty + 1 } : line))
      }
      return [
        ...current,
        {
          key: `${item.id}:${crypto.randomUUID()}`,
          menuItemId: item.id,
          name,
          pricePaise,
          dietary: item.dietary,
          qty: 1,
          note: "",
          variantId,
          addonIds,
        },
      ]
    })
  }

  function confirmPicker() {
    if (!picker) return
    const variant = picker.variants?.find((row) => row.id === pickVariant)
    if ((picker.variants?.length ?? 0) > 0 && !variant) {
      setError("Choose a variation.")
      return
    }
    const chosen = (picker.addonGroups ?? []).flatMap((group) => group.items.filter((item) => pickAddons.includes(item.id)))
    for (const group of picker.addonGroups ?? []) {
      const count = group.items.filter((item) => pickAddons.includes(item.id)).length
      if (count < group.minSelect || count > group.maxSelect) {
        setError(`${group.name} needs ${group.minSelect} to ${group.maxSelect}.`)
        return
      }
    }
    const price = (variant?.pricePaise ?? picker.pricePaise) + chosen.reduce((sum, item) => sum + item.pricePaise, 0)
    const name = `${picker.name}${variant ? ` (${variant.name})` : ""}${chosen.length ? ` + ${chosen.map((item) => item.name).join(", ")}` : ""}`
    pushItem(picker, name, price, variant?.id, chosen.map((item) => item.id))
    setPicker(null)
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setLines((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line]
        const next = { ...line, ...patch }
        return next.qty < 1 ? [] : [next]
      }),
    )
  }

  function blankBill(nextTable = "") {
    const letter = nextTable.slice(-1)
    setLines([])
    setTableLabel(nextTable)
    setCustomerName(nextTable.length > 1 && /^[A-Z]$/.test(letter) ? `Guest ${letter}` : "")
    setCustomerPhone("")
    setPax(1)
    setOrderNote("")
    setDiscountRupees("")
    setSearch("")
    setError("")
    setOrderId(null)
    setOrderNo(null)
    setVersion(null)
    setKotNo(null)
    saveKey.current = null
  }

  function draftPayload() {
    return {
      orderType,
      tableLabel: tableLabel.trim() || undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      pax,
      note: orderNote.trim() || undefined,
      discountPaise: discountPaise || undefined,
      lines: lines.map((line) => ({
        menuItemId: line.menuItemId,
        qty: line.qty,
        note: line.note.trim() || undefined,
        variantId: line.variantId,
        addonIds: line.addonIds,
      })),
    }
  }

  async function submit(
    action: PosAction,
    opts?: { payment?: { paymentType: PosPaymentType; paidPaise: number }; then?: "stay" | "tables"; slip?: Slip },
  ) {
    if (!boot || inflight.current) return
    if (lines.length === 0) {
      setError("Add at least one item.")
      return
    }
    if (orderType === "dine_in" && !tableLabel.trim()) {
      setError("Select a table for dine in.")
      setScreen("tables")
      return
    }
    inflight.current = true
    setBusy(true)
    setError("")
    try {
      const payment = opts?.payment
      const saved =
        orderId && version != null
          ? await api.posUpdateOrder(orderId, {
              ...draftPayload(),
              version,
              action,
              paymentType: payment?.paymentType,
              paidPaise: payment?.paidPaise,
            })
          : await api.posCreateOrder({
              ...draftPayload(),
              action,
              paymentType: payment?.paymentType,
              paidPaise: payment?.paidPaise,
              idempotencyKey: (saveKey.current ??= crypto.randomUUID()),
            })
      saveKey.current = null
      setOrderId(saved.id)
      if (saved.tableLabel) setTableLabel(saved.tableLabel)
      if (saved.customerName) setCustomerName(saved.customerName)
      setOrderNo(saved.orderNo)
      setVersion(saved.version)
      setKotNo(saved.kotNo)
      const label =
        action === "settle"
          ? `Settled #${saved.orderNo}`
          : action === "kot"
            ? `KOT ${saved.kotNo ?? ""} sent for #${saved.orderNo}`
            : action === "kot_print" || action === "save_print"
              ? `Bill #${saved.orderNo} printed`
              : `Saved #${saved.orderNo}`
      setNotice(label)
      setSettleOpen(false)
      await loadBoot()
      if (opts?.slip) setSlip(opts.slip)
      if (opts?.then === "tables" || action === "settle") {
        blankBill()
        setScreen("tables")
        setNotice(label)
      }
    } catch (caught) {
      saveKey.current = null
      setError(caught instanceof ApiError ? caught.message : "Could not save the order.")
    } finally {
      inflight.current = false
      setBusy(false)
    }
  }

  function openSettle() {
    if (lines.length === 0) {
      setError("Add at least one item.")
      return
    }
    setPaymentType("cash")
    setPaidRupees((bill.totalPaise / 100).toFixed(2))
    setSettleOpen(true)
  }

  function seatNext(table: PosBootstrap["tables"][number]) {
    const next = nextCover(table.tableNo, table.covers.map((cover) => cover.letter))
    if (!next) {
      setError("Every guest letter on this table is already open.")
      return
    }
    startTable(next, null)
  }

  function startTable(tableNo: string, existingId: number | null) {
    setError("")
    if (existingId) {
      void hydrate(existingId).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not open table"))
      return
    }
    blankBill(tableNo)
    setOrderType("dine_in")
    setScreen("billing")
  }

  function switchType(type: PosOrderType) {
    setOrderType(type)
    setError("")
    if (type === "dine_in" && !tableLabel && !orderId) setScreen("tables")
    else setScreen("billing")
  }

  if (bootError) {
    return (
      <div className="poss-boot">
        <p>{bootError}</p>
        <button type="button" className="poss-btn blue" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }
  if (!boot) return <div className="poss-boot">Opening Restaurant Order Management…</div>

  const areas = [...new Set(boot.tables.map((t) => t.area))]
  const paidPaise = Math.round((Number(paidRupees) || 0) * 100)
  const changePaise = Math.max(0, paidPaise - bill.totalPaise)
  const activeArea = area || areas[0] || ""

  return (
    <div className="poss">
      <aside className="poss-rail">
        <div className="poss-mark">P</div>
        <button type="button" className={screen === "billing" ? "on" : ""} onClick={() => setScreen("billing")} title="Billing">
          <i className="bi bi-receipt" />
          <span>Billing</span>
        </button>
        <button type="button" className={screen === "tables" ? "on" : ""} onClick={() => setScreen("tables")} title="Tables">
          <i className="bi bi-grid-3x3-gap" />
          <span>Tables</span>
        </button>
        <button type="button" className={screen === "kots" ? "on" : ""} onClick={() => setScreen("kots")} title="KOT">
          <i className="bi bi-printer" />
          <span>KOT</span>
        </button>
        <button type="button" className={screen === "running" ? "on" : ""} onClick={() => setScreen("running")} title="Running orders">
          <i className="bi bi-list-ul" />
          <span>Orders</span>
        </button>
        <a className="rail-end" href="/users/dashboard" title="Back office">
          <i className="bi bi-box-arrow-left" />
          <span>Office</span>
        </a>
      </aside>

      <div className="poss-main">
        <header className="poss-head">
          <div className="poss-outlet">
            <strong>{boot.outlet.name}</strong>
            <small>{boot.outlet.billerName}</small>
          </div>
          <div className="poss-types" role="radiogroup" aria-label="Order type">
            {(["dine_in", "delivery", "pickup"] as const)
              .filter((id) => boot.settings.showOrderTypes[id])
              .map((id) => ({ id, label: boot.settings.orderTypeLabels[id] }))
              .map((type) => (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={orderType === type.id}
                className={`otype otype-${type.id} ${orderType === type.id ? "on" : ""}`}
                onClick={() => switchType(type.id)}
              >
                {type.label}
              </button>
            ))}
          </div>
          <div className="poss-head-meta">
            {orderNo != null && <span className="poss-billno">Bill #{orderNo}</span>}
            {kotNo != null && <span className="poss-kotno">KOT {kotNo}</span>}
            {tableLabel && orderType === "dine_in" && <span className="poss-tableno">{formatTableSeat(tableLabel)}</span>}
          </div>
        </header>

        {notice && <div className="poss-toast">{notice}</div>}

        {screen === "kots" ? (
          <PosKotScreen timeZone={boot.outlet.timezone} onOpenOrder={(id) => void hydrate(id)} />
        ) : screen === "running" ? (
          <PosRunningScreen timeZone={boot.outlet.timezone} onOpenOrder={(id) => void hydrate(id)} />
        ) : screen === "tables" ? (
          <section className="poss-floor">
            <div className="poss-floor-bar">
              <h1>Table Management</h1>
              <div className="poss-areas">
                {areas.map((name) => (
                  <button key={name} type="button" className={activeArea === name ? "on" : ""} onClick={() => setArea(name)}>
                    {name}
                  </button>
                ))}
              </div>
              <div className="poss-legend">
                <span><i className="dot free" /> Blank</span>
                <span><i className="dot running" /> Running</span>
                <span><i className="dot printed" /> Printed</span>
              </div>
              <p className="poss-guest-hint">Letters are separate guests. Table 1 can have A, B, C, and D open at the same time.</p>
            </div>
            {boot.tables.some((table) => table.area === activeArea && table.placed) ? (
              <>
              <div className="poss-canvas">
                {boot.barriers.map((barrier) => (
                  <div key={barrier.id} className="fp-barrier" style={{ left: barrier.x, top: barrier.y, width: barrier.width, height: barrier.height }} />
                ))}
                {boot.tables
                  .filter((table) => table.area === activeArea && table.placed)
                  .map((table) => (
                    <div
                      key={table.id}
                      className={`fp-shape live ${table.shape} ${tableTone(table)}`}
                      style={{ left: table.x, top: table.y, width: table.width, height: table.height, fontSize: table.textSize }}
                    >
                      <button type="button" onClick={() => seatNext(table)}>
                        <span>{table.tableNo}</span>
                        {table.covers.length > 0 && <small>{table.covers.length} guests</small>}
                      </button>
                      <CoverRow table={table} onOpen={startTable} />
                    </div>
                  ))}
              </div>
              {boot.tables.some((table) => table.area === activeArea && !table.placed) && (
                <div className="poss-floor-grid">
                  {boot.tables
                    .filter((table) => table.area === activeArea && !table.placed)
                    .map((t) => (
                      <div key={t.id} className={`floor-table ${tableTone(t)}`}>
                        <button type="button" className="floor-table-main" onClick={() => seatNext(t)}>
                          <strong>{t.tableNo}</strong>
                          <small>{t.seats} seats</small>
                          {t.covers.length > 0 ? <em>{t.covers.length} {t.covers.length === 1 ? "guest" : "guests"}</em> : <em>Blank</em>}
                        </button>
                        <CoverRow table={t} onOpen={startTable} />
                      </div>
                    ))}
                </div>
              )}
              </>
            ) : (
              <div className="poss-floor-grid">
                {boot.tables
                  .filter((t) => t.area === activeArea)
                  .map((t) => (
                    <div key={t.id} className={`floor-table ${tableTone(t)}`}>
                      <button type="button" className="floor-table-main" onClick={() => seatNext(t)}>
                        <strong>{t.tableNo}</strong>
                        <small>{t.seats} seats</small>
                        {t.covers.length > 0 ? <em>{t.covers.length} {t.covers.length === 1 ? "guest" : "guests"}</em> : <em>Blank</em>}
                      </button>
                      <CoverRow table={t} onOpen={startTable} />
                    </div>
                  ))}
              </div>
            )}
          </section>
        ) : (
          <div className="poss-billing">
            <nav className="poss-cats">
              <button
                type="button"
                className={!search && categoryId == null ? "on" : ""}
                onClick={() => {
                  setSearch("")
                  setCategoryId(null)
                }}
              >
                All
              </button>
              {boot.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={!search && categoryId === cat.id ? "on" : ""}
                  onClick={() => {
                    setSearch("")
                    setCategoryId(cat.id)
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </nav>

            <section className="poss-items-pane">
              <div className="poss-search">
                <i className="bi bi-search" />
                <input
                  placeholder="Item name / short code"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
                {orderType === "dine_in" && (
                  <button type="button" className="poss-table-chip" onClick={() => setScreen("tables")}>
                    {tableLabel ? formatTableSeat(tableLabel) : "Select table"}
                  </button>
                )}
                {orderId != null && orderType === "dine_in" && (
                  <button type="button" className="poss-table-chip" onClick={() => setMoveOpen(true)}>
                    Move table
                  </button>
                )}
              </div>
              <div className="poss-items">
                {filteredItems.map((item) => (
                  <button key={item.id} type="button" className="poss-item" onClick={() => addItem(item)}>
                    <span className={`mark mark-${item.dietary}`} aria-hidden />
                    <span className="iname">{item.name}</span>
                    {item.shortCode && <span className="icode">{item.shortCode}</span>}
                    {boot.settings.showItemPrice && <span className="iprice">{formatInr(item.pricePaise)}</span>}
                  </button>
                ))}
                {filteredItems.length === 0 && <p className="poss-empty">No items match.</p>}
              </div>
            </section>

            <aside className="poss-invoice">
              <div className="poss-inv-head">Current order</div>
              <div className="poss-guest">
                <label>
                  Customer name
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </label>
                <label>
                  Mobile no.
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel" />
                </label>
                <label>
                  No. of persons
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={pax}
                    onChange={(e) => setPax(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </label>
              </div>

              <div className="poss-lines">
                <div className="poss-line head">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Amount</span>
                </div>
                {lines.length === 0 && <p className="poss-empty">Select items to punch the bill</p>}
                {lines.map((line) => (
                  <div key={line.key} className="poss-line-block">
                    <div className="poss-line">
                      <span className="lname">
                        <i className={`mark mark-${line.dietary}`} />
                        {line.name}
                      </span>
                      <span className="lqty">
                        <button type="button" onClick={() => updateLine(line.key, { qty: line.qty - 1 })}>−</button>
                        {line.qty}
                        <button type="button" onClick={() => updateLine(line.key, { qty: Math.min(99, line.qty + 1) })}>+</button>
                      </span>
                      <span>{formatInr(line.pricePaise)}</span>
                      <span>{formatInr(line.pricePaise * line.qty)}</span>
                    </div>
                    <input
                      className="lnote"
                      placeholder="Special note"
                      value={line.note}
                      onChange={(e) => updateLine(line.key, { note: e.target.value })}
                    />
                  </div>
                ))}
              </div>

              <label className="poss-note">
                {boot.settings.orderInfoLabel}
                <input value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
              </label>
              {boot.discounts.length > 0 && (
                <label className="poss-note">
                  Offer
                  <select
                    value=""
                    onChange={(e) => {
                      const offer = boot.discounts.find((row) => String(row.id) === e.target.value)
                      if (!offer) return
                      const subtotal = lines.reduce((sum, line) => sum + line.pricePaise * line.qty, 0)
                      const paise = offer.kind === "percentage"
                        ? Math.round((subtotal * (offer.rateBps ?? 0)) / 10_000)
                        : offer.amountPaise ?? 0
                      setDiscountRupees(paise ? String(paise / 100) : "")
                    }}
                  >
                    <option value="">Choose an offer</option>
                    {boot.discounts.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.title}
                        {offer.kind === "percentage" ? ` · ${(offer.rateBps ?? 0) / 100}%` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="poss-note">
                {boot.settings.discountLabel} (₹)
                <input value={discountRupees} onChange={(e) => setDiscountRupees(e.target.value)} inputMode="decimal" />
              </label>

              <dl className="poss-sum">
                <div><dt>Sub total</dt><dd>{formatInr(bill.subtotalPaise)}</dd></div>
                <div><dt>Discount</dt><dd>{formatInr(bill.discountPaise)}</dd></div>
                <div><dt>CGST {halfRate}%</dt><dd>{formatTax(bill.cgstPaise)}</dd></div>
                <div><dt>SGST {halfRate}%</dt><dd>{formatTax(bill.sgstPaise)}</dd></div>
              </dl>
              <div className="poss-grand">
                <span>Grand total</span>
                <strong>{formatInr(bill.totalPaise)}</strong>
              </div>
              {error && <p className="poss-error">{error}</p>}

              <div className="poss-actions">
                <button type="button" className="poss-btn grey" disabled={busy} onClick={() => void submit("save", { then: "tables" })}>
                  Hold
                </button>
                <button type="button" className="poss-btn kot" disabled={busy || lines.length === 0} onClick={() => void submit("kot", { slip: "kot" })}>
                  KOT
                </button>
                <button type="button" className="poss-btn kot-print" disabled={busy || lines.length === 0} onClick={() => void submit("kot_print", { slip: "bill" })}>
                  KOT &amp; Print
                </button>
                <button type="button" className="poss-btn grey" disabled={busy || lines.length === 0} onClick={() => void submit("save")}>
                  Save
                </button>
                <button type="button" className="poss-btn blue" disabled={busy || lines.length === 0} onClick={() => void submit("save_print", { slip: "bill" })}>
                  Save &amp; Print
                </button>
                <button type="button" className="poss-btn green" disabled={busy || lines.length === 0} onClick={openSettle}>
                  Settle
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>

      {moveOpen && (
        <div className="poss-modal" role="dialog" aria-modal="true" aria-label="Move table">
          <div className="poss-dialog">
            <header>
              <h2>Move table</h2>
              <button type="button" onClick={() => setMoveOpen(false)} aria-label="Close">×</button>
            </header>
            <p>{tableLabel ? formatTableSeat(tableLabel) : "Current guest"}. Pick another table. This guest keeps their own bill and sits as the next free letter.</p>
            <div className="poss-floor-grid">
              {boot.tables
                .filter((table) => table.tableNo !== tableNoOf(tableLabel))
                .map((table) => {
                  const next = nextCover(table.tableNo, table.covers.map((cover) => cover.letter))
                  return (
                  <button
                    key={table.id}
                    type="button"
                    className={`floor-table ${table.covers.length ? "running" : "free"}`}
                    disabled={busy || version == null || orderId == null || !next}
                    onClick={() => {
                      if (orderId == null || version == null || !next) return
                      setBusy(true)
                      void api
                        .posMoveTable(orderId, version, next)
                        .then(async (moved) => {
                          setTableLabel(moved.tableLabel ?? next)
                          if (moved.customerName) setCustomerName(moved.customerName)
                          setVersion(moved.version)
                          setNotice(`Moved to ${formatTableSeat(moved.tableLabel ?? next)}`)
                          setMoveOpen(false)
                          await loadBoot()
                        })
                        .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not move the table"))
                        .finally(() => setBusy(false))
                    }}
                  >
                    <strong>{table.tableNo}</strong>
                    <small>{table.area} · next {next ? next.slice(table.tableNo.length) : "—"}</small>
                  </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {picker && (
          <div className="poss-modal" role="dialog" aria-modal="true" aria-label="Item options">
            <div className="poss-modal-card">
              <header>
                <h2>{picker.name}</h2>
                <button type="button" onClick={() => setPicker(null)} aria-label="Close">×</button>
              </header>
              {(picker.variants ?? []).length > 0 && (
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {picker.variants!.map((variant) => (
                    <button key={variant.id} type="button" className={`poss-btn ${pickVariant === variant.id ? "blue" : "grey"}`} onClick={() => setPickVariant(variant.id)}>
                      {variant.name} {formatInr(variant.pricePaise)}
                    </button>
                  ))}
                </div>
              )}
              {(picker.addonGroups ?? []).map((group) => (
                <div key={group.id} className="mb-3">
                  <div className="fw-semibold">{group.name}</div>
                  {group.items.map((addon) => (
                    <label key={addon.id} className="d-flex gap-2 align-items-center">
                      <input
                        type="checkbox"
                        checked={pickAddons.includes(addon.id)}
                        onChange={(event) => {
                          setPickAddons((current) => {
                            if (!event.target.checked) return current.filter((id) => id !== addon.id)
                            const inGroup = group.items.filter((item) => current.includes(item.id)).length
                            if (inGroup >= group.maxSelect) return current
                            return [...current, addon.id]
                          })
                        }}
                      />
                      <span>{addon.name} {addon.pricePaise ? formatInr(addon.pricePaise) : ""}</span>
                    </label>
                  ))}
                </div>
              ))}
              <button type="button" className="poss-btn green" onClick={confirmPicker}>Add</button>
            </div>
          </div>
        )}
      {settleOpen && (
        <div className="poss-modal" role="dialog" aria-modal="true" aria-label="Settle">
          <div className="poss-dialog">
            <header>
              <h2>Settle &amp; Save</h2>
              <button type="button" onClick={() => setSettleOpen(false)} aria-label="Close">×</button>
            </header>
            <p className="settle-due">Amount due <strong>{formatInr(bill.totalPaise)}</strong></p>
            <div className="poss-pay">
              {(boot.settings.paymentButtons.length ? boot.settings.paymentButtons : (["cash", "card", "upi", "due"] as PosPaymentType[])).map((type) => (
                <button key={type} type="button" className={paymentType === type ? "on" : ""} onClick={() => setPaymentType(type)}>
                  {type === "due" ? "Due" : type === "upi" ? "UPI" : type[0]!.toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            <label>
              Customer paid (₹)
              <input value={paidRupees} onChange={(e) => setPaidRupees(e.target.value)} inputMode="decimal" />
            </label>
            <p>Change {formatInr(changePaise)}</p>
            <div className="poss-dialog-actions">
              <button type="button" className="poss-btn grey" onClick={() => setSettleOpen(false)}>Back</button>
              <button
                type="button"
                className="poss-btn green"
                disabled={busy || paidPaise < bill.totalPaise}
                onClick={() => void submit("settle", { payment: { paymentType, paidPaise }, then: "tables" })}
              >
                {busy ? "Settling…" : "Settle & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {slip && (
        <div className="poss-modal" role="dialog" aria-modal="true">
          <div className="poss-dialog slip">
            <header>
              <h2>{slip === "kot" ? "KOT" : "Bill"}</h2>
              <button type="button" onClick={() => setSlip(null)} aria-label="Close">×</button>
            </header>
            <div className="thermal" id="poss-slip">
              <strong>{boot.outlet.name}</strong>
              <p>{slip === "kot" ? `KOT ${kotNo ?? ""}` : `Bill #${orderNo ?? ""}`}</p>
              <p>
                {orderType === "dine_in" ? formatTableSeat(tableLabel) : orderType === "pickup" ? "Pick Up" : "Delivery"}
                {customerName ? ` · ${customerName}` : ""}
              </p>
              <ul>
                {lines.map((line) => (
                  <li key={line.key}>
                    <span>{line.qty} x {line.name}{line.note ? ` (${line.note})` : ""}</span>
                    {slip === "bill" && <span>{formatInr(line.pricePaise * line.qty)}</span>}
                  </li>
                ))}
              </ul>
              {slip === "bill" && (
                <>
                  <p>Sub total {formatInr(bill.subtotalPaise)}</p>
                  <p>CGST {formatTax(bill.cgstPaise)} · SGST {formatTax(bill.sgstPaise)}</p>
                  <p className="thermal-total">Grand total {formatInr(bill.totalPaise)}</p>
                </>
              )}
            </div>
            <div className="poss-dialog-actions">
              <button type="button" className="poss-btn grey" onClick={() => setSlip(null)}>Close</button>
              <button type="button" className="poss-btn blue" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function nextCover(tableNo: string, letters: string[]) {
  const used = new Set(letters)
  for (let index = 0; index < 26; index += 1) {
    const letter = String.fromCharCode(65 + index)
    if (!used.has(letter)) return `${tableNo}${letter}`
  }
  return null
}

function tableNoOf(label: string) {
  const letter = label.slice(-1)
  const tableNo = label.slice(0, -1)
  return tableNo && /^[A-Z]$/.test(letter) ? tableNo : label
}

function tableTone(table: PosBootstrap["tables"][number]) {
  if (table.covers.length === 0 && !table.occupied) return "free"
  if (table.covers.some((cover) => cover.status !== "printed") || table.status === "saved") return "running"
  return "printed"
}

function seatLetters(table: PosBootstrap["tables"][number]) {
  const count = Math.max(table.seats, table.covers.length, 1)
  const letters = new Set<string>()
  for (let index = 0; index < Math.min(26, count); index += 1) letters.add(String.fromCharCode(65 + index))
  for (const cover of table.covers) letters.add(cover.letter)
  return [...letters].sort()
}

function CoverRow({
  table,
  onOpen,
}: {
  table: PosBootstrap["tables"][number]
  onOpen: (label: string, orderId: number | null) => void
}) {
  const open = new Map(table.covers.map((cover) => [cover.letter, cover]))
  const letters = seatLetters(table)
  const next = nextCover(table.tableNo, table.covers.map((cover) => cover.letter))
  const nextLetter = next ? next.slice(table.tableNo.length) : null
  return (
    <div className="floor-covers" aria-label={`Guests at table ${table.tableNo}`}>
      {letters.map((letter) => {
        const cover = open.get(letter)
        return (
          <button
            key={letter}
            type="button"
            className={cover ? (cover.status === "printed" ? "printed" : "running") : "free"}
            title={cover ? `${cover.customerName || `Guest ${letter}`} · Bill #${cover.orderNo}` : `Seat guest ${letter}`}
            onClick={() => onOpen(cover ? cover.label : `${table.tableNo}${letter}`, cover?.orderId ?? null)}
          >
            {letter}
          </button>
        )
      })}
      {next && nextLetter && !letters.includes(nextLetter) && (
        <button type="button" className="add" title={`Add guest ${nextLetter}`} onClick={() => onOpen(next, null)}>
          +
        </button>
      )}
    </div>
  )
}
