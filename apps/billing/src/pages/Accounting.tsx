import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { api, formatInr } from "../api"
import { errText, MgmtShell, rupeesToPaise, today, when } from "./mgmtUi"

const PAYMENT_STATUS = [
  ["customer_paid", "Customer Paid"],
  ["provider_initiated", "Provider Payment Initiated"],
  ["provider_done", "Provider Payment Done"],
  ["transfer_initiated", "Transfer Initiated To Bank"],
  ["transferred", "Transferred To Bank"],
  ["failed", "Failed Transaction"],
  ["refunded", "Refunded To Customer"],
] as const

const INVOICE_TABS = [
  ["pg", "PG Transactions"],
  ["swipe", "Swiping Transactions"],
  ["mdr", "MDR Transactions"],
  ["hardware", "Hardware"],
  ["deposit", "Security Deposit"],
  ["monthly", "Monthly Invoices"],
  ["ledger", "Restaurant Ledgers"],
] as const

export function AccountingPage() {
  const { pathname } = useLocation()
  if (pathname.endsWith("reconcilation_list")) return <Payments />
  if (pathname.endsWith("virtual_wallet_list")) return <Wallet />
  if (pathname.endsWith("reconciliation_list_new")) return <Recon />
  if (pathname.endsWith("gst_information")) return <Gst />
  if (pathname.endsWith("bank_detail_listing")) return <Banks />
  if (pathname.endsWith("expense_list")) return <Expenses />
  if (pathname.endsWith("invoice_credit_service_list")) return <Invoices />
  if (pathname.endsWith("loan_invoice_list")) return <Loans />
  return <Denominations />
}

