import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ApiError, api, type OutletConfig } from "../api"

const GROUPS: { title: string; cards: { label: string; path: string; blurb: string; icon: string }[] }[] = [
  {
    title: "Outlet Information",
    cards: [
      { label: "Outlet Details", path: "/users/resdetails/1", blurb: "Name, address, FSSAI, tax authority", icon: "bi-shop" },
      { label: "Contact Details", path: "/users/res_contact/1", blurb: "Owner, manager and biller phones", icon: "bi-telephone" },
      { label: "Outlet Timings", path: "/users/res_timing/1", blurb: "Closing hour, slots, delivery window", icon: "bi-clock" },
      { label: "Payment", path: "/users/res_cpt_nqr/1", blurb: "Currency, custom types, cards, UPI", icon: "bi-credit-card" },
      { label: "Invoice Sequence", path: "/users/res_invoice_list/1", blurb: "Bill number series", icon: "bi-123" },
      { label: "Floor Plan", path: "/users/floor_plan", blurb: "Areas and tables", icon: "bi-grid-3x3-gap" },
    ],
  },
  {
    title: "Billing Screen",
    cards: [
      { label: "Display", path: "/users/billing_display_setting/1", blurb: "Order types, payment buttons, defaults", icon: "bi-display" },
      { label: "Print logo", path: "/users/pos_configuration/1", blurb: "Name printed on the bill", icon: "bi-image" },
      { label: "Calculations", path: "/users/billing_calculations/1", blurb: "Tax, round-off, service and packing", icon: "bi-calculator" },
      { label: "Connected Services", path: "/users/connected_services/1", blurb: "Day end, cash drawer, KDS, e-invoice", icon: "bi-plug" },
      { label: "Print (Bill & KOT)", path: "/users/bill_kot_setting/1", blurb: "What prints on the ticket and the bill", icon: "bi-printer" },
    ],
  },
  {
    title: "Online / Advance Order",
    cards: [
      { label: "Customer", path: "/users/res_other_setting/1", blurb: "Phone rules per order type", icon: "bi-person" },
      { label: "Online / Advance Order", path: "/users/pending_order_setting/1", blurb: "Auto accept, prep time, minimum order", icon: "bi-bag" },
    ],
  },
  {
    title: "System Setting",
    cards: [
      { label: "Billing System", path: "/users/res_system/1", blurb: "Sync, edit window, idle logout", icon: "bi-gear" },
      { label: "SMS / Notification", path: "/users/res_notification_system/1", blurb: "Daily sales message", icon: "bi-bell" },
    ],
  },
]

export function ConfigHub() {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        cards: group.cards.filter((card) => !q || `${card.label} ${card.blurb}`.toLowerCase().includes(q)),
      })).filter((group) => group.cards.length > 0),
    [q],
  )

  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">Management › Configuration › Outlet Configuration</div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="page-title mb-0">Outlet Configuration</h1>
        <input
          className="form-control"
          style={{ maxWidth: 320 }}
          placeholder="Search configurations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {groups.map((group) => (
        <section key={group.title} className="config-group">
          <h2>{group.title}</h2>
          <div className="config-grid">
            {group.cards.map((card) => (
              <Link key={card.path} to={card.path} className="config-tile">
                <span className="config-tile-icon"><i className={`bi ${card.icon}`} /></span>
                <span>
                  <strong>{card.label}</strong>
                  <small>{card.blurb}</small>
                </span>
                <i className="bi bi-chevron-right config-tile-go" />
              </Link>
            ))}
          </div>
        </section>
      ))}
      <p className="text-muted">
        Also in the sidebar:{" "}
        <Link to="/items/sub_order_type_list">Sub Order Type</Link>,{" "}
        <Link to="/items/delivery_distance_list">Delivery Distance</Link>,{" "}
        <Link to="/users/area_wise_delivery_charge_list">Area delivery charges</Link>.
      </p>
    </div>
  )
}

type SectionId = keyof OutletConfig["settings"]

