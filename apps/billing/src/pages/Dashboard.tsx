import { useEffect, useMemo, useState } from "react"
import Highcharts from "highcharts"
import HighchartsReact from "highcharts-react-official"
import { ApiError, api, formatInr, type DashboardData } from "../api"

const RANGES = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 Days" },
  { id: "last_30", label: "Last 30 Days" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
]

export function Dashboard() {
  const [range, setRange] = useState("today")
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState<"column" | "area" | "line">("column")
  const [actionOpen, setActionOpen] = useState(false)
  const [fssaiOpen, setFssaiOpen] = useState(false)
  const [fssai, setFssai] = useState("")
  const [snapshotSkipped, setSnapshotSkipped] = useState(false)
  const [itemMode, setItemMode] = useState<"top" | "low">("top")

  async function load() {
    setLoading(true)
    setError("")
    try {
      setData(await api.dashboard(range))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Issue while getting the data")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [range])

  const chartOptions = useMemo(() => {
    if (!data) return null
    return {
      chart: { type: chartType, height: 280, backgroundColor: "transparent" },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: { categories: data.sales.chart.categories },
      yAxis: { title: { text: undefined }, min: 0 },
      legend: { align: "center", verticalAlign: "bottom" },
      plotOptions: {
        series: { stacking: chartType === "line" ? undefined : "normal" },
        column: { borderRadius: 2 },
      },
      series: [
        { name: "Dine In", data: data.sales.chart.dineIn, color: "#2f6fed" },
        { name: "Pick Up", data: data.sales.chart.pickup, color: "#198754" },
        { name: "Delivery", data: data.sales.chart.delivery, color: "#fd7e14" },
      ],
    } as Highcharts.Options
  }, [data, chartType])

  return (
    <div className="dashboard-page">
      {data?.snapshotReady && !snapshotSkipped && (
        <div className="snapshot-banner">
          <div>
            <div className="fw-semibold">Your Daily Snapshot is ready</div>
            <div className="text-muted small">
              {data.snapshotDate} — yesterday&apos;s performance across sales, orders, customers &amp; loyalty
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm ms-auto">
            Open snapshot
          </button>
          <button type="button" className="btn btn-link btn-sm" onClick={() => setSnapshotSkipped(true)}>
            Skip
          </button>
        </div>
      )}

      <div className="sync-row">
        {data && (
          <>
            <span className="sync-pill">POS synced {data.sync.posDaysAgo} Days ago</span>
            <span className="sync-pill">Orders synced {data.sync.ordersDaysAgo} Days ago</span>
          </>
        )}
        <button type="button" className="action-center-btn" onClick={() => setActionOpen(true)}>
          Action Center
          {data && data.actionCenter.length > 0 && <span className="bubble">{data.actionCenter.length}</span>}
        </button>
      </div>

      <div className="pp-card">
        <div className="card-toolbar">
          <h3>Sales Statistics</h3>
          <div className="d-flex gap-2 align-items-center">
            <select className="form-select form-select-sm date-chip" style={{ width: "auto" }} value={range} onChange={(e) => setRange(e.target.value)}>
              {RANGES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void load()}>
              <i className="bi bi-arrow-clockwise" />
            </button>
          </div>
        </div>

        {loading && <div className="empty-soft">Loading sales…</div>}
        {error && (
          <div className="alert alert-warning d-flex justify-content-between align-items-center">
            <span>Issue while getting the data — {error}</span>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            <div className="sales-grid">
              <div>
                <div className="text-muted small">{data.sales.dateLabel}</div>
                <div className="sales-total">{formatInr(data.sales.totalPaise)}</div>
                <div className="mb-3">{data.sales.orderCount} order</div>
                {data.sales.byTender.map((row) => (
                  <div className="tender-row" key={row.label}>
                    <span>{row.label}</span>
                    <span>
                      {formatInr(row.amountPaise)} · {row.share.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <div className="fw-semibold">Sales - Daily · stacked by channel</div>
                    <div className="text-muted small">Total orders {data.sales.orderCount}</div>
                  </div>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 110 }}
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as typeof chartType)}
                  >
                    <option value="column">Column</option>
                    <option value="area">Area</option>
                    <option value="line">Line</option>
                  </select>
                </div>
                {chartOptions && <HighchartsReact highcharts={Highcharts} options={chartOptions} />}
              </div>
            </div>

            <div className="channel-cards">
              {data.sales.byChannel.map((channel) => (
                <div className="channel-card" key={channel.key}>
                  <div className="label">
                    <span className={`dot dot-${channel.key === "dine_in" ? "dine" : channel.key === "pickup" ? "pickup" : "delivery"}`} />
                    {channel.label}
                  </div>
                  <div className="fs-4 fw-bold">{formatInr(channel.totalPaise)}</div>
                  <div>
                    {channel.orderCount} Order · {channel.share.toFixed(0)}%
                  </div>
                  <div className="meta-grid">
                    <span>Min {formatInr(channel.minPaise)}</span>
                    <span>Avg {formatInr(channel.avgPaise)}</span>
                    <span>Max {formatInr(channel.maxPaise)}</span>
                    <span>Discount {formatInr(channel.discountPaise)}</span>
                    <span>Taxes {formatInr(channel.taxPaise)}</span>
                    <span>T.T.A {channel.ttaMinutes}m</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="widget-grid">
        <div className="pp-card">
          <div className="card-toolbar">
            <h3>Online orders</h3>
          </div>
          {data ? (
            <>
              <div className="mb-2">
                Total {data.online.totalOrders} · Prepaid {data.online.prepaid} · COD {data.online.cod} ·{" "}
                {formatInr(data.online.revenuePaise)}
              </div>
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Orders</th>
                    <th>Prepaid</th>
                    <th>COD</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.online.platforms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted">
                        No online orders in this range
                      </td>
                    </tr>
                  ) : (
                    data.online.platforms.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{row.orders}</td>
                        <td>{row.prepaid}</td>
                        <td>{row.cod}</td>
                        <td>{formatInr(row.revenuePaise)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <div className="empty-soft">—</div>
          )}
        </div>

        <div className="pp-card">
          <div className="card-toolbar">
            <h3>Item Performance</h3>
            <div className="btn-group btn-group-sm">
              <button type="button" className={`btn ${itemMode === "top" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setItemMode("top")}>
                Top Performing
              </button>
              <button type="button" className={`btn ${itemMode === "low" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setItemMode("low")}>
                Low Performing
              </button>
            </div>
          </div>
          {(data?.items ?? []).length === 0 ? (
            <div className="empty-soft">No sales to compare yet</div>
          ) : (
            <table className="table table-sm mb-0">
              <tbody>
                {(itemMode === "top" ? data!.items! : [...data!.items!].reverse()).map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td>{formatInr(item.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pp-card upsell-card">
          <h4>Risk Radar</h4>
          <p>
            Unverified payments {formatInr(data?.risk.unverifiedPaise ?? 0)}. Checks: payment matched to bill, billed =
            collected, every bill has payment.
          </p>
          <a className="btn btn-sm btn-outline-primary" href="/users/finance_redirect">
            Explore Risk Analysis
          </a>
        </div>

        <div className="pp-card upsell-card">
          <h4>Staff Cost vs Sales</h4>
          <p>Connect Attendo to see staff cost against sales, on-time % and overtime.</p>
          <button type="button" className="btn btn-sm btn-outline-primary me-2">
            Already Using
          </button>
          <a className="btn btn-sm btn-link" href="/users/attendo_staff_cost_breakdown">
            See Sample Report
          </a>
        </div>

        <div className="pp-card upsell-card">
          <h4>Expense Drain</h4>
          <p>
            Expense {formatInr(data?.expenses.expensePaise ?? 0)} · Withdrawal{" "}
            {formatInr(data?.expenses.withdrawalPaise ?? 0)} · Top-up {formatInr(data?.expenses.topupPaise ?? 0)}
          </p>
          <button type="button" className="btn btn-sm btn-outline-primary">
            Explore KharchaPay
          </button>
        </div>

        <div className="pp-card upsell-card">
          <h4>Sales Performance · Retention</h4>
          <p>Repeat-customer rate {data?.retentionPct ?? 0}%.</p>
          <a className="btn btn-sm btn-outline-primary" href="/users/marketing_redirect">
            Explore Marketing Manager
          </a>
        </div>

        <div className="pp-card upsell-card">
          <h4>Item margin vs city benchmark</h4>
          <p>Turn on Inventory to see your actual food cost.</p>
          <a className="btn btn-sm btn-outline-primary" href="/inventory_dashboard/new_inventory_dashboard">
            Turn on Inventory
          </a>
        </div>

        <div className="pp-card upsell-card">
          <h4>Quick Help</h4>
          <p>Support hours 10 AM–7 PM</p>
          <a className="btn btn-sm btn-success" href="https://wa.me/916357238463" target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
      </div>

      {actionOpen && data && (
        <>
          <div className="drawer-backdrop" onClick={() => setActionOpen(false)} />
          <aside className="drawer">
            <div className="drawer-header">
              <span>Action Center</span>
              <button type="button" className="btn-close" onClick={() => setActionOpen(false)} />
            </div>
            <div className="drawer-body">
              {data.actionCenter.length === 0 && <div className="empty-soft">You&apos;re all caught up</div>}
              {data.actionCenter.map((item) => (
                <div key={item.id} className="border rounded p-3 mb-2">
                  <div className="fw-semibold">{item.title}</div>
                  <div className="text-muted small mb-2">{item.detail}</div>
                  <div className="d-flex gap-2">
                    {item.id === "fssai" && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => setFssaiOpen(true)}>
                        Fix
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={async () => {
                        await api.dismissAction(item.id)
                        await load()
                      }}
                    >
                      Ignore now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}

      {fssaiOpen && (
        <div className="modal-pp-backdrop">
          <div className="modal-pp">
            <div className="modal-pp-header">
              <span>FSSAI Lic No.</span>
              <button type="button" className="btn-close" onClick={() => setFssaiOpen(false)} />
            </div>
            <div className="modal-pp-body">
              <label className="form-label">FSSAI Lic No.</label>
              <input className="form-control" value={fssai} onChange={(e) => setFssai(e.target.value)} />
            </div>
            <div className="modal-pp-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setFssaiOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  await api.saveFssai(fssai)
                  setFssaiOpen(false)
                  await load()
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
