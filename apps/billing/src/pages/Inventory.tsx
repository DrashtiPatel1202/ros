import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ApiError, api, formatInr } from "../api"

const LINKS = [
  { label: "Dashboard", path: "/inventory_dashboard/new_inventory_dashboard" },
  { label: "Raw materials", path: "/inventories/rm_list/all" },
  { label: "Current stock", path: "/inventories/new_item_stock_list" },
  { label: "Purchase", path: "/inventories/purchase_list" },
  { label: "Purchase order", path: "/inventories/purchase_order_list" },
  { label: "Wastage", path: "/inventories/wastage_list" },
  { label: "Closing stock", path: "/inventories/new_manual_stock" },
  { label: "Recipes", path: "/inventories/inv_recipe_list" },
  { label: "Suppliers", path: "/inventories/supplier_management" },
  { label: "Settings", path: "/inventories/inventoy_setting" },
]

export function InventoryPage() {
  const { pathname } = useLocation()
  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">Inventory</div>
      <nav className="inv-subnav">
        {LINKS.map((link) => (
          <Link key={link.path} to={link.path} className={pathname === link.path ? "on" : ""}>
            {link.label}
          </Link>
        ))}
      </nav>
      {pathname.endsWith("new_inventory_dashboard") && <InventoryHome />}
      {pathname.endsWith("rm_list/all") && <Materials />}
      {pathname.endsWith("new_item_stock_list") && <Stock />}
      {pathname.endsWith("purchase_list") && <DocScreen type="purchase" title="Stock Purchase" needsSupplier />}
      {pathname.endsWith("purchase_order_list") && <DocScreen type="purchase_order" title="Purchase Order" needsSupplier />}
      {pathname.endsWith("wastage_list") && <DocScreen type="wastage" title="Wastage" />}
      {pathname.endsWith("new_manual_stock") && <DocScreen type="closing" title="Closing Stock" counted />}
      {pathname.endsWith("inv_recipe_list") && <Recipes />}
      {pathname.endsWith("supplier_management") && <Suppliers />}
      {pathname.endsWith("inventoy_setting") && <Settings />}
    </div>
  )
}