const TITLES: Record<string, string> = {
  outlet: "Outlet Details",
  contact: "Contact Details",
  timings: "Outlet Timings",
  payment: "Payment",
  invoices: "Invoice Sequence",
  display: "Display",
  printLogo: "Print logo",
  calculations: "Calculations",
  connected: "Connected Services",
  print: "Print (Bill & KOT)",
  customer: "Customer",
  online: "Online / Advance Order",
  system: "Billing System",
  notification: "SMS / Notification",
}

export function ConfigSection({ section }: { section: SectionId }) {
  const navigate = useNavigate()
  const [data, setData] = useState<OutletConfig | null>(null)
  const [draft, setDraft] = useState<unknown>(null)
  const [outletName, setOutletName] = useState("")
  const [timezone, setTimezone] = useState("Asia/Kolkata")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .config()
      .then((cfg) => {
        setData(cfg)
        setDraft(structuredClone(cfg.settings[section]))
        setOutletName(cfg.outletName)
        setTimezone(cfg.timezone)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load configuration"))
  }, [section])

  async function save() {
    setBusy(true)
    setError("")
    try {
      const saved = await api.saveConfig({
        section,
        value: draft,
        ...(section === "outlet" ? { outletName, timezone } : {}),
      })
      setData((current) => (current ? { ...current, settings: saved.settings, outletName, timezone } : current))
      setNotice("Saved")
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-pad">
      <div className="breadcrumb-pp">
        <button type="button" className="btn btn-link p-0" onClick={() => navigate("/users/res_new/1")}>
          Outlet Configuration
        </button>{" "}
        › {TITLES[section]}
      </div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="page-title mb-0">{TITLES[section]}</h1>
        <button type="button" className="btn btn-primary" disabled={busy || !data} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-danger">{error}</p>}
      {notice && <p className="text-success">{notice}</p>}
      {data && draft != null && (
        <div className="card-pp">
          <SectionForm
            section={section}
            draft={draft}
            setDraft={setDraft}
            outletName={outletName}
            setOutletName={setOutletName}
            timezone={timezone}
            setTimezone={setTimezone}
          />
        </div>
      )}
    </div>
  )
}

function SectionForm({
  section,
  draft,
  setDraft,
  outletName,
  setOutletName,
  timezone,
  setTimezone,
}: {
  section: SectionId
  draft: unknown
  setDraft: (value: unknown) => void
  outletName: string
  setOutletName: (value: string) => void
  timezone: string
  setTimezone: (value: string) => void
}) {
  if (section === "outlet") {
    const row = draft as OutletConfig["settings"]["outlet"]
    const set = (key: string, value: string) => setDraft({ ...row, [key]: value })
    return (
      <>
        <section className="form-section">
          <h3>Outlet information</h3>
          <div className="row g-3">
            <Field label="Outlet name" value={outletName} onChange={setOutletName} />
            <Field label="Alias" value={row.alias} onChange={(v) => set("alias", v)} />
            <Field label="Email" value={row.email} onChange={(v) => set("email", v)} />
            <Field label="Timezone" value={timezone} onChange={setTimezone} />
          </div>
        </section>
        <section className="form-section">
          <h3>Address</h3>
          <div className="row g-3">
            <Field label="Country" value={row.country} onChange={(v) => set("country", v)} />
            <Field label="State" value={row.state} onChange={(v) => set("state", v)} />
            <Field label="City" value={row.city} onChange={(v) => set("city", v)} />
            <Field label="Zip code" value={row.zip} onChange={(v) => set("zip", v)} />
            <Field label="Address" value={row.address} onChange={(v) => set("address", v)} />
            <Field label="Area" value={row.area} onChange={(v) => set("area", v)} />
            <Field label="Landmark" value={row.landmark} onChange={(v) => set("landmark", v)} />
            <Field label="Latitude" value={row.lat} onChange={(v) => set("lat", v)} />
            <Field label="Longitude" value={row.lng} onChange={(v) => set("lng", v)} />
          </div>
        </section>
        <section className="form-section">
          <h3>Additional information</h3>
          <div className="row g-3">
            <Select label="Operation type" value={row.operationType} options={["COCO", "COFO", "FOCO", "FOFO"]} onChange={(v) => set("operationType", v)} />
            <Field label="Cuisines" value={row.cuisines} onChange={(v) => set("cuisines", v)} />
            <Select label="Seating" value={row.seating} options={["1-10", "10-50", "50-100", "100+"]} onChange={(v) => set("seating", v)} />
            <Select label="Restaurant type" value={row.restaurantType} options={["Fine Dine", "QSR", "Cafe", "Cloud Kitchen", "Bar"]} onChange={(v) => set("restaurantType", v)} />
            <Field label="FSSAI" value={row.fssai} onChange={(v) => set("fssai", v)} />
            <Field label="Tax authority" value={row.taxAuthority} onChange={(v) => set("taxAuthority", v)} />
            <Select label="Supply type" value={row.supplyType} options={["Service", "Goods", "Both"]} onChange={(v) => set("supplyType", v)} />
          </div>
        </section>
      </>
    )
  }
  if (section === "contact") return <RecordForm draft={draft as Record<string, string>} labels={{ ownerMobile: "Owner mobile", managerPhone: "Manager phone", decisionMaker: "Decision maker", directNumber: "Direct number", billerName: "Biller name", billerPhone: "Biller phone" }} onChange={setDraft} />
  if (section === "timings") {
    const row = draft as OutletConfig["settings"]["timings"]
    return (
      <div className="row g-3">
        <Field label="Closing hour" value={row.closingHour} onChange={(v) => setDraft({ ...row, closingHour: v })} />
        <Toggle label="Open 24×7" checked={row.is24x7} onChange={(v) => setDraft({ ...row, is24x7: v })} />
        <Field label="Delivery from" value={row.deliveryFrom} onChange={(v) => setDraft({ ...row, deliveryFrom: v })} />
        <Field label="Delivery to" value={row.deliveryTo} onChange={(v) => setDraft({ ...row, deliveryTo: v })} />
      </div>
    )
  }
  if (section === "payment") {
    const row = draft as OutletConfig["settings"]["payment"]
    return (
      <div className="row g-3">
        <Field label="Currency" value={row.currency} onChange={(v) => setDraft({ ...row, currency: v })} />
        <Field label="Custom payment types" value={row.customTypes.join(", ")} onChange={(v) => setDraft({ ...row, customTypes: splitList(v) })} />
        <Field label="Card options" value={row.cardOptions.join(", ")} onChange={(v) => setDraft({ ...row, cardOptions: splitList(v) })} />
        <Field label="UPI providers" value={row.upiProviders.join(", ")} onChange={(v) => setDraft({ ...row, upiProviders: splitList(v) })} />
      </div>
    )
  }
  if (section === "invoices") {
    const rows = draft as OutletConfig["settings"]["invoices"]
    return (
      <div>
        {rows.map((row, index) => (
          <div key={index} className="row g-2 mb-2">
            <div className="col-md-3"><input className="form-control" value={row.name} onChange={(e) => updateInvoice(rows, index, { name: e.target.value }, setDraft)} /></div>
            <div className="col-md-2"><input className="form-control" value={row.prefix} onChange={(e) => updateInvoice(rows, index, { prefix: e.target.value }, setDraft)} /></div>
            <div className="col-md-2"><input className="form-control" type="number" value={row.nextNo} onChange={(e) => updateInvoice(rows, index, { nextNo: Number(e.target.value) }, setDraft)} /></div>
            <div className="col-md-2 form-check mt-2">
              <input className="form-check-input" type="checkbox" checked={row.active} onChange={(e) => updateInvoice(rows, index, { active: e.target.checked }, setDraft)} />
              <label className="form-check-label">Active</label>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setDraft([...rows, { name: "New", prefix: "", nextNo: 1, active: true }])}>
          Add sequence
        </button>
      </div>
    )
  }
  if (section === "display") {
    const row = draft as OutletConfig["settings"]["display"]
    return (
      <div className="row g-3">
        <Select label="Default screen" value={row.defaultScreen} options={["tables", "billing"]} onChange={(v) => setDraft({ ...row, defaultScreen: v })} />
        <Select label="UI mode" value={row.uiMode} options={["touch", "keyboard"]} onChange={(v) => setDraft({ ...row, uiMode: v })} />
        <Field label="Dine In label" value={row.dineInLabel} onChange={(v) => setDraft({ ...row, dineInLabel: v })} />
        <Field label="Pick Up label" value={row.pickupLabel} onChange={(v) => setDraft({ ...row, pickupLabel: v })} />
        <Field label="Delivery label" value={row.deliveryLabel} onChange={(v) => setDraft({ ...row, deliveryLabel: v })} />
        <Toggle label="Show Dine In" checked={row.showDineIn} onChange={(v) => setDraft({ ...row, showDineIn: v })} />
        <Toggle label="Show Pick Up" checked={row.showPickup} onChange={(v) => setDraft({ ...row, showPickup: v })} />
        <Toggle label="Show Delivery" checked={row.showDelivery} onChange={(v) => setDraft({ ...row, showDelivery: v })} />
        <Field label="Payment buttons" value={row.paymentButtons.join(", ")} onChange={(v) => setDraft({ ...row, paymentButtons: splitList(v) })} />
        <Toggle label="Merge duplicate items" checked={row.mergeDuplicateItems} onChange={(v) => setDraft({ ...row, mergeDuplicateItems: v })} />
        <Toggle label="Save KOT on save bill" checked={row.saveKotOnSaveBill} onChange={(v) => setDraft({ ...row, saveKotOnSaveBill: v })} />
        <Toggle label="Show item price" checked={row.showItemPrice} onChange={(v) => setDraft({ ...row, showItemPrice: v })} />
        <Toggle label="No. of persons mandatory" checked={row.personsMandatory} onChange={(v) => setDraft({ ...row, personsMandatory: v })} />
        <Field label="Discount label" value={row.discountLabel} onChange={(v) => setDraft({ ...row, discountLabel: v })} />
        <Field label="Order information label" value={row.orderInfoLabel} onChange={(v) => setDraft({ ...row, orderInfoLabel: v })} />
      </div>
    )
  }
  if (section === "printLogo") {
    const row = draft as OutletConfig["settings"]["printLogo"]
    return <Field label="Bill caption" value={row.caption} onChange={(v) => setDraft({ caption: v })} />
  }
  if (section === "notification") {
    const row = draft as OutletConfig["settings"]["notification"]
    return <Toggle label="Send daily sales SMS" checked={row.dailySalesSms} onChange={(v) => setDraft({ dailySalesSms: v })} />
  }
  return <GenericForm draft={draft as Record<string, unknown>} onChange={setDraft} />
}

function GenericForm({ draft, onChange }: { draft: Record<string, unknown>; onChange: (value: unknown) => void }) {
  return (
    <div className="row g-3">
      {Object.entries(draft).map(([key, value]) => {
        if (typeof value === "boolean") {
          return <Toggle key={key} label={labelize(key)} checked={value} onChange={(next) => onChange({ ...draft, [key]: next })} />
        }
        return (
          <Field
            key={key}
            label={labelize(key)}
            value={String(value)}
            onChange={(next) => onChange({ ...draft, [key]: typeof value === "number" ? Number(next) : next })}
          />
        )
      })}
    </div>
  )
}

function RecordForm({
  draft,
  labels,
  onChange,
}: {
  draft: Record<string, string>
  labels: Record<string, string>
  onChange: (value: unknown) => void
}) {
  return (
    <div className="row g-3">
      {Object.keys(labels).map((key) => (
        <Field key={key} label={labels[key]!} value={draft[key] ?? ""} onChange={(value) => onChange({ ...draft, [key]: value })} />
      ))}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="col-md-4 field">
      <span>{label}</span>
      <input className="form-control" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="col-md-4 field">
      <span>{label}</span>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="col-md-4 form-check mt-4">
      <input className="form-check-input" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="form-check-label">{label}</span>
    </label>
  )
}

function splitList(value: string) {
  return value.split(",").map((part) => part.trim()).filter(Boolean)
}

function labelize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
}

function updateInvoice(
  rows: OutletConfig["settings"]["invoices"],
  index: number,
  patch: Partial<OutletConfig["settings"]["invoices"][number]>,
  setDraft: (value: unknown) => void,
) {
  setDraft(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}