function Payments() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.payments>> | null>(null)
  const [status, setStatus] = useState("")
  const [provider, setProvider] = useState("")
  const [orderNo, setOrderNo] = useState("")
  const [error, setError] = useState("")
  async function load() {
    setData(await api.payments({ status, provider, orderNo }))
  }
  useEffect(() => {
    void load().catch((caught) => setError(errText(caught, "Could not load payments")))
  }, [])
  const max = Math.max(1, ...(data?.daily.map((day) => day.amountPaise) ?? [1]))
  return (
    <MgmtShell crumb="Accounting › Payment Information" title="Payment Information">
      {error && <p className="text-danger">{error}</p>}
      <div className="card-pp mb-3">
        <h2 className="h6">Last 15 days</h2>
        <div className="pay-bars">
          {(data?.daily ?? []).map((day) => (
            <span key={day.date} title={`${day.date} ${formatInr(day.amountPaise)}`} style={{ height: `${Math.max(4, (day.amountPaise / max) * 100)}%` }} />
          ))}
          {data && data.daily.length === 0 && <p className="text-muted mb-0">No card, UPI, or other digital settlements in the last 15 days.</p>}
        </div>
        <form className="row g-2 mt-3" onSubmit={(e) => { e.preventDefault(); void load() }}>
          <div className="col-md-3">
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {PAYMENT_STATUS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="">All providers</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-md-2"><input className="form-control" placeholder="Order no." value={orderNo} onChange={(e) => setOrderNo(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary" type="submit">Search</button></div>
        </form>
      </div>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Order</th><th>Date</th><th>Provider</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {(data?.rows ?? []).length === 0 && <tr><td colSpan={5} className="text-muted">No digital payments match.</td></tr>}
            {data?.rows.map((row) => (
              <tr key={row.orderId}>
                <td>#{row.orderNo}</td>
                <td>{row.businessDate}</td>
                <td className="text-uppercase">{row.provider}</td>
                <td>{formatInr(row.amountPaise)}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={row.status}
                    onChange={(e) => void api.setPaymentStatus(row.orderId, e.target.value).then(load).catch((caught) => setError(errText(caught, "Could not update")))}
                  >
                    {PAYMENT_STATUS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

function Wallet() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.wallet>> | null>(null)
  const [phone, setPhone] = useState("")
  const [cardNo, setCardNo] = useState("")
  const [holder, setHolder] = useState("")
  const [search, setSearch] = useState("")
  const [password, setPassword] = useState("")
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")
  async function load(filter = search) {
    setData(await api.wallet(filter))
  }
  useEffect(() => {
    void load("").catch((caught) => setError(errText(caught, "Could not load wallets")))
  }, [])
  return (
    <MgmtShell crumb="Accounting › Virtual Wallet" title="Virtual Wallet">
      {error && <p className="text-danger">{error}</p>}
      <div className="card-pp mb-3">
        <form className="row g-2" onSubmit={(e) => { e.preventDefault(); void api.issueWallet({ phone, cardNo, holderName: holder }).then(() => { setPhone(""); setCardNo(""); setHolder(""); return load() }).catch((caught) => setError(errText(caught, "Could not issue the card"))) }}>
          <div className="col-md-3"><input className="form-control" placeholder="Customer mobile" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Card no." value={cardNo} onChange={(e) => setCardNo(e.target.value)} required /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Name" value={holder} onChange={(e) => setHolder(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary" type="submit">Issue card</button></div>
        </form>
        <form className="row g-2 mt-2" onSubmit={(e) => { e.preventDefault(); void load() }}>
          <div className="col-md-3"><input className="form-control" placeholder="Search mobile" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-outline-primary" type="submit">Search</button></div>
          <div className="col-md-3"><input className="form-control" type="password" placeholder="Password to reset balances" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="col-md-3">
            <button className="btn btn-outline-danger" type="button" onClick={() => void api.resetWallets(password).then(() => { setPassword(""); return load() }).catch((caught) => setError(errText(caught, "Reset failed")))}>
              Reset balances
            </button>
          </div>
        </form>
      </div>
      <div className="card-pp mb-3">
        <table className="table mb-0">
          <thead><tr><th>Mobile</th><th>Card</th><th>Name</th><th>Balance</th><th>Status</th><th /></tr></thead>
          <tbody>
            {(data?.cards ?? []).length === 0 && <tr><td colSpan={6} className="text-muted">No wallet cards.</td></tr>}
            {data?.cards.map((card) => (
              <tr key={card.id}>
                <td>{card.phone}</td>
                <td>{card.cardNo}</td>
                <td>{card.holderName || "—"}</td>
                <td>{formatInr(card.balancePaise)}</td>
                <td>{card.status}</td>
                <td className="text-end">
                  <button type="button" className="btn btn-sm btn-link" onClick={() => applyMove(card.id, "topup")}>Top up</button>
                  <button type="button" className="btn btn-sm btn-link" onClick={() => applyMove(card.id, "redeem")}>Redeem</button>
                  <button type="button" className="btn btn-sm btn-link" onClick={() => void api.updateWallet(card.id, { excludeReset: !card.excludeReset }).then(() => load())}>
                    {card.excludeReset ? "Include in reset" : "Exclude from reset"}
                  </button>
                  <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => void api.updateWallet(card.id, { status: card.status === "block" ? "active" : "block", reason: "Changed from wallet list" }).then(() => load())}>
                    {card.status === "block" ? "Unblock" : "Block"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-pp">
        <h2 className="h6">Recent movements</h2>
        <table className="table mb-0">
          <thead><tr><th>When</th><th>Mobile</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody>
            {(data?.txns ?? []).map((txn) => (
              <tr key={txn.id}><td>{when(txn.createdAt)}</td><td>{txn.phone}</td><td>{txn.kind}</td><td>{formatInr(txn.amountPaise)}</td><td>{txn.note}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )

  function applyMove(id: number, kind: "topup" | "redeem") {
    const paise = rupeesToPaise(amount)
    if (!paise) return setError("Enter an amount greater than zero.")
    void api.moveWallet(id, { kind, amountPaise: paise }).then(() => load()).catch((caught) => setError(errText(caught, "Could not update the wallet")))
  }
}

function Recon() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.recon>> | null>(null)
  const [orderRef, setOrderRef] = useState("")
  const [channel, setChannel] = useState("zomato")
  const [fromEmail, setFromEmail] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  async function load() { setData(await api.recon()) }
  useEffect(() => { void load().catch((caught) => setError(errText(caught, "Could not load reconciliation"))) }, [])
  return (
    <MgmtShell crumb="Accounting › Online Order Reconciliation" title="Online Order Reconciliation">
      {error && <p className="text-danger">{error}</p>}
      {data && !data.aggregatorConnected && (
        <div className="alert alert-warning">Zomato and Swiggy are not enabled for this outlet. Delivery bills are listed so a mismatch can still be raised. Turn the aggregators on under Marketplace.</div>
      )}
      <div className="card-pp mb-3">
        <h2 className="h6">Raise dispute</h2>
        <form className="row g-2" onSubmit={(e) => { e.preventDefault(); void api.addDispute({ orderRef, channel, fromEmail, note }).then(() => { setOrderRef(""); setNote(""); return load() }).catch((caught) => setError(errText(caught, "Could not raise the dispute"))) }}>
          <div className="col-md-2"><input className="form-control" placeholder="Order ref" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} required /></div>
          <div className="col-md-2">
            <select className="form-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="zomato">Zomato</option>
              <option value="swiggy">Swiggy</option>
              <option value="website">Website</option>
            </select>
          </div>
          <div className="col-md-3"><input className="form-control" type="email" placeholder="From email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} required /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Mismatch note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary" type="submit">Raise</button></div>
        </form>
      </div>
      <div className="card-pp mb-3">
        <table className="table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th>Payment</th><th>Amount</th></tr></thead>
          <tbody>
            {(data?.orders ?? []).length === 0 && <tr><td colSpan={5} className="text-muted">No settled delivery bills.</td></tr>}
            {data?.orders.map((row) => (
              <tr key={row.orderId}><td>#{row.orderNo}</td><td>{row.businessDate}</td><td>{row.customerName || "—"}</td><td>{row.paymentType}</td><td>{formatInr(row.amountPaise)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-pp">
        <h2 className="h6">Disputes</h2>
        <table className="table mb-0">
          <thead><tr><th>When</th><th>Order</th><th>Channel</th><th>From</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>
            {(data?.disputes ?? []).map((row) => (
              <tr key={row.id}><td>{when(row.createdAt)}</td><td>{row.orderRef}</td><td>{row.channel}</td><td>{row.fromEmail}</td><td>{row.note}</td><td>{row.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

function Gst() {
  const [form, setForm] = useState({ hasGst: true, gstin: "", legalName: "", address: "", state: "", city: "", pan: "", cin: "", zip: "" })
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    void api.gst().then(setForm).catch((caught) => setError(errText(caught, "Could not load GST")))
  }, [])
  function set(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }))
  }
  return (
    <MgmtShell crumb="Accounting › GST Information" title="GST Information">
      {error && <p className="text-danger">{error}</p>}
      {saved && <p className="text-success">Saved. These details print on subscription invoices for this outlet.</p>}
      <form className="card-pp" onSubmit={(e) => { e.preventDefault(); setSaved(false); void api.saveGst(form).then(() => setSaved(true)).catch((caught) => setError(errText(caught, "Could not save"))) }}>
        <div className="form-check mb-3">
          <input id="has-gst" className="form-check-input" type="checkbox" checked={form.hasGst} onChange={(e) => set("hasGst", e.target.checked)} />
          <label className="form-check-label" htmlFor="has-gst">This outlet has GST</label>
        </div>
        <div className="row g-2">
          <div className="col-md-4"><input className="form-control" placeholder="GSTIN" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} /></div>
          <div className="col-md-4"><input className="form-control" placeholder="Registered name" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} /></div>
          <div className="col-md-4"><input className="form-control" placeholder="PAN" value={form.pan} onChange={(e) => set("pan", e.target.value)} /></div>
          <div className="col-12"><input className="form-control" placeholder="Registered address" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="State" value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="ZIP" value={form.zip} onChange={(e) => set("zip", e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="CIN" value={form.cin} onChange={(e) => set("cin", e.target.value)} /></div>
        </div>
        <button className="btn btn-primary mt-3" type="submit">Save</button>
      </form>
    </MgmtShell>
  )
}

function Banks() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.banks>>["rows"]>([])
  const [form, setForm] = useState({ accountName: "", bankName: "", accountNo: "", ifsc: "", primary: true })
  const [error, setError] = useState("")
  async function load() { setRows((await api.banks()).rows) }
  useEffect(() => { void load().catch((caught) => setError(errText(caught, "Could not load banks"))) }, [])
  return (
    <MgmtShell crumb="Accounting › Bank Details" title="Bank Details">
      {error && <p className="text-danger">{error}</p>}
      <form className="card-pp mb-3" onSubmit={(e) => { e.preventDefault(); void api.addBank(form).then(() => { setForm({ accountName: "", bankName: "", accountNo: "", ifsc: "", primary: false }); return load() }).catch((caught) => setError(errText(caught, "Could not add the account"))) }}>
        <div className="row g-2">
          <div className="col-md-3"><input className="form-control" placeholder="Account name" required value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Bank" required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Account no." required value={form.accountNo} onChange={(e) => setForm({ ...form, accountNo: e.target.value })} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="IFSC" required value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100" type="submit">Add</button></div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Name</th><th>Bank</th><th>Account</th><th>IFSC</th><th /><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-muted">No payout account yet.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.accountName}</td><td>{row.bankName}</td><td>{row.accountNo}</td><td>{row.ifsc}</td>
                <td>{row.primary ? "Primary" : ""}</td>
                <td className="text-end"><button type="button" className="btn btn-sm btn-link text-danger" onClick={() => void api.deleteBank(row.id).then(load)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

const CASH = [
  ["expense", "Expense"],
  ["withdrawal", "Withdrawal"],
  ["topup", "Cash Top-Up"],
] as const

function Expenses() {
  const [kind, setKind] = useState<(typeof CASH)[number][0]>("expense")
  const [tab, setTab] = useState<"list" | "master">("list")
  const [data, setData] = useState<Awaited<ReturnType<typeof api.cash>> | null>(null)
  const [title, setTitle] = useState("")
  const [headId, setHeadId] = useState(0)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [date, setDate] = useState(today())
  const [error, setError] = useState("")
  async function load(next = kind) { setData(await api.cash(next)) }
  useEffect(() => { void load().catch((caught) => setError(errText(caught, "Could not load"))) }, [])
  const label = CASH.find((item) => item[0] === kind)?.[1]
  return (
    <MgmtShell crumb="Accounting › Expense & Withdrawal" title="Expense & Withdrawal">
      {error && <p className="text-danger">{error}</p>}
      <div className="inv-subnav">
        {CASH.map(([id, name]) => (
          <button key={id} type="button" className={id === kind ? "on" : ""} onClick={() => { setKind(id); void load(id) }}>{name}</button>
        ))}
        <button type="button" className={tab === "master" ? "on" : ""} onClick={() => setTab("master")}>Master</button>
        <button type="button" className={tab === "list" ? "on" : ""} onClick={() => setTab("list")}>Listing</button>
      </div>
      {tab === "master" ? (
        <div className="card-pp">
          <form className="d-flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); void api.addCashHead(kind, title).then(() => { setTitle(""); return load() }).catch((caught) => setError(errText(caught, "Could not add"))) }}>
            <input className="form-control" placeholder={`${label} head`} value={title} onChange={(e) => setTitle(e.target.value)} required />
            <button className="btn btn-primary" type="submit">Add head</button>
          </form>
          <table className="table mb-0">
            <thead><tr><th>Title</th><th>Status</th></tr></thead>
            <tbody>
              {(data?.heads ?? []).map((head) => <tr key={head.id}><td>{head.title}</td><td>{head.active ? "Active" : "Inactive"}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-pp">
          <form className="row g-2 mb-3" onSubmit={(e) => {
            e.preventDefault()
            const amountPaise = rupeesToPaise(amount)
            if (!amountPaise || !headId) return setError("Pick a head and an amount.")
            void api.addCashEntry({ headId, amountPaise, note, businessDate: date }).then(() => { setAmount(""); setNote(""); return load() }).catch((caught) => setError(errText(caught, "Could not save")))
          }}>
            <div className="col-md-3">
              <select className="form-select" value={headId} onChange={(e) => setHeadId(Number(e.target.value))}>
                <option value={0}>Head</option>
                {data?.heads.filter((head) => head.active).map((head) => <option key={head.id} value={head.id}>{head.title}</option>)}
              </select>
            </div>
            <div className="col-md-2"><input className="form-control" placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="col-md-2"><input className="form-control" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="col-md-3"><input className="form-control" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="col-md-2"><button className="btn btn-primary w-100" type="submit">Save</button></div>
          </form>
          <table className="table mb-0">
            <thead><tr><th>Date</th><th>Head</th><th>Amount</th><th>Note</th><th /></tr></thead>
            <tbody>
              {(data?.entries ?? []).map((entry) => (
                <tr key={entry.id} className={entry.removed ? "text-muted" : ""}>
                  <td>{entry.businessDate}</td><td>{entry.title}</td><td>{formatInr(entry.amountPaise)}</td><td>{entry.note}</td>
                  <td className="text-end">{entry.removed ? "Removed" : <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => void api.removeCashEntry(entry.id).then(() => load())}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MgmtShell>
  )
}

function Invoices() {
  const [tab, setTab] = useState("monthly")
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.serviceInvoices>>["rows"]>([])
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [proforma, setProforma] = useState("")
  const [paymentType, setPaymentType] = useState("online")
  const [issuedOn, setIssuedOn] = useState(today())
  const [error, setError] = useState("")
  async function load(next = tab) { setRows((await api.serviceInvoices(next)).rows) }
  useEffect(() => { void load().catch((caught) => setError(errText(caught, "Could not load invoices"))) }, [])
  return (
    <MgmtShell crumb="Accounting › Service Payment History" title="Service Payment History">
      {error && <p className="text-danger">{error}</p>}
      <div className="inv-subnav">
        {INVOICE_TABS.map(([id, label]) => (
          <button key={id} type="button" className={id === tab ? "on" : ""} onClick={() => { setTab(id); void load(id) }}>{label}</button>
        ))}
      </div>
      <form className="card-pp mb-3" onSubmit={(e) => {
        e.preventDefault()
        const amountPaise = rupeesToPaise(amount)
        if (amountPaise === null) return setError("Enter an amount.")
        void api.addServiceInvoice({ tab, title, amountPaise, paymentType, proformaNo: proforma, issuedOn }).then(() => { setTitle(""); setAmount(""); setProforma(""); return load() }).catch((caught) => setError(errText(caught, "Could not add")))
      }}>
        <div className="row g-2">
          <div className="col-md-3"><input className="form-control" placeholder="Title" required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Proforma no." value={proforma} onChange={(e) => setProforma(e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} /></div>
          <div className="col-md-2">
            <select className="form-select" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="online">Online</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="col-md-1"><button className="btn btn-primary" type="submit">Add</button></div>
        </div>
      </form>
      <div className="card-pp">
        <table className="table mb-0">
          <thead><tr><th>Date</th><th>Title</th><th>Proforma</th><th>Type</th><th>Amount</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="text-muted">Nothing in this tab.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.issuedOn}</td><td>{row.title}</td><td>{row.proformaNo || "—"}</td><td>{row.paymentType}</td><td>{formatInr(row.amountPaise)}</td>
                <td>{row.status}{row.cancelReason ? ` — ${row.cancelReason}` : ""}</td>
                <td className="text-end">{row.status === "open" && <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => { const reason = window.prompt("Cancel reason"); if (reason) void api.cancelServiceInvoice(row.id, reason).then(() => load()) }}>Cancel</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

function Loans() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.loans>> | null>(null)
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [startedOn, setStartedOn] = useState(today())
  const [error, setError] = useState("")
  async function load() { setData(await api.loans()) }
  useEffect(() => { void load().catch((caught) => setError(errText(caught, "Could not load loans"))) }, [])
  return (
    <MgmtShell crumb="Accounting › Loan Information" title="Loan Information">
      {error && <p className="text-danger">{error}</p>}
      <form className="card-pp mb-3" onSubmit={(e) => {
        e.preventDefault()
        const principalPaise = rupeesToPaise(amount)
        if (!principalPaise) return setError("Enter the principal.")
        void api.addLoan({ title, principalPaise, startedOn }).then(() => { setTitle(""); setAmount(""); return load() }).catch((caught) => setError(errText(caught, "Could not add the loan")))
      }}>
        <div className="row g-2">
          <div className="col-md-4"><input className="form-control" placeholder="Loan title" required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Principal ₹" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100" type="submit">Add loan</button></div>
        </div>
      </form>
      <div className="card-pp mb-3">
        <table className="table mb-0">
          <thead><tr><th>Title</th><th>Started</th><th>Principal</th><th>Outstanding</th><th>Status</th><th /></tr></thead>
          <tbody>
            {(data?.loans ?? []).length === 0 && <tr><td colSpan={6} className="text-muted">No loans.</td></tr>}
            {data?.loans.map((loan) => (
              <tr key={loan.id}>
                <td>{loan.title}</td><td>{loan.startedOn}</td><td>{formatInr(loan.principalPaise)}</td><td>{formatInr(loan.outstandingPaise)}</td><td>{loan.status}</td>
                <td className="text-end">{loan.status === "active" && <button type="button" className="btn btn-sm btn-link" onClick={() => {
                  const value = window.prompt("Repayment in rupees")
                  const paise = value ? rupeesToPaise(value) : null
                  if (paise) void api.repayLoan(loan.id, paise).then(load).catch((caught) => setError(errText(caught, "Could not record the repayment")))
                }}>Repay</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-pp">
        <h2 className="h6">Repayment invoices</h2>
        <table className="table mb-0">
          <thead><tr><th>Date</th><th>Loan</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody>
            {(data?.invoices ?? []).map((row) => (
              <tr key={row.id}><td>{row.issuedOn}</td><td>#{row.loanId}</td><td>{formatInr(row.amountPaise)}</td><td>{row.note}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}

function Denominations() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.denominations>>["rows"]>([])
  const [error, setError] = useState("")
  async function load() { setRows((await api.denominations()).rows) }
  useEffect(() => { void load().catch((caught) => setError(errText(caught, "Could not load denominations"))) }, [])
  return (
    <MgmtShell crumb="Accounting › Denomination" title="Denomination">
      {error && <p className="text-danger">{error}</p>}
      <div className="card-pp">
        <p className="text-muted">Notes and coins offered when cash is counted at day end.</p>
        <table className="table mb-0">
          <thead><tr><th>Note / coin</th><th>Value</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td><td>{formatInr(row.valuePaise)}</td><td>{row.available ? "Available" : "Not available"}</td>
                <td className="text-end">
                  <button type="button" className="btn btn-sm btn-link" onClick={() => void api.setDenomination(row.id, !row.available).then(load)}>
                    {row.available ? "Mark unavailable" : "Mark available"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MgmtShell>
  )
}