function InventoryHome() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.inventory>> | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    void api.inventory().then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load inventory"))
  }, [])
  if (error) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-muted">Loading inventory…</p>
  return (
    <>
      <h1 className="page-title">Inventory</h1>
      <div className="kpi-row">
        <div className="kpi-card"><span>Inventory value</span><strong>{formatInr(data.stockValuePaise)}</strong></div>
        <div className="kpi-card"><span>Raw materials</span><strong>{data.materialCount}</strong></div>
        <div className="kpi-card"><span>At or below minimum</span><strong>{data.lowStockCount}</strong></div>
      </div>
      <div className="card-pp mt-3">
        <h2 className="h6">Recent documents</h2>
        <table className="table mb-0">
          <thead><tr><th>Type</th><th>No.</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>
            {data.recent.map((row) => (
              <tr key={row.id}><td>{labelType(row.type)}</td><td>{row.docNo}</td><td>{row.businessDate}</td><td>{row.status}</td><td>{formatInr(row.totalPaise)}</td></tr>
            ))}
            {data.recent.length === 0 && <tr><td colSpan={5} className="empty-state">No purchases or wastage yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Materials() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.inventoryMaterials>> | null>(null)
  const [name, setName] = useState("")
  const [unitId, setUnitId] = useState(0)
  const [categoryName, setCategoryName] = useState("")
  const [minQty, setMinQty] = useState("0")
  const [error, setError] = useState("")

  async function load() {
    const next = await api.inventoryMaterials()
    setData(next)
    setUnitId((current) => current || next.units[0]?.id || 0)
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [])

  return (
    <>
      <h1 className="page-title">Raw materials</h1>
      {error && <p className="text-danger">{error}</p>}
      <form
        className="card-pp mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void (async () => {
            let categoryId: number | null = null
            if (categoryName.trim()) categoryId = (await api.addInventoryCategory(categoryName.trim())).id
            await api.addMaterial({ name, unitId, categoryId, minQty: Number(minQty) || 0 })
            setName("")
            await load()
          })().catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not add"))
        }}
      >
        <div className="row g-2">
          <div className="col-md-3"><input className="form-control" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Category" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} /></div>
          <div className="col-md-2">
            <select className="form-select" value={unitId} onChange={(e) => setUnitId(Number(e.target.value))}>
              {data?.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </div>
          <div className="col-md-2"><input className="form-control" placeholder="Min qty" value={minQty} onChange={(e) => setMinQty(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary" type="submit">Add</button></div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Material</th><th>Category</th><th>Unit</th><th>On hand</th><th>Avg cost</th><th /></tr></thead>
          <tbody>
            {data?.materials.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.categoryName || "—"}</td>
                <td>{row.unitName}</td>
                <td>{row.onHand}</td>
                <td>{formatInr(row.avgCostPaise)}</td>
                <td className="text-end">
                  <button type="button" className="btn btn-sm btn-link" onClick={() => void api.updateMaterial(row.id, { active: !row.active }).then(load)}>
                    {row.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Stock() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.inventoryMaterials>>["materials"]>([])
  useEffect(() => {
    void api.inventoryMaterials().then((data) => setRows(data.materials.filter((row) => row.active)))
  }, [])
  return (
    <>
      <h1 className="page-title">Current stock</h1>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Material</th><th>On hand</th><th>Minimum</th><th>Avg cost</th><th>Value</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.minQty > 0 && row.onHand <= row.minQty ? "table-warning" : ""}>
                <td>{row.name}</td>
                <td>{row.onHand} {row.unitName}</td>
                <td>{row.minQty}</td>
                <td>{formatInr(row.avgCostPaise)}</td>
                <td>{formatInr(Math.round(row.onHand * row.avgCostPaise))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function DocScreen({
  type,
  title,
  needsSupplier,
  counted,
}: {
  type: "purchase" | "purchase_order" | "wastage" | "closing"
  title: string
  needsSupplier?: boolean
  counted?: boolean
}) {
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof api.inventoryDocs>>["rows"]>([])
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof api.inventoryMaterials>>["materials"]>([])
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([])
  const [materialId, setMaterialId] = useState(0)
  const [supplierId, setSupplierId] = useState(0)
  const [qty, setQty] = useState("1")
  const [cost, setCost] = useState("0")
  const [error, setError] = useState("")

  async function load() {
    const [list, stock, parties] = await Promise.all([
      api.inventoryDocs(type),
      api.inventoryMaterials(),
      needsSupplier ? api.suppliers() : Promise.resolve({ rows: [] }),
    ])
    setDocs(list.rows)
    setMaterials(stock.materials.filter((row) => row.active))
    setMaterialId((current) => current || stock.materials[0]?.id || 0)
    setSuppliers(parties.rows)
    setSupplierId((current) => current || parties.rows[0]?.id || 0)
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [type])

  return (
    <>
      <h1 className="page-title">{title}</h1>
      {error && <p className="text-danger">{error}</p>}
      <form
        className="card-pp mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void api
            .addInventoryDoc({
              type,
              supplierId: needsSupplier ? supplierId : null,
              lines: [{ materialId, qty: Number(qty), unitCostPaise: Math.round(Number(cost) * 100) }],
            })
            .then(load)
            .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not save"))
        }}
      >
        <div className="row g-2">
          {needsSupplier && (
            <div className="col-md-3">
              <select className="form-select" value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
                {suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </div>
          )}
          <div className="col-md-3">
            <select className="form-select" value={materialId} onChange={(e) => setMaterialId(Number(e.target.value))}>
              {materials.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <div className="col-md-2"><input className="form-control" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={counted ? "Counted qty" : "Qty"} /></div>
          {type !== "wastage" && type !== "closing" && (
            <div className="col-md-2"><input className="form-control" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Rate ₹" /></div>
          )}
          <div className="col-md-2"><button className="btn btn-primary" type="submit">Save</button></div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>No.</th><th>Date</th><th>Party</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>
            {docs.map((row) => (
              <tr key={row.id}><td>{row.docNo}</td><td>{row.businessDate}</td><td>{row.supplierName || "—"}</td><td>{row.status}</td><td>{formatInr(row.totalPaise)}</td></tr>
            ))}
            {docs.length === 0 && <tr><td colSpan={5} className="empty-state">Nothing saved yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Recipes() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.recipes>>["items"]>([])
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof api.inventoryMaterials>>["materials"]>([])
  const [itemId, setItemId] = useState(0)
  const [materialId, setMaterialId] = useState(0)
  const [qty, setQty] = useState("0.05")
  const [error, setError] = useState("")

  async function load() {
    const [recipes, stock] = await Promise.all([api.recipes(), api.inventoryMaterials()])
    setItems(recipes.items)
    setMaterials(stock.materials.filter((row) => row.active))
    setItemId((current) => current || recipes.items[0]?.id || 0)
    setMaterialId((current) => current || stock.materials[0]?.id || 0)
  }
  useEffect(() => {
    void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load"))
  }, [])

  const current = items.find((item) => item.id === itemId)

  return (
    <>
      <h1 className="page-title">Item recipes</h1>
      <p className="text-muted">Quantity is per one dish, in the raw material’s unit. Settled bills deduct this when auto consumption is on.</p>
      {error && <p className="text-danger">{error}</p>}
      <div className="card-pp mb-3">
        <select className="form-select mb-3" value={itemId} onChange={(e) => setItemId(Number(e.target.value))}>
          {items.map((item) => <option key={item.id} value={item.id}>{item.category} · {item.name}</option>)}
        </select>
        <ul>
          {(current?.lines ?? []).map((line) => <li key={line.materialId}>{line.name} · {line.qty}</li>)}
          {current && current.lines.length === 0 && <li className="text-muted">No recipe yet.</li>}
        </ul>
        <form
          className="row g-2"
          onSubmit={(e) => {
            e.preventDefault()
            const lines = [...(current?.lines ?? []).filter((line) => line.materialId !== materialId), { materialId, qty: Number(qty) }]
            void api.saveRecipe(itemId, lines.map((line) => ({ materialId: line.materialId, qty: line.qty }))).then(load)
              .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not save"))
          }}
        >
          <div className="col-md-5">
            <select className="form-select" value={materialId} onChange={(e) => setMaterialId(Number(e.target.value))}>
              {materials.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <div className="col-md-3"><input className="form-control" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary" type="submit">Save line</button></div>
        </form>
      </div>
    </>
  )
}

function Suppliers() {
  const [rows, setRows] = useState<{ id: number; name: string; company: string; phone: string }[]>([])
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [phone, setPhone] = useState("")
  async function load() {
    setRows((await api.suppliers()).rows)
  }
  useEffect(() => {
    void load()
  }, [])
  return (
    <>
      <h1 className="page-title">Suppliers</h1>
      <form
        className="card-pp mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          void api.addSupplier({ name, company, phone }).then(() => { setName(""); return load() })
        }}
      >
        <div className="row g-2">
          <div className="col-md-3"><input className="form-control" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary" type="submit">Add</button></div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Name</th><th>Company</th><th>Phone</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.company || "—"}</td><td>{row.phone || "—"}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}

function Settings() {
  const [form, setForm] = useState({ autoConsumption: true, revertOnCancel: true, avgCosting: true })
  const [notice, setNotice] = useState("")
  useEffect(() => {
    void api.inventory().then((data) => setForm(data.settings))
  }, [])
  return (
    <>
      <h1 className="page-title">Inventory settings</h1>
      <form
        className="card-pp"
        onSubmit={(e) => {
          e.preventDefault()
          void api.saveInventorySettings(form).then(() => setNotice("Saved"))
        }}
      >
        <label className="form-check mb-2">
          <input className="form-check-input" type="checkbox" checked={form.autoConsumption} onChange={(e) => setForm({ ...form, autoConsumption: e.target.checked })} />
          <span className="form-check-label">Deduct recipe quantities when a bill is settled</span>
        </label>
        <label className="form-check mb-3">
          <input className="form-check-input" type="checkbox" checked={form.avgCosting} onChange={(e) => setForm({ ...form, avgCosting: e.target.checked })} />
          <span className="form-check-label">Weighted average cost on purchases</span>
        </label>
        <button className="btn btn-primary" type="submit">Save</button>
        {notice && <span className="text-success ms-3">{notice}</span>}
      </form>
    </>
  )
}

function labelType(type: string) {
  if (type === "purchase_order") return "Purchase order"
  if (type === "closing") return "Closing stock"
  return type[0]!.toUpperCase() + type.slice(1)
}
