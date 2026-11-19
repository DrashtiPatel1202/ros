import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ApiError, api, formatInr } from "../api"

type MenuData = Awaited<ReturnType<typeof api.menuAdmin>>
type Dietary = MenuData["items"][number]["dietary"]

export function MenuHome() {
  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">Menu › Menu & Discounts</div>
      <h1 className="page-title">Menu Management</h1>
      <div className="config-grid">
        <Link to="/menus/menu_new/all" className="config-tile">
          <span className="config-tile-icon"><i className="bi bi-grid" /></span>
          <span><strong>All In One Menu</strong><small>Items, categories, taxes and discounts. This is what the POS punches.</small></span>
          <i className="bi bi-chevron-right config-tile-go" />
        </Link>
        <Link to="/menus/item_on_off" className="config-tile">
          <span className="config-tile-icon"><i className="bi bi-toggles" /></span>
          <span><strong>Menu on/off</strong><small>Turn an item off when it runs out. It leaves the billing screen immediately.</small></span>
          <i className="bi bi-chevron-right config-tile-go" />
        </Link>
        <Link to="/menus/menu_new/all?tab=taxes" className="config-tile">
          <span className="config-tile-icon"><i className="bi bi-percent" /></span>
          <span><strong>Taxes</strong><small>GST, VAT and custom taxes. The default tax is what new bills use.</small></span>
          <i className="bi bi-chevron-right config-tile-go" />
        </Link>
      </div>
    </div>
  )
}

export function AllInOneMenu() {
  const [params, setParams] = useSearchParams()
  const tabParam = params.get("tab")
  const tab = tabParam === "categories" || tabParam === "taxes" || tabParam === "discounts" ? tabParam : "items"
  const [data, setData] = useState<MenuData | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [categoryId, setCategoryId] = useState<number | "all">("all")

  async function load() {
    setData(await api.menuAdmin())
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the menu"))
  }, [])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.items ?? []).filter((item) => {
      if (categoryId !== "all" && item.categoryId !== categoryId) return false
      if (!q) return true
      return item.name.toLowerCase().includes(q) || item.shortCode.toLowerCase().includes(q)
    })
  }, [data, query, categoryId])

  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">
        <Link to="/menus/menu_management">Menu Management</Link> › All In One Menu
      </div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="page-title mb-0">All In One Menu</h1>
        <div className="pos-tabs">
          {(["items", "categories", "taxes", "discounts"] as const).map((id) => (
            <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setParams(id === "items" ? {} : { tab: id })}>
              {id[0]!.toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-danger">{error}</p>}
      {!data && !error && <p className="text-muted">Loading menu…</p>}
      {data && tab === "categories" && <CategoryTab data={data} onChange={load} onError={setError} />}
      {data && tab === "items" && (
        <div className="menu-workspace">
          <aside className="menu-rail">
            <button type="button" className={categoryId === "all" ? "on" : ""} onClick={() => setCategoryId("all")}>
              <span>All items</span>
              <small>{data.items.length}</small>
            </button>
            {data.categories.map((category) => (
              <button key={category.id} type="button" className={categoryId === category.id ? "on" : ""} onClick={() => setCategoryId(category.id)}>
                <span>{category.name}</span>
                <small>{category.itemCount}</small>
              </button>
            ))}
          </aside>
          <div>
            <input className="form-control mb-3" placeholder="Name or short code" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ItemForm categories={data.categories} onSaved={load} onError={setError} />
            <div className="card-pp mt-3">
              <table className="table mb-0">
                <thead>
                  <tr><th>Item</th><th>Short code</th><th>Category</th><th>Type</th><th>Price</th><th>POS</th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <ItemRow key={item.id} item={item} categories={data.categories} onSaved={load} onError={setError} />
                  ))}
                  {items.length === 0 && <tr><td colSpan={6} className="empty-state">No items match.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {tab === "taxes" && <TaxTab onError={setError} />}
      {tab === "discounts" && <DiscountTab onError={setError} />}
    </div>
  )
}

function CategoryTab({ data, onChange, onError }: { data: MenuData; onChange: () => Promise<void>; onError: (message: string) => void }) {
  const [name, setName] = useState("")
  return (
    <div className="card-pp">
      <form
        className="d-flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void api.addMenuCategory(name).then(() => { setName(""); return onChange() }).catch((caught) => onError(caught instanceof ApiError ? caught.message : "Could not add"))
        }}
      >
        <input className="form-control" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
      <table className="table mb-0">
        <thead><tr><th>Category</th><th>Items</th><th>Status</th><th /></tr></thead>
        <tbody>
          {data.categories.map((category) => (
            <tr key={category.id}>
              <td>
                <input
                  className="form-control"
                  defaultValue={category.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== category.name) {
                      void api.updateMenuCategory(category.id, { name: e.target.value.trim() }).then(onChange).catch((caught) => onError(caught instanceof ApiError ? caught.message : "Could not rename"))
                    }
                  }}
                />
              </td>
              <td>{category.itemCount}</td>
              <td>{category.active ? "Active" : "Hidden"}</td>
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-link" onClick={() => void api.updateMenuCategory(category.id, { active: !category.active }).then(onChange)}>
                  {category.active ? "Hide" : "Show"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ItemForm({
  categories,
  onSaved,
  onError,
}: {
  categories: MenuData["categories"]
  onSaved: () => Promise<void>
  onError: (message: string) => void
}) {
  const [name, setName] = useState("")
  const [shortCode, setShortCode] = useState("")
  const [price, setPrice] = useState("")
  const [dietary, setDietary] = useState<Dietary>("veg")
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0)
  return (
    <form
      className="card-pp"
      onSubmit={(e) => {
        e.preventDefault()
        void api
          .addMenuItem({
            name,
            categoryId,
            pricePaise: Math.round(Number(price) * 100),
            shortCode,
            dietary,
          })
          .then(() => {
            setName("")
            setShortCode("")
            setPrice("")
            return onSaved()
          })
          .catch((caught) => onError(caught instanceof ApiError ? caught.message : "Could not add the item"))
      }}
    >
      <div className="row g-2">
        <div className="col-md-3"><input className="form-control" placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="col-md-2"><input className="form-control" placeholder="Short code" value={shortCode} onChange={(e) => setShortCode(e.target.value)} /></div>
        <div className="col-md-2">
          <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.filter((category) => category.active).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={dietary} onChange={(e) => setDietary(e.target.value as Dietary)}>
            <option value="veg">Veg</option>
            <option value="non_veg">Non-veg</option>
            <option value="egg">Egg</option>
          </select>
        </div>
        <div className="col-md-2"><input className="form-control" placeholder="Price ₹" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
        <div className="col-md-1"><button className="btn btn-primary w-100" type="submit">Add</button></div>
      </div>
    </form>
  )
}

function ItemRow({
  item,
  categories,
  onSaved,
  onError,
}: {
  item: MenuData["items"][number]
  categories: MenuData["categories"]
  onSaved: () => Promise<void>
  onError: (message: string) => void
}) {
  const category = categories.find((row) => row.id === item.categoryId)
  return (
    <tr>
      <td>{item.name}</td>
      <td>{item.shortCode || "—"}</td>
      <td>{category?.name ?? "—"}</td>
      <td>{item.dietary === "non_veg" ? "Non-veg" : item.dietary === "egg" ? "Egg" : "Veg"}</td>
      <td>{formatInr(item.pricePaise)}</td>
      <td>
        <button
          type="button"
          className={`btn btn-sm ${item.available ? "btn-success" : "btn-outline-secondary"}`}
          onClick={() =>
            void api.updateMenuItem(item.id, { available: !item.available }).then(onSaved).catch((caught) => onError(caught instanceof ApiError ? caught.message : "Could not update"))
          }
        >
          {item.available ? "On" : "Off"}
        </button>
      </td>
    </tr>
  )
}

function TaxTab({ onError }: { onError: (message: string) => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.taxes>>["rows"]>([])
  const [title, setTitle] = useState("GST 18%")
  const [rate, setRate] = useState("18")
  const [kind, setKind] = useState<"gst" | "vat" | "custom">("gst")

  async function load() {
    setRows((await api.taxes()).rows)
  }
  useEffect(() => {
    void load().catch((caught) => onError(caught instanceof Error ? caught.message : "Could not load taxes"))
  }, [])

  return (
    <div className="card-pp">
      <p className="text-muted">The default tax is applied to every new bill. Item-level tax assignment can be added later without changing this list.</p>
      <form
        className="row g-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void api
            .addTax({ title, kind, mode: "forward", rateBps: Math.round(Number(rate) * 100), isDefault: false })
            .then(() => load())
            .catch((caught) => onError(caught instanceof ApiError ? caught.message : "Could not add the tax"))
        }}
      >
        <div className="col-md-4"><input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" /></div>
        <div className="col-md-2">
          <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="gst">GST</option>
            <option value="vat">VAT</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="col-md-2"><input className="form-control" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate %" /></div>
        <div className="col-md-2"><button className="btn btn-primary" type="submit">Add tax</button></div>
      </form>
      <table className="table mb-0">
        <thead><tr><th>Title</th><th>Kind</th><th>Rate</th><th>Bill</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.title}</td>
              <td>{row.kind.toUpperCase()} · {row.mode}</td>
              <td>{(row.rateBps / 100).toFixed(2)}%</td>
              <td>{row.isDefault ? "Default" : "—"}</td>
              <td className="text-end">
                {!row.isDefault && row.active && (
                  <button type="button" className="btn btn-sm btn-link" onClick={() => void api.updateTax(row.id, { isDefault: true }).then(load)}>
                    Make default
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-link" onClick={() => void api.updateTax(row.id, { active: !row.active }).then(load)}>
                  {row.active ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiscountTab({ onError }: { onError: (message: string) => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.discounts>>["rows"]>([])
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<"percentage" | "fixed">("percentage")
  const [amount, setAmount] = useState("10")

  async function load() {
    setRows((await api.discounts()).rows)
  }
  useEffect(() => {
    void load().catch((caught) => onError(caught instanceof Error ? caught.message : "Could not load discounts"))
  }, [])

  return (
    <div className="card-pp">
      <p className="text-muted">Percentage and fixed offers show up on the billing screen. BOGO and freebie types are reserved in the database for the next pass.</p>
      <form
        className="row g-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          const body = kind === "percentage"
            ? { title, kind, rateBps: Math.round(Number(amount) * 100) }
            : { title, kind, amountPaise: Math.round(Number(amount) * 100) }
          void api.addDiscount(body).then(() => { setTitle(""); return load() }).catch((caught) => onError(caught instanceof ApiError ? caught.message : "Could not add"))
        }}
      >
        <div className="col-md-4"><input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Offer name" required /></div>
        <div className="col-md-2">
          <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed ₹</option>
          </select>
        </div>
        <div className="col-md-2"><input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="col-md-2"><button className="btn btn-primary" type="submit">Add offer</button></div>
      </form>
      <table className="table mb-0">
        <thead><tr><th>Offer</th><th>Type</th><th>Value</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.title}</td>
              <td>{row.kind === "percentage" ? "Percentage" : "Fixed"}</td>
              <td>{row.kind === "percentage" ? `${(row.rateBps ?? 0) / 100}%` : formatInr(row.amountPaise ?? 0)}</td>
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-link" onClick={() => void api.updateDiscount(row.id, !row.active).then(load)}>
                  {row.active ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="empty-state">No offers yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export function MenuOnOff() {
  const [data, setData] = useState<MenuData | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  async function load() {
    setData(await api.menuAdmin())
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [])
  const q = query.trim().toLowerCase()
  const items = (data?.items ?? []).filter((item) => !q || item.name.toLowerCase().includes(q))
  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">
        <Link to="/menus/menu_management">Menu Management</Link> › Menu on/off
      </div>
      <h1 className="page-title">Menu on/off</h1>
      {error && <p className="text-danger">{error}</p>}
      <input className="form-control mb-3" style={{ maxWidth: 320 }} placeholder="Search item" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Item</th><th>Category</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{data?.categories.find((category) => category.id === item.categoryId)?.name}</td>
                <td>
                  <button
                    type="button"
                    className={`btn btn-sm ${item.available ? "btn-success" : "btn-outline-secondary"}`}
                    onClick={() => void api.updateMenuItem(item.id, { available: !item.available }).then(load)}
                  >
                    {item.available ? "Available" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
